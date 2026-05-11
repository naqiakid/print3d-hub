import { notFound } from 'next/navigation'
import { getPrinterById, printers } from '@/lib/data'
import RequestForm from '@/components/RequestForm'

export function generateStaticParams() {
  return printers.map((p) => ({ printerId: p.id }))
}

export default async function RequestPage({
  params,
}: {
  params: Promise<{ printerId: string }>
}) {
  const { printerId } = await params
  const printer = getPrinterById(printerId)
  if (!printer) notFound()

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
        <RequestForm printer={printer} />
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        No account needed. The owner will reply to your email with a quote.
      </p>
    </div>
  )
}
