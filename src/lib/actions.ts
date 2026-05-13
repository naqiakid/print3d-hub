'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import type { RequestStatus, PrintType, FilamentMaterial, PrintSize } from './types'

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
  is_default: boolean
}

export async function registerPrinter(data: {
  name: string
  description: string
  printer_model: string
  printer_model_id: string
  print_types: PrintType[]
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
      materials: [],
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
  revalidatePath('/dashboard/filaments')
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
  revalidatePath('/dashboard/filaments')
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
  revalidatePath('/dashboard/filaments')
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
  stl_url?: string | null
  weight_g?: number | null
  print_hours?: number | null
}): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('requests')
    .insert(data)
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: inserted.id }
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
