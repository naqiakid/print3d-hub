'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import type { RequestStatus, PrintType, MaterialFeel, PrintSize } from './types'

export async function registerPrinter(data: {
  name: string
  description: string
  printer_model: string
  print_types: PrintType[]
  materials: MaterialFeel[]
  max_size: PrintSize
  price_min: number
  price_max: number
  turnaround: string
  contact_phone: string
}): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('printers').insert({
    owner_id: user.id,
    ...data,
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
