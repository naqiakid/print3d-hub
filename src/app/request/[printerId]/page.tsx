import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Printer, PrintProfile, Filament } from '@/lib/types'
import { PRINTER_MODELS } from '@/lib/printer-models'
import RequestForm from '@/components/RequestForm'

export default async function RequestPage({
  params,
}: {
  params: Promise<{ printerId: string }>
}) {
  const { printerId } = await params
  const supabase = await createClient()

  const { data: printerData } = await supabase
    .from('printers')
    .select('*')
    .eq('id', printerId)
    .maybeSingle()

  if (!printerData) notFound()
  const printer = printerData as unknown as Printer
  const printerModelId = (printerData as Record<string, unknown>).printer_model_id as string | undefined
  const buildVolume = printerModelId
    ? (PRINTER_MODELS.find((m) => m.id === printerModelId)?.build_volume ?? null)
    : null

  const { data: profilesData } = await supabase
    .from('print_profiles')
    .select('*')
    .eq('printer_id', printerId)
    .order('is_default', { ascending: false })

  const profiles = (profilesData ?? []) as unknown as PrintProfile[]

  const { data: filamentsData } = await supabase
    .from('filaments')
    .select('*')
    .eq('owner_id', printer.owner_id)
    .eq('in_stock', true)
    .order('material')

  const filaments = (filamentsData ?? []) as unknown as Filament[]

  if (!printer.available) {
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
        <h1 className="text-2xl font-bold text-slate-900">{printer.name}</h1>
        <p className="text-sm text-slate-500">{printer.printer_model} · {printer.turnaround}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <RequestForm printer={printer} profiles={profiles} buildVolume={buildVolume} filaments={filaments} />
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        No account needed. You&apos;ll get a confirmation email with your tracking link.
      </p>
    </div>
  )
}
