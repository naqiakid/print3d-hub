import Link from 'next/link'
import { ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react'
import { printers } from '@/lib/data'
import { PRINT_TYPE_LABELS, MATERIAL_LABELS, SIZE_LABELS } from '@/lib/types'

const MY_PRINTER_ID = '1'

export default function ListingPage() {
  const printer = printers.find((p) => p.id === MY_PRINTER_ID)!

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-slate-900">Manage Listing</h1>

      {/* Availability toggle */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="font-semibold text-slate-900">Availability</p>
          <p className="text-sm text-slate-500">
            {printer.available
              ? 'Customers can see and request from you'
              : 'Your listing is hidden from customers'}
          </p>
        </div>
        <button className="transition hover:opacity-80">
          {printer.available ? (
            <ToggleRight className="h-10 w-10 text-green-500" />
          ) : (
            <ToggleLeft className="h-10 w-10 text-slate-300" />
          )}
        </button>
      </div>

      {/* Listing preview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{printer.name}</h2>
            <p className="text-sm text-slate-500">{printer.printer_model}</p>
          </div>
          <Link
            href={`/printers/${printer.id}`}
            className="text-xs text-orange-500 hover:text-orange-600"
          >
            View public page →
          </Link>
        </div>

        <p className="text-sm text-slate-600">{printer.description}</p>

        <div className="space-y-2 text-sm">
          <div className="flex gap-2 flex-wrap">
            {printer.print_types.map((t) => (
              <span key={t} className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                {PRINT_TYPE_LABELS[t]}
              </span>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {printer.materials.map((m) => (
              <span key={m} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {MATERIAL_LABELS[m]}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-4">
          <div>
            <span className="text-slate-400 block text-xs">Max size</span>
            <span className="font-medium text-slate-900">{SIZE_LABELS[printer.max_size]}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Price range</span>
            <span className="font-medium text-slate-900">RM{printer.price_min}–RM{printer.price_max}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Turnaround</span>
            <span className="font-medium text-slate-900">{printer.turnaround}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">WhatsApp</span>
            <span className="font-medium text-slate-900">{printer.contact_phone}</span>
          </div>
        </div>

        <button className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
          Edit details
        </button>
      </div>
    </div>
  )
}
