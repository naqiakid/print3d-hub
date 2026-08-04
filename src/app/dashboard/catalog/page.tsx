import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, CatalogItem, Filament, RequestPrinterView } from '@/lib/types'
import CatalogManager from '@/components/CatalogManagerWrapper'

export default async function CatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shopData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!shopData) redirect('/login')
  const shop = shopData as unknown as Shop

  const { data: printerRows } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (!printerRows || printerRows.length === 0) redirect('/dashboard')
  const primaryPrinter = printerRows[0] as unknown as Printer

  const { data: itemData } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const items = (itemData ?? []) as unknown as CatalogItem[]

  const { data: filamentData } = await supabase
    .from('filaments')
    .select('*')
    .eq('owner_id', user.id)
    .eq('in_stock', true)
    .order('material')
    .order('color')

  const filaments = (filamentData ?? []) as unknown as Filament[]

  const requestPrinter: RequestPrinterView = {
    ...shop,
    printer_model: primaryPrinter.printer_model,
    printer_model_id: primaryPrinter.printer_model_id,
    filament_costs: primaryPrinter.filament_costs,
    power_watts: primaryPrinter.power_watts,
    machine_rate_per_hour: primaryPrinter.machine_rate_per_hour,
    bed_type: primaryPrinter.bed_type,
    grams_per_roll: primaryPrinter.grams_per_roll,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <CatalogManager
        initialItems={items}
        printer={requestPrinter}
        filaments={filaments}
      />
    </div>
  )
}
