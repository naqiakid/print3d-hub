import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer } from '@/lib/types'
import { PRINT_TYPE_LABELS, MATERIAL_LABELS, SIZE_LABELS } from '@/lib/types'
import AvailabilityToggle from '@/components/AvailabilityToggle'
import ListingEditor from '@/components/ListingEditor'

export default async function ListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printerData } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!printerData) redirect('/register')
  const printer = printerData as unknown as Printer

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
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
        <AvailabilityToggle printerId={printer.id} initial={printer.available} />
      </div>

      {/* View public page link */}
      <div className="mb-2 flex justify-end">
        <Link
          href={`/printers/${printer.id}`}
          className="text-xs text-orange-500 hover:text-orange-600 transition"
        >
          View public page →
        </Link>
      </div>

      {/* Editable listing details */}
      <ListingEditor printer={printer} />

      {/* Materials / specs (read-only info) */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-900">Printer specs</h3>
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
            <span className="block text-xs text-slate-400">Max size</span>
            <span className="font-medium text-slate-900">{SIZE_LABELS[printer.max_size]}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Price range</span>
            <span className="font-medium text-slate-900">RM{printer.price_min}–RM{printer.price_max}</span>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 pt-4">
          <Link
            href="/dashboard/profiles"
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Manage profiles
          </Link>
        </div>
      </div>

      {/* Filament costs (read-only) */}
      {printer.filament_costs && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-900">Filament costs</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(printer.filament_costs).map(([mat, cost]) => (
              <span key={mat} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span className="font-semibold uppercase text-slate-700">{mat}</span>
                <span className="ml-1.5 text-slate-500">RM{cost}/kg</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
