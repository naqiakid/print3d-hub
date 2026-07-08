'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import type { RequestStatus, PrintType, FilamentMaterial, PrintSize, FilamentCosts } from './types'
import { calculatePriceRange } from './pricing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://print3d-hub.vercel.app'

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    await resend.emails.send({ from: 'Print3D Hub <onboarding@resend.dev>', to, subject, html })
  } catch {
    // Fire-and-forget
  }
}

async function sendOwnerNotification(data: {
  customer_name: string
  customer_email: string
  customer_phone: string
  description: string
  material: string
  deadline: string
  shop_name: string
}) {
  const toEmail = process.env.NOTIFICATION_EMAIL
  if (!toEmail) return
  await sendEmail(
    toEmail,
    `New print request from ${data.customer_name}`,
    `<h2>New request on ${data.shop_name}</h2>
     <p><strong>From:</strong> ${data.customer_name} (${data.customer_email} · ${data.customer_phone})</p>
     <p><strong>Description:</strong> ${data.description}</p>
     <p><strong>Material:</strong> ${data.material.toUpperCase()}</p>
     <p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
     <p><a href="${APP_URL}/dashboard">Open dashboard →</a></p>`,
  )
}

// ─── Shop-level Advanced tier ───────────────────────────────

export async function setShopAdvanced(
  value: boolean,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ advanced_available: value })
    .eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/request')
}

// Recomputes the shop's aggregate materials/price range from all of the
// owner's printers (equipment), and refreshes each printer's cached
// filament cost. Filament stock and shop-level cost settings (electricity
// rate, markup, waste) are shared across all equipment; each printer only
// contributes its own power draw and machine rate.
async function syncShopPricing(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string) {
  const [{ data: shop }, { data: printers }, { data: filaments }] = await Promise.all([
    supabase.from('profiles').select('electricity_rate, markup_percent, waste_percent').eq('id', ownerId).maybeSingle(),
    supabase.from('printers').select('id, materials, power_watts, machine_rate_per_hour').eq('owner_id', ownerId),
    supabase.from('filaments').select('material, cost_per_kg').eq('owner_id', ownerId).eq('in_stock', true),
  ])
  if (!shop || !printers?.length) return

  const costs: Record<string, number> = {}
  for (const f of filaments ?? []) {
    if (!(f.material in costs) || f.cost_per_kg < costs[f.material]) costs[f.material] = f.cost_per_kg
  }
  const filamentCosts = Object.keys(costs).length ? (costs as FilamentCosts) : null

  let minPrice = Infinity
  let maxPrice = 0
  const materialSet = new Set<FilamentMaterial>()

  await Promise.all(printers.map((p) => {
    for (const m of (p.materials ?? []) as FilamentMaterial[]) materialSet.add(m)
    const { price_min, price_max } = calculatePriceRange({
      materials: (p.materials ?? []) as FilamentMaterial[],
      filament_costs: filamentCosts ?? {},
      power_watts: p.power_watts ?? 200,
      electricity_rate: shop.electricity_rate ?? undefined,
      markup_percent: shop.markup_percent ?? undefined,
      machine_rate_per_hour: p.machine_rate_per_hour ?? undefined,
      waste_percent: shop.waste_percent ?? undefined,
    })
    minPrice = Math.min(minPrice, price_min)
    maxPrice = Math.max(maxPrice, price_max)
    return supabase.from('printers').update({ filament_costs: filamentCosts }).eq('id', p.id)
  }))

  await supabase
    .from('profiles')
    .update({
      materials: [...materialSet],
      price_min: minPrice === Infinity ? 0 : minPrice,
      price_max: maxPrice,
    })
    .eq('id', ownerId)
}

export async function registerPrinter(data: {
  name: string
  description: string
  printer_model: string
  printer_model_id: string
  print_types: PrintType[]
  materials: FilamentMaterial[]
  max_size: PrintSize
  turnaround: string
  contact_phone: string
  power_watts: number
  electricity_rate: number
  markup_percent: number
  machine_rate_per_hour: number
  waste_percent: number
  nozzle_sizes: number[]
  bed_type: string[]
  pickup_address?: string
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Shop-level fields — the owner's public listing.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      name: data.name,
      description: data.description,
      print_types: data.print_types,
      materials: data.materials,
      max_size: data.max_size,
      turnaround: data.turnaround,
      whatsapp: data.contact_phone,
      pickup_address: data.pickup_address ?? null,
      electricity_rate: data.electricity_rate,
      markup_percent: data.markup_percent,
      waste_percent: data.waste_percent,
    })
    .eq('id', user.id)
  if (profileError) return { error: profileError.message }

  // Equipment-level fields — this specific machine.
  const { data: printer, error } = await supabase
    .from('printers')
    .insert({
      owner_id: user.id,
      printer_model: data.printer_model,
      printer_model_id: data.printer_model_id,
      materials: data.materials,
      power_watts: data.power_watts,
      machine_rate_per_hour: data.machine_rate_per_hour,
      bed_type: data.bed_type,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Auto-create one profile per nozzle size with sensible defaults.
  // The 0.4mm nozzle (or the first selected) is marked as default.
  const sortedNozzles = [...data.nozzle_sizes].sort((a, b) => a - b)
  const defaultNozzle = sortedNozzles.includes(0.4) ? 0.4 : sortedNozzles[0]
  const profilesPayload = sortedNozzles.map((nozzle) => ({
    printer_id: printer.id,
    name: `${nozzle}mm nozzle`,
    nozzle_mm: nozzle,
    infill_basic: 15,
    wall_count_basic: 3,
    supports_available: true,
    ironing_available: false,
    color_change_available: data.print_types.includes('colorful'),
    pause_insert_available: false,
    fuzzy_skin_available: false,
    is_default: nozzle === defaultNozzle,
  }))

  const { error: profilesError } = await supabase
    .from('print_profiles')
    .insert(profilesPayload)

  if (profilesError) {
    // Roll back the printer row so a mid-registration failure doesn't leave an orphan
    // (Supabase JS doesn't support cross-table transactions, so this is best-effort.)
    await supabase.from('printers').delete().eq('id', printer.id)
    return { error: profilesError.message }
  }

  await syncShopPricing(supabase, user.id)
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

// Adds another machine to an existing shop — equipment only, no shop-level
// fields (those are already set from the owner's first registration).
export async function addPrinter(data: {
  printer_model: string
  printer_model_id: string
  materials: FilamentMaterial[]
  power_watts: number
  machine_rate_per_hour: number
  nozzle_sizes: number[]
  bed_type: string[]
}): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: printer, error } = await supabase
    .from('printers')
    .insert({
      owner_id: user.id,
      printer_model: data.printer_model,
      printer_model_id: data.printer_model_id,
      materials: data.materials,
      power_watts: data.power_watts,
      machine_rate_per_hour: data.machine_rate_per_hour,
      bed_type: data.bed_type,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const sortedNozzles = [...data.nozzle_sizes].sort((a, b) => a - b)
  const defaultNozzle = sortedNozzles.includes(0.4) ? 0.4 : sortedNozzles[0]
  const { error: profilesError } = await supabase.from('print_profiles').insert(
    sortedNozzles.map((nozzle) => ({
      printer_id: printer.id,
      name: `${nozzle}mm nozzle`,
      nozzle_mm: nozzle,
      infill_basic: 15,
      wall_count_basic: 3,
      supports_available: true,
      ironing_available: false,
      color_change_available: false,
      pause_insert_available: false,
      fuzzy_skin_available: false,
      is_default: nozzle === defaultNozzle,
    })),
  )
  if (profilesError) {
    await supabase.from('printers').delete().eq('id', printer.id)
    return { error: profilesError.message }
  }

  await syncShopPricing(supabase, user.id)
  revalidatePath('/dashboard/equipment')
  return { id: printer.id }
}

export async function removePrinter(printerId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { count } = await supabase
    .from('printers')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
  if ((count ?? 0) <= 1) return { error: 'You need at least one printer for your shop to stay listed.' }

  const { error } = await supabase
    .from('printers')
    .delete()
    .eq('id', printerId)
    .eq('owner_id', user.id)
  if (error) return { error: error.message }

  await syncShopPricing(supabase, user.id)
  revalidatePath('/dashboard/equipment')
}

// ─── Filament CRUD ──────────────────────────────────────────

type FilamentInput = {
  material: FilamentMaterial
  brand: string
  color: string
  color_hex: string
  cost_per_kg: number
  in_stock: boolean
  grams_total?: number | null
  grams_remaining?: number | null
  low_stock_threshold_g?: number
}

export async function createFilament(data: FilamentInput): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: inserted, error } = await supabase
    .from('filaments')
    .insert({ ...data, owner_id: user.id })
    .select('id')
    .single()
  if (error) return { error: error.message }
  await syncShopPricing(supabase,user.id)
  revalidatePath('/dashboard', 'layout')
  return { id: inserted.id }
}

export async function updateFilament(
  id: string,
  data: FilamentInput,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('filaments')
    .update(data)
    .eq('id', id)
    .eq('owner_id', user.id)
  if (error) return { error: error.message }
  await syncShopPricing(supabase,user.id)
  revalidatePath('/dashboard', 'layout')
}

export async function restockFilament(
  id: string,
  addGrams: number,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!addGrams || addGrams <= 0) return { error: 'Enter a positive amount to add.' }

  const { data: filament } = await supabase
    .from('filaments')
    .select('grams_remaining, grams_total, in_stock')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!filament) return { error: 'Filament not found' }

  const newRemaining = (filament.grams_remaining ?? 0) + addGrams
  const updates: Record<string, unknown> = {
    grams_remaining: newRemaining,
    grams_total: filament.grams_total ?? addGrams,
  }
  if (!filament.in_stock) updates.in_stock = true

  const { error } = await supabase
    .from('filaments')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', user.id)
  if (error) return { error: error.message }
  await syncShopPricing(supabase,user.id)
  revalidatePath('/dashboard', 'layout')
}

// Auto-deducts filament stock when a job finishes printing. Groups the
// request's per-plate weights by material + color, matches them to the
// owner's tracked filament rolls (grams_remaining set), and decrements.
// Fails soft — a missing match never blocks the status update itself.
async function deductFilamentForRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  requestId: string,
) {
  try {
    const { data: request } = await supabase
      .from('requests')
      .select('material, weight_g, plate_filaments')
      .eq('id', requestId)
      .maybeSingle()
    if (!request?.weight_g) return

    type Group = { material: string; color_hex: string | null; weight_g: number }
    const plates = (request.plate_filaments ?? []) as {
      material: string
      color_hex?: string
      weight_g?: number | null
    }[]
    const platesWithWeight = plates.filter((p) => (p.weight_g ?? 0) > 0)

    let groups: Group[] = []
    if (platesWithWeight.length > 0) {
      const byKey = new Map<string, Group>()
      for (const p of platesWithWeight) {
        const key = `${p.material}|${p.color_hex ?? ''}`
        const existing = byKey.get(key)
        if (existing) existing.weight_g += p.weight_g!
        else byKey.set(key, { material: p.material, color_hex: p.color_hex ?? null, weight_g: p.weight_g! })
      }
      groups = [...byKey.values()]
    } else if (request.material) {
      groups = [{ material: request.material, color_hex: null, weight_g: request.weight_g }]
    }
    if (groups.length === 0) return

    const { data: filaments } = await supabase
      .from('filaments')
      .select('id, material, color_hex, grams_remaining')
      .eq('owner_id', ownerId)
      .not('grams_remaining', 'is', null)
    if (!filaments?.length) return

    let needsResync = false
    for (const g of groups) {
      const candidates = filaments.filter((f) => f.material === g.material)
      if (candidates.length === 0) continue
      const match = candidates.find((f) => f.color_hex === g.color_hex) ?? candidates[0]
      const newRemaining = Math.max(0, Number(match.grams_remaining) - g.weight_g)
      const updates: Record<string, unknown> = { grams_remaining: newRemaining }
      if (newRemaining === 0) { updates.in_stock = false; needsResync = true }
      await supabase.from('filaments').update(updates).eq('id', match.id)
    }
    if (needsResync) await syncShopPricing(supabase,ownerId)
  } catch {
    // Fail soft — stock deduction is best-effort, never blocks the job status update
  }
}

export async function deleteFilament(id: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('filaments')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)
  if (error) return { error: error.message }
  await syncShopPricing(supabase,user.id)
  revalidatePath('/dashboard', 'layout')
}

export async function sliceSTL(
  stlUrl: string,
  material: string,
  nozzle_mm: number,
  infill: number,
): Promise<{ weight_g: number; print_hours: number } | { error: string }> {
  const slicerUrl = process.env.SLICER_SERVICE_URL
  if (!slicerUrl) return { error: 'Slicer service not configured' }

  try {
    const stlRes = await fetch(stlUrl)
    if (!stlRes.ok) return { error: 'Could not fetch STL file' }
    const stlBuffer = await stlRes.arrayBuffer()

    const form = new FormData()
    form.append('file', new Blob([stlBuffer], { type: 'application/octet-stream' }), 'model.stl')
    form.append('material', material)
    form.append('nozzle_mm', String(nozzle_mm))
    form.append('infill', String(infill))

    const res = await fetch(`${slicerUrl}/slice`, { method: 'POST', body: form })
    if (!res.ok) return { error: `Slicer error: ${res.status}` }
    return await res.json() as { weight_g: number; print_hours: number }
  } catch {
    return { error: 'Slicer service unreachable' }
  }
}

export async function submitRequest(data: {
  owner_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  description: string
  print_type: string
  material: string
  size: string
  quality: string
  deadline: string
  notes: string
  color?: string
  color_hex?: string
  supports?: boolean
  model_url?: string | null
  model_title?: string | null
  model_image?: string | null
  stl_url?: string | null
  stl_urls?: string[]
  weight_g?: number | null
  print_hours?: number | null
  profile_id?: string | null
  selected_addons?: string[]
  declined_addons?: string[]
  color_preferences?: { part_number: number; file_name: string; color: string; color_hex: string }[]
  fulfillment?: 'pickup' | 'delivery'
  delivery_address?: string | null
  catalog_item_id?: string | null
  custom_infill?: number | null
  custom_wall_count?: number | null
}): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()

  // Strip optional columns that may not exist yet if migrations haven't run
  const { color_preferences, fulfillment, delivery_address, declined_addons, catalog_item_id, custom_infill, custom_wall_count, ...baseData } = data
  const insertPayload = {
    ...baseData,
    ...(color_preferences?.length ? { color_preferences } : {}),
    ...(fulfillment ? { fulfillment } : {}),
    ...(delivery_address ? { delivery_address } : {}),
    ...(declined_addons?.length ? { declined_addons } : {}),
    ...(catalog_item_id ? { catalog_item_id } : {}),
    ...(custom_infill != null ? { custom_infill } : {}),
    ...(custom_wall_count != null ? { custom_wall_count } : {}),
  }

  const { data: inserted, error } = await supabase
    .from('requests')
    .insert(insertPayload)
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Fire-and-forget emails
  supabase
    .from('profiles')
    .select('name')
    .eq('id', data.owner_id)
    .single()
    .then(({ data: shop }) => {
      const printerName = shop?.name ?? 'your printer'
      const trackingUrl = `${APP_URL}/track/${inserted.id}`

      sendOwnerNotification({
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        description: data.description,
        material: data.material,
        deadline: data.deadline,
        shop_name: printerName,
      })

      sendEmail(
        data.customer_email,
        `Your print request has been received — ${printerName}`,
        `<h2>Thanks, ${data.customer_name}!</h2>
         <p>Your request has been received by <strong>${printerName}</strong>. They'll review it and send you a quote soon.</p>
         <p><strong>Description:</strong> ${data.description}</p>
         <p><strong>Material:</strong> ${data.material.toUpperCase()}</p>
         <p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
         <p>Track your order here:<br><a href="${trackingUrl}">${trackingUrl}</a></p>
         <p style="color:#888;font-size:12px">Save this link — it's the only way to check your order status.</p>`,
      )
    })

  return { id: inserted.id }
}

// Allows a customer to revise material, color, and print options before the quote is accepted.
// Requires knowing the request ID (UUID security model — same as accept/decline).
export async function updateRequest(
  requestId: string,
  data: {
    material: string
    color: string
    color_hex: string
    selected_addons: string[]
    declined_addons: string[]
    notes?: string
  },
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('requests')
    .update({
      material:        data.material,
      color:           data.color,
      color_hex:       data.color_hex,
      selected_addons: data.selected_addons,
      declined_addons: data.declined_addons,
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      status: 'new',  // revert to new so owner re-reviews
    })
    .eq('id', requestId)
    .in('status', ['new', 'quoted'])
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateListing(data: {
  name: string
  description: string
  turnaround: string
  contact_phone: string
  electricity_rate: number
  markup_percent: number
  machine_rate_per_hour: number
  waste_percent: number
  pickup_address: string
  lat?: number | null
  lng?: number | null
  delivery_available: boolean
  delivery_rate_per_km: number | null
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { machine_rate_per_hour, contact_phone, ...shopFields } = data

  const { error } = await supabase
    .from('profiles')
    .update({ ...shopFields, whatsapp: contact_phone })
    .eq('id', user.id)
  if (error) return { error: error.message }

  // Machine rate is equipment-level, but this form covers the whole shop —
  // apply it to all of the owner's printers uniformly.
  await supabase.from('printers').update({ machine_rate_per_hour }).eq('owner_id', user.id)

  // Cost settings changed — recompute the price range shown to browsing customers
  await syncShopPricing(supabase, user.id)

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard')
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('requests')
    .update({ status })
    .eq('id', requestId)

  if (error) return { error: error.message }

  if (status === 'done') {
    await deductFilamentForRequest(supabase, user.id, requestId)
  }

  if (status === 'collected') {
    supabase
      .from('requests')
      .select('customer_name, customer_email, owner_id')
      .eq('id', requestId)
      .single()
      .then(({ data: req }) => {
        if (!req) return
        supabase
          .from('profiles')
          .select('name')
          .eq('id', req.owner_id)
          .single()
          .then(({ data: printer }) => {
            const printerName = printer?.name ?? 'your printer'
            const trackingUrl = `${APP_URL}/track/${requestId}`
            sendEmail(
              req.customer_email,
              `How was your print from ${printerName}?`,
              `<h2>Hope you love it!</h2>
               <p>Hi ${req.customer_name},</p>
               <p><strong>${printerName}</strong> marked your print as collected. Got a minute to leave a quick review?</p>
               <p><a href="${trackingUrl}" style="font-size:16px;font-weight:bold">${trackingUrl}</a></p>`,
            )
          })
      })
  }

  revalidatePath('/dashboard')
}

export async function submitReview(
  requestId: string,
  ownerId: string,
  rating: number,
  comment: string,
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'Rating must be between 1 and 5.' }
  }

  const { error: insertError } = await supabase.from('reviews').insert({
    request_id: requestId,
    owner_id: ownerId,
    rating,
    comment: comment.trim(),
  })
  if (insertError) {
    if (insertError.code === '23505') return { error: 'This request has already been reviewed.' }
    return { error: insertError.message }
  }

  const { error: statusError } = await supabase
    .from('requests')
    .update({ status: 'reviewed' as RequestStatus })
    .eq('id', requestId)
  if (statusError) return { error: statusError.message }

  revalidatePath(`/track/${requestId}`)
  revalidatePath(`/printers/${ownerId}`)
  return { success: true }
}

export async function sendQuote(
  requestId: string,
  price: number,
  byDate: string,
  message: string,
  gcodeUrls?: string[],
  weightG?: number | null,
  printHours?: number | null,
  material?: string,
  plateFilaments?: { material: string; color: string; color_hex: string; weight_g?: number | null }[],
  confirmedAddons?: string[],
  deliveryCost?: number | null,
  stlUrlsToMerge?: string[],
  quoteModelUrl?: string | null,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('requests')
    .update({
      status: 'quoted' as RequestStatus,
      quoted_price: price,
      quoted_by_date: byDate,
      quote_message: message,
      ...(gcodeUrls !== undefined         && { gcode_urls: gcodeUrls }),
      ...(weightG != null                 && { weight_g: weightG }),
      ...(printHours != null              && { print_hours: printHours }),
      ...(material                        && { material }),
      ...(plateFilaments?.length          && { plate_filaments: plateFilaments }),
      ...(confirmedAddons                 && { confirmed_addons: confirmedAddons }),
      ...(deliveryCost != null            && { delivery_cost: deliveryCost }),
      ...(stlUrlsToMerge?.length          && { stl_urls: stlUrlsToMerge }),
      ...(quoteModelUrl                   && { quote_model_url: quoteModelUrl }),
    })
    .eq('id', requestId)

  if (error) return { error: error.message }

  // Fire-and-forget quote email to customer
  supabase
    .from('requests')
    .select('customer_name, customer_email, owner_id')
    .eq('id', requestId)
    .single()
    .then(({ data: req }) => {
      if (!req) return
      supabase
        .from('profiles')
        .select('name')
        .eq('id', req.owner_id)
        .single()
        .then(({ data: printer }) => {
          const printerName = printer?.name ?? 'your printer'
          const trackingUrl = `${APP_URL}/track/${requestId}`
          const readyDate = new Date(byDate).toLocaleDateString('en-MY', {
            weekday: 'long', day: 'numeric', month: 'long',
          })
          sendEmail(
            req.customer_email,
            `Quote from ${printerName}: RM${price}`,
            `<h2>You have a quote!</h2>
             <p>Hi ${req.customer_name},</p>
             <p><strong>${printerName}</strong> has reviewed your request and sent a quote:</p>
             <table style="margin:16px 0;border-collapse:collapse">
               <tr><td style="padding:4px 12px 4px 0;color:#888">Price</td><td style="font-size:24px;font-weight:bold">RM${price}</td></tr>
               <tr><td style="padding:4px 12px 4px 0;color:#888">Ready by</td><td>${readyDate}</td></tr>
               ${message ? `<tr><td style="padding:4px 12px 4px 0;color:#888">Note</td><td>${message}</td></tr>` : ''}
             </table>
             <p>To accept or decline this quote, visit your tracking page:</p>
             <p><a href="${trackingUrl}" style="font-size:16px;font-weight:bold">${trackingUrl}</a></p>`,
          )
        })
    })

  revalidatePath('/dashboard')
}

export async function updateAvailability(
  available: boolean,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ available })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard', 'layout')
}

export async function updateShopPhotos(
  samplePhotos: string[],
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ sample_photos: samplePhotos })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  revalidatePath(`/printers/${user.id}`)
}

export async function acceptQuote(
  requestId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()

  const { data: req, error: fetchError } = await supabase
    .from('requests')
    .select('status, customer_name, owner_id')
    .eq('id', requestId)
    .maybeSingle()

  if (fetchError || !req) return { error: 'Request not found' }
  if (req.status !== 'quoted') return { error: 'Quote is no longer available to accept' }

  const { error } = await supabase
    .from('requests')
    .update({ status: 'accepted' as RequestStatus })
    .eq('id', requestId)

  if (error) return { error: error.message }

  // Notify owner
  const toEmail = process.env.NOTIFICATION_EMAIL
  if (toEmail) {
    supabase
      .from('profiles')
      .select('name')
      .eq('id', req.owner_id)
      .maybeSingle()
      .then(({ data: printer }) => {
        sendEmail(
          toEmail,
          `Quote accepted — ${req.customer_name}`,
          `<h2>Quote accepted on ${printer?.name ?? 'your printer'}</h2>
           <p><strong>${req.customer_name}</strong> has accepted your quote and confirmed the job.</p>
           <p><a href="${APP_URL}/dashboard">Open dashboard →</a></p>`,
        )
      })
  }

  revalidatePath(`/track/${requestId}`)
}

export async function declineQuote(
  requestId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()

  const { data: req, error: fetchError } = await supabase
    .from('requests')
    .select('status, customer_name, owner_id')
    .eq('id', requestId)
    .maybeSingle()

  if (fetchError || !req) return { error: 'Request not found' }
  if (req.status !== 'quoted') return { error: 'Quote is no longer available to decline' }

  const { error } = await supabase
    .from('requests')
    .update({ status: 'cancelled' as RequestStatus })
    .eq('id', requestId)

  if (error) return { error: error.message }

  // Notify owner
  const toEmail = process.env.NOTIFICATION_EMAIL
  if (toEmail) {
    supabase
      .from('profiles')
      .select('name')
      .eq('id', req.owner_id)
      .maybeSingle()
      .then(({ data: printer }) => {
        sendEmail(
          toEmail,
          `Quote declined — ${req.customer_name}`,
          `<h2>Quote declined on ${printer?.name ?? 'your printer'}</h2>
           <p><strong>${req.customer_name}</strong> has declined your quote. The request has been cancelled.</p>
           <p><a href="${APP_URL}/dashboard">Open dashboard →</a></p>`,
        )
      })
  }

  revalidatePath(`/track/${requestId}`)
}

export async function updatePassword(
  newPassword: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

// ─── Equipment management ────────────────────────────────────

export async function toggleNozzle(
  profileId: string,
  isActive: boolean,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('print_profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
}

export async function addNozzleSize(
  printerId: string,
  nozzleMm: number,
): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.from('print_profiles').insert({
    printer_id: printerId,
    name: `${nozzleMm}mm nozzle`,
    nozzle_mm: nozzleMm,
    infill_basic: 15,
    wall_count_basic: 3,
    supports_available: true,
    ironing_available: false,
    color_change_available: false,
    pause_insert_available: false,
    fuzzy_skin_available: false,
    is_default: false,
    is_active: true,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { id: data.id }
}

export async function removeNozzleSize(
  profileId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('print_profiles')
    .delete()
    .eq('id', profileId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
}

export async function updateBedTypes(
  printerId: string,
  bedTypes: string[],
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('printers')
    .update({ bed_type: bedTypes })
    .eq('id', printerId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
}

export async function updatePrinterCapabilities(
  printerId: string,
  caps: {
    supports_available: boolean
    ironing_available: boolean
    color_change_available: boolean
    pause_insert_available: boolean
    fuzzy_skin_available: boolean
    text_on_surface_available: boolean
  },
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership
  const { data: printer } = await supabase
    .from('printers')
    .select('id')
    .eq('id', printerId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!printer) return { error: 'Not authorised' }

  const { error } = await supabase
    .from('print_profiles')
    .update(caps)
    .eq('printer_id', printerId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
}

// ── Catalog item CRUD ──────────────────────────────────────────

type CatalogItemData = {
  name: string
  description: string
  photo_url?: string | null
  model_url?: string | null
  stl_urls?: string[]
  allow_custom_text: boolean
  text_prompt: string
  allow_color_choice: boolean
  allow_resize: boolean
  resize_min_pct: number
  resize_max_pct: number
  allow_material_choice: boolean
  available_materials: string[]
  material_prices?: Record<string, number>
  material?: string | null
  color?: string | null
  color_hex?: string | null
  base_price?: number | null
  category?: string | null
}

export async function createCatalogItem(
  data: CatalogItemData,
): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: inserted, error } = await supabase
    .from('catalog_items')
    .insert({ owner_id: user.id, ...data })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  revalidatePath(`/printers/${user.id}`)
  return { id: inserted.id }
}

export async function updateCatalogItem(
  itemId: string,
  data: CatalogItemData,
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('catalog_items')
    .update(data)
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function deleteCatalogItem(
  itemId: string,
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('catalog_items')
    .update({ is_active: false })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  revalidatePath(`/printers/${user.id}`)
  return { success: true }
}
