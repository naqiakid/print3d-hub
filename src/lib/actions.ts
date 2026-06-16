'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import type { RequestStatus, PrintType, FilamentMaterial, PrintSize } from './types'

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
  printer_name: string
}) {
  const toEmail = process.env.NOTIFICATION_EMAIL
  if (!toEmail) return
  await sendEmail(
    toEmail,
    `New print request from ${data.customer_name}`,
    `<h2>New request on ${data.printer_name}</h2>
     <p><strong>From:</strong> ${data.customer_name} (${data.customer_email} · ${data.customer_phone})</p>
     <p><strong>Description:</strong> ${data.description}</p>
     <p><strong>Material:</strong> ${data.material.toUpperCase()}</p>
     <p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
     <p><a href="${APP_URL}/dashboard">Open dashboard →</a></p>`,
  )
}

// ─── Print Profile CRUD ─────────────────────────────────────

export async function createProfile(data: {
  printer_id: string
  name: string
  nozzle_mm: number
  infill_basic: number
  wall_count_basic: number
  advanced_available: boolean
  infill_advanced: number
  wall_count_advanced: number
  supports_available: boolean
  ironing_available: boolean
  color_change_available: boolean
  pause_insert_available: boolean
  fuzzy_skin_available: boolean
  text_on_surface_available: boolean
  is_default: boolean
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (data.is_default) {
    await supabase
      .from('print_profiles')
      .update({ is_default: false })
      .eq('printer_id', data.printer_id)
  }

  const { error } = await supabase.from('print_profiles').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/profiles')
}

export async function updateProfile(
  id: string,
  printer_id: string,
  data: {
    name: string
    nozzle_mm: number
    infill_basic: number
    wall_count_basic: number
    advanced_available: boolean
    infill_advanced: number
    wall_count_advanced: number
    supports_available: boolean
    ironing_available: boolean
    color_change_available: boolean
    pause_insert_available: boolean
    fuzzy_skin_available: boolean
    text_on_surface_available: boolean
    is_default: boolean
  }
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (data.is_default) {
    await supabase
      .from('print_profiles')
      .update({ is_default: false })
      .eq('printer_id', printer_id)
  }

  const { error } = await supabase
    .from('print_profiles')
    .update(data)
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/profiles')
}

export async function deleteProfile(id: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('print_profiles').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/profiles')
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

  const { data: printer, error } = await supabase
    .from('printers')
    .insert({
      owner_id: user.id,
      name: data.name,
      description: data.description,
      printer_model: data.printer_model,
      print_types: data.print_types,
      materials: data.materials,
      max_size: data.max_size,
      turnaround: data.turnaround,
      contact_phone: data.contact_phone,
      power_watts: data.power_watts,
      electricity_rate: data.electricity_rate,
      markup_percent: data.markup_percent,
      machine_rate_per_hour: data.machine_rate_per_hour,
      waste_percent: data.waste_percent,
      bed_type: data.bed_type,
      pickup_address: data.pickup_address ?? null,
      price_min: 0,
      price_max: 0,
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
    advanced_available: false,
    infill_advanced: 40,
    wall_count_advanced: 5,
    supports_available: true,
    ironing_available: false,
    color_change_available: data.print_types.includes('colorful'),
    pause_insert_available: false,
    fuzzy_skin_available: false,
    is_default: nozzle === defaultNozzle,
  }))

  const { error: profileError } = await supabase
    .from('print_profiles')
    .insert(profilesPayload)

  if (profileError) return { error: profileError.message }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

// ─── Filament CRUD ──────────────────────────────────────────

async function syncFilamentCosts(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string) {
  const { data: filaments } = await supabase
    .from('filaments')
    .select('material, cost_per_kg')
    .eq('owner_id', ownerId)
    .eq('in_stock', true)

  if (!filaments) return

  // Take cheapest in-stock cost per material
  const costs: Record<string, number> = {}
  for (const f of filaments) {
    if (!(f.material in costs) || f.cost_per_kg < costs[f.material]) {
      costs[f.material] = f.cost_per_kg
    }
  }

  const { data: printerRow } = await supabase
    .from('printers')
    .select('id')
    .eq('owner_id', ownerId)
    .limit(1)
    .maybeSingle()

  if (printerRow) {
    await supabase
      .from('printers')
      .update({ filament_costs: Object.keys(costs).length ? costs : null })
      .eq('id', printerRow.id)
  }
}

export async function createFilament(data: {
  material: FilamentMaterial
  brand: string
  color: string
  color_hex: string
  cost_per_kg: number
  in_stock: boolean
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('filaments').insert({ ...data, owner_id: user.id })
  if (error) return { error: error.message }
  await syncFilamentCosts(supabase, user.id)
  revalidatePath('/dashboard/equipment')
  revalidatePath('/dashboard/listing')
}

export async function updateFilament(
  id: string,
  data: {
    material: FilamentMaterial
    brand: string
    color: string
    color_hex: string
    cost_per_kg: number
    in_stock: boolean
  },
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
  await syncFilamentCosts(supabase, user.id)
  revalidatePath('/dashboard/equipment')
  revalidatePath('/dashboard/listing')
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
  await syncFilamentCosts(supabase, user.id)
  revalidatePath('/dashboard/equipment')
  revalidatePath('/dashboard/listing')
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
  printer_id: string
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
}): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()

  // Strip optional columns that may not exist yet if migrations haven't run
  const { color_preferences, fulfillment, delivery_address, declined_addons, catalog_item_id, ...baseData } = data
  const insertPayload = {
    ...baseData,
    ...(color_preferences?.length ? { color_preferences } : {}),
    ...(fulfillment ? { fulfillment } : {}),
    ...(delivery_address ? { delivery_address } : {}),
    ...(declined_addons?.length ? { declined_addons } : {}),
    ...(catalog_item_id ? { catalog_item_id } : {}),
  }

  const { data: inserted, error } = await supabase
    .from('requests')
    .insert(insertPayload)
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Fire-and-forget emails
  supabase
    .from('printers')
    .select('name')
    .eq('id', data.printer_id)
    .single()
    .then(({ data: printer }) => {
      const printerName = printer?.name ?? 'your printer'
      const trackingUrl = `${APP_URL}/track/${inserted.id}`

      sendOwnerNotification({
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        description: data.description,
        material: data.material,
        deadline: data.deadline,
        printer_name: printerName,
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
  printer_id: string
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

  const { printer_id, ...fields } = data
  const { error } = await supabase
    .from('printers')
    .update(fields)
    .eq('id', printer_id)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/listing')
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
  revalidatePath('/dashboard')
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
  plateFilaments?: { material: string; color: string; color_hex: string }[],
  confirmedAddons?: string[],
  deliveryCost?: number | null,
  stlUrlsToMerge?: string[],
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
    })
    .eq('id', requestId)

  if (error) return { error: error.message }

  // Fire-and-forget quote email to customer
  supabase
    .from('requests')
    .select('customer_name, customer_email, printer_id')
    .eq('id', requestId)
    .single()
    .then(({ data: req }) => {
      if (!req) return
      supabase
        .from('printers')
        .select('name')
        .eq('id', req.printer_id)
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
  printerId: string,
  available: boolean,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('printers')
    .update({ available })
    .eq('id', printerId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/listing')
}

export async function acceptQuote(
  requestId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()

  const { data: req, error: fetchError } = await supabase
    .from('requests')
    .select('status, customer_name, printer_id')
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
      .from('printers')
      .select('name')
      .eq('id', req.printer_id)
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
    .select('status, customer_name, printer_id')
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
      .from('printers')
      .select('name')
      .eq('id', req.printer_id)
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
  revalidatePath('/dashboard/equipment')
}

export async function addNozzleSize(
  printerId: string,
  nozzleMm: number,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('print_profiles').insert({
    printer_id: printerId,
    name: `${nozzleMm}mm nozzle`,
    nozzle_mm: nozzleMm,
    infill_basic: 15,
    wall_count_basic: 3,
    advanced_available: false,
    infill_advanced: 40,
    wall_count_advanced: 5,
    supports_available: true,
    ironing_available: false,
    color_change_available: false,
    pause_insert_available: false,
    fuzzy_skin_available: false,
    is_default: false,
    is_active: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/equipment')
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
  revalidatePath('/dashboard/equipment')
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
  revalidatePath('/dashboard/equipment')
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
  revalidatePath('/dashboard/equipment')
  revalidatePath('/dashboard/listing')
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
  base_price?: number | null
}

export async function createCatalogItem(
  printerId: string,
  data: CatalogItemData,
): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: inserted, error } = await supabase
    .from('catalog_items')
    .insert({ printer_id: printerId, ...data })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/catalog')
  revalidatePath(`/printers/${printerId}`)
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
  revalidatePath('/dashboard/catalog')
  return { success: true }
}

export async function deleteCatalogItem(
  itemId: string,
  printerId: string,
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('catalog_items')
    .update({ is_active: false })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/catalog')
  revalidatePath(`/printers/${printerId}`)
  return { success: true }
}
