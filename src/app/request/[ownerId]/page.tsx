import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, PrintProfile, Filament, RequestPrinterView } from '@/lib/types'
import { PRINTER_MODELS } from '@/lib/printer-models'
import RequestForm from '@/components/RequestForm'

export default async function RequestPage({
  params,
}: {
  params: Promise<{ ownerId: string }>
}) {
  const { ownerId } = await params
  const supabase = await createClient()

  const { data: shopData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', ownerId)
    .maybeSingle()

  if (!shopData) notFound()
  const shop = shopData as unknown as Shop

  const { data: printerRows } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
  const printers = (printerRows ?? []) as unknown as Printer[]
  if (printers.length === 0) notFound()
  const primaryPrinter = printers[0]

  const buildVolume = primaryPrinter.printer_model_id
    ? (PRINTER_MODELS.find((m) => m.id === primaryPrinter.printer_model_id)?.build_volume ?? null)
    : null

  const printerIds = printers.map((p) => p.id)
  const { data: profilesData } = await supabase
    .from('print_profiles')
    .select('*')
    .in('printer_id', printerIds)
    .order('is_default', { ascending: false })

  const profiles = (profilesData ?? []) as unknown as PrintProfile[]

  const { data: filamentsData } = await supabase
    .from('filaments')
    .select('*')
    .eq('owner_id', shop.id)
    .eq('in_stock', true)
    .order('material')

  const filaments = (filamentsData ?? []) as unknown as Filament[]

  // Combine the shop with the primary machine's cost-drivers for the live estimate.
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

  if (!shop.available) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <p className="text-4xl mb-4">😔</p>
        <h1 className="text-xl font-bold text-slate-900 mb-2">This printer is currently busy</h1>
        <p className="text-slate-500 mb-6">Check back later or find another printer near you.</p>
        <a href="/printers" className="text-sm font-medium text-orange-500 hover:text-orange-600">
          Browse other printers →
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <p className="text-sm text-slate-500 mb-1">Sending request to</p>
        <h1 className="text-2xl font-bold text-slate-900">{shop.name}</h1>
        <p className="text-sm text-slate-500">{primaryPrinter.printer_model} · {shop.turnaround}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <RequestForm printer={requestPrinter} profiles={profiles} buildVolume={buildVolume} filaments={filaments} />
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        No account needed. You&apos;ll get a confirmation email with your tracking link.
      </p>
    </div>
  )
}
