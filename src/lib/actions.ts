'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import type { RequestStatus, PrintType, MaterialFeel, PrintSize, FilamentCosts } from './types'
import { calculatePriceRange } from './pricing'

export async function registerPrinter(data: {
  name: string
  description: string
  printer_model: string
  printer_model_id: string
  print_types: PrintType[]
  materials: MaterialFeel[]
  max_size: PrintSize
  turnaround: string
  contact_phone: string
  power_watts: number
  filament_costs: FilamentCosts
  grams_per_roll: number
  electricity_rate: number
  markup_percent: number
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { price_min, price_max } = calculatePriceRange({
    materials: data.materials,
    filament_costs: data.filament_costs,
    power_watts: data.power_watts,
    grams_per_roll: data.grams_per_roll,
    electricity_rate: data.electricity_rate,
    markup_percent: data.markup_percent,
  })

  const { error } = await supabase.from('printers').insert({
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
    filament_costs: data.filament_costs,
    grams_per_roll: data.grams_per_roll,
    electricity_rate: data.electricity_rate,
    markup_percent: data.markup_percent,
    price_min,
    price_max,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect('/dashboard')
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
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { error } = await supabase.from('requests').insert(data)
  if (error) return { error: error.message }
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

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
