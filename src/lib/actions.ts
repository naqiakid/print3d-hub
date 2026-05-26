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
  infill_draft: number
  infill_standard: number
  infill_premium: number
  supports_available: boolean
  ironing_available: boolean
  color_change_available: boolean
  pause_insert_available: boolean
  fuzzy_skin_available: boolean
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
    infill_draft: number
    infill_standard: number
    infill_premium: number
    supports_available: boolean
    ironing_available: boolean
    color_change_available: boolean
    pause_insert_available: boolean
    fuzzy_skin_available: boolean
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

type ProfileInput = {
  name: string
  nozzle_mm: number
  infill_draft: number
  infill_standard: number
  infill_premium: number
  supports_available: boolean
  ironing_available: boolean
  color_change_available: boolean
  pause_insert_available: boolean
  fuzzy_skin_available: boolean
  is_default: boolean
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
  profiles: ProfileInput[]
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
      price_min: 0,
      price_max: 0,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const anyDefault = data.profiles.some((p) => p.is_default)
  const profilesPayload = data.profiles.map((p, i) => ({
    ...p,
    printer_id: printer.id,
    is_default: anyDefault ? p.is_default : i === 0,
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
  revalidatePath('/dashboard/filaments')
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
  revalidatePath('/dashboard/filaments')
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
  revalidatePath('/dashboard/filaments')
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
  stl_url?: string | null
  weight_g?: number | null
  print_hours?: number | null
  profile_id?: string | null
  selected_addons?: string[]
}): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('requests')
    .insert(data)
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

export async function updateListing(data: {
  printer_id: string
  name: string
  description: string
  turnaround: string
  contact_phone: string
  electricity_rate: number
  markup_percent: number
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
             <p>To confirm this quote, contact the owner via WhatsApp or reply to this email.</p>
             <p>Track your order: <a href="${trackingUrl}">${trackingUrl}</a></p>`,
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
