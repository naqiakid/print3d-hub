import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer, Filament } from '@/lib/types'
import PriceCalculator from '@/components/PriceCalculator'

export default async function PriceCalculatorPage({
  params,
}: {
  params: Promise<{ printerId: string }>
}) {
  const { printerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printerData } = await supabase
    .from('printers')
    .select('*')
    .eq('id', printerId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!printerData) redirect('/dashboard')
  const printer = printerData as unknown as Printer

  const { data: filamentData } = await supabase
    .from('filaments')
    .select('*')
    .eq('owner_id', user.id)
    .eq('in_stock', true)
    .order('material')
    .order('color')

  const filaments = (filamentData ?? []) as unknown as Filament[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/dashboard/${printer.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Price Calculator</h1>
        <p className="mt-1 text-sm text-slate-500">{printer.name} · {printer.printer_model}</p>
        <p className="mt-3 text-sm text-slate-500 max-w-lg">
          Upload a G-code file for an accurate cost breakdown, or choose size and material for a quick rough estimate.
        </p>
      </div>

      <PriceCalculator printer={printer} filaments={filaments} />
    </div>
  )
}
