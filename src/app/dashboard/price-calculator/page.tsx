import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, Filament, RequestPrinterView } from '@/lib/types'
import PriceCalculator from '@/components/PriceCalculatorWrapper'

export default async function PriceCalculatorPage() {
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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Price Calculator</h1>
        <p className="mt-1 text-sm text-slate-500">{shop.name}</p>
        <p className="mt-3 text-sm text-slate-500 max-w-lg">
          Upload a G-code file for an accurate cost breakdown, or choose size and material for a quick rough estimate.
        </p>
      </div>

      <PriceCalculator printer={requestPrinter} filaments={filaments} />
    </div>
  )
}
