import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Star, Clock, Ruler, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer } from '@/lib/types'
import {
  PRINT_TYPE_LABELS,
  PRINT_TYPE_DESCRIPTIONS,
  MATERIAL_LABELS,
  MATERIAL_DESCRIPTIONS,
  SIZE_LABELS,
} from '@/lib/types'

export default async function PrinterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.from('printers').select('*').eq('id', id).single()
  if (!data) notFound()
  const printer = data as unknown as Printer

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/printers"
        className="mb-8 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      {/* ── Header card ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{printer.name}</h1>
              <p className="mt-1 text-sm text-slate-400">{printer.printer_model}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                printer.available
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}
            >
              {printer.available ? 'Available' : 'Currently Busy'}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-white">{printer.rating}</span>
              <span className="text-slate-400">({printer.review_count} reviews)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="h-4 w-4" />
              <span>{printer.turnaround}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Ruler className="h-4 w-4" />
              <span>{SIZE_LABELS[printer.max_size]}</span>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="grid grid-cols-1 gap-8 p-8 sm:grid-cols-3">
          {/* Left — details */}
          <div className="space-y-7 sm:col-span-2">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                About
              </h2>
              <p className="leading-relaxed text-slate-700">{printer.description}</p>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                What I can print
              </h2>
              <div className="flex flex-wrap gap-2">
                {printer.print_types.map((type) => (
                  <div
                    key={type}
                    className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-orange-800">
                      {PRINT_TYPE_LABELS[type]}
                    </p>
                    <p className="text-xs text-orange-600">{PRINT_TYPE_DESCRIPTIONS[type]}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Available materials
              </h2>
              <div className="flex flex-wrap gap-2">
                {printer.materials.map((m) => (
                  <div key={m} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800">{MATERIAL_LABELS[m]}</p>
                    <p className="text-xs text-slate-500">{MATERIAL_DESCRIPTIONS[m]}</p>
                  </div>
                ))}
              </div>
            </div>

            {printer.sample_photos.length === 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Sample prints
                </h2>
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                  <p className="text-sm text-slate-400">No photos yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Right — CTA sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="mb-1 text-2xl font-bold text-slate-900">
                RM{printer.price_min}–RM{printer.price_max}
              </div>
              <p className="mb-4 text-xs text-slate-500">Price range per job</p>

              {printer.available ? (
                <Link
                  href={`/request/${printer.id}`}
                  className="flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                >
                  Request a Print
                </Link>
              ) : (
                <button
                  disabled
                  className="w-full cursor-not-allowed rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
                >
                  Currently Busy
                </button>
              )}

              <p className="mt-3 text-center text-xs text-slate-400">
                No account needed to send a request
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
              <p className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Typical turnaround: {printer.turnaround}
              </p>
              <p className="flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" /> Max size: {SIZE_LABELS[printer.max_size]}
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Payment at pickup
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reviews ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Reviews
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({printer.review_count})
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold text-slate-900">{printer.rating}</span>
          <div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i <= Math.round(printer.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-slate-200 text-slate-200'
                  }`}
                />
              ))}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Based on {printer.review_count} reviews
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Reviews will appear here after jobs are completed.
        </p>
      </div>
    </div>
  )
}
