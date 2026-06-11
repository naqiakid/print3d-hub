import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PrintRequest, Printer } from '@/lib/types'
import { STATUS_LABELS, MATERIAL_LABELS, SIZE_LABELS, QUALITY_LABELS } from '@/lib/types'
import { formatRM } from '@/lib/pricing'
import QuoteActions from '@/components/QuoteActions'
import STLViewer from '@/components/STLViewerWrapper'
import GcodeViewer from '@/components/GcodeViewerWrapper'

const TIMELINE: { status: string; label: string }[] = [
  { status: 'new',       label: 'Request received' },
  { status: 'quoted',    label: 'Quote sent' },
  { status: 'accepted',  label: 'Accepted' },
  { status: 'printing',  label: 'Printing' },
  { status: 'done',      label: 'Ready for pickup' },
  { status: 'collected', label: 'Collected' },
]

const TERMINAL_NEGATIVE = ['declined', 'cancelled']

function stepIndex(status: string) {
  return TIMELINE.findIndex((s) => s.status === status)
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const supabase = await createClient()

  const { data: reqData } = await supabase
    .from('requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (!reqData) notFound()
  const request = reqData as unknown as PrintRequest

  const { data: printerData } = await supabase
    .from('printers')
    .select('name, contact_phone, turnaround, pickup_address')
    .eq('id', request.printer_id)
    .maybeSingle()

  const printer = printerData as Pick<Printer, 'name' | 'contact_phone' | 'turnaround' | 'pickup_address'> | null

  const isNegative = TERMINAL_NEGATIVE.includes(request.status)
  const currentStep = stepIndex(request.status)

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-slate-500 mb-1">Order tracking</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNegative ? STATUS_LABELS[request.status] : 'Your print is on the way'}
        </h1>
        {printer && (
          <p className="text-sm text-slate-500 mt-1">
            {printer.name} · Turnaround {printer.turnaround}
          </p>
        )}
      </div>

      {/* Status timeline */}
      {!isNegative ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="space-y-0">
            {TIMELINE.map((step, i) => {
              const done = currentStep >= i
              const active = currentStep === i
              const isLast = i === TIMELINE.length - 1
              return (
                <div key={step.status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                        active
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                          : done
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {done && !active ? '✓' : i + 1}
                    </div>
                    {!isLast && (
                      <div className={`mt-1 w-0.5 flex-1 min-h-[24px] ${done ? 'bg-green-300' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className="pb-6 pt-0.5">
                    <p className={`text-sm font-medium ${active ? 'text-orange-600' : done ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    {active && request.status === 'quoted' && request.quoted_price && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatRM(request.quoted_price)} · Ready by{' '}
                        {request.quoted_by_date &&
                          new Date(request.quoted_by_date).toLocaleDateString('en-MY', {
                            weekday: 'short', day: 'numeric', month: 'short',
                          })}
                      </p>
                    )}
                    {active && request.status === 'done' && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {request.fulfillment === 'delivery'
                          ? 'Your print is ready — the owner will arrange delivery to your address.'
                          : `Your print is ready — contact the owner to arrange pickup.${printer?.pickup_address ? ` (${printer.pickup_address})` : ''}`}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          {request.status === 'declined'
            ? 'The owner was unable to take this job. Try another printer.'
            : 'This request was cancelled.'}
        </div>
      )}

      {/* Quote card */}
      {request.quoted_price && (
        <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-xs font-medium text-amber-700 mb-2">Quote from {printer?.name}</p>
          <p className="text-2xl font-bold text-amber-900">{formatRM(request.quoted_price)}</p>
          {request.quoted_by_date && (
            <p className="text-sm text-amber-700 mt-1">
              Ready by{' '}
              {new Date(request.quoted_by_date).toLocaleDateString('en-MY', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </p>
          )}

          {/* Filament chips + STL fallback — only when there is no G-code yet */}
          {(request.stl_urls?.length > 0 || request.stl_url) && (request.gcode_urls?.length ?? 0) === 0 && (
            <div className="mt-3">
              {(request.plate_filaments?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {request.plate_filaments.map((pf, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-slate-200"
                        style={{ background: pf.color_hex || '#888' }}
                      />
                      {request.plate_filaments.length > 1 && `Plate ${i + 1} · `}
                      {MATERIAL_LABELS[pf.material]}
                      {pf.color && ` · ${pf.color}`}
                    </span>
                  ))}
                </div>
              )}
              <STLViewer
                urls={request.stl_urls?.length > 0 ? request.stl_urls : [request.stl_url!]}
                colors={
                  (request.plate_filaments?.length ?? 0) > 0
                    ? request.plate_filaments.map((pf) => pf.color_hex || '#888888')
                    : ['#e0e0e0']
                }
                className="h-64 w-full"
              />
            </div>
          )}

          {/* G-code viewer + stats */}
          {(request.gcode_urls?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-2">
              {/* Stats row */}
              {(request.weight_g || request.print_hours) && (
                <div className="rounded-xl border border-teal-100 bg-white px-3 py-2">
                  <p className="text-xs font-medium text-teal-600 mb-1">
                    Sliced &amp; ready · {request.gcode_urls.length} plate{request.gcode_urls.length > 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-teal-900">
                    {request.weight_g && <span className="font-medium">~{request.weight_g}g filament</span>}
                    {request.print_hours && (
                      <span className="font-medium">
                        ~{(() => {
                          const h = request.print_hours
                          const hrs = Math.floor(h)
                          const mins = Math.round((h - hrs) * 60)
                          return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
                        })()} print time
                      </span>
                    )}
                  </div>
                </div>
              )}
              {/* G-code 3D viewer */}
              <GcodeViewer
                urls={request.gcode_urls}
                colors={(request.plate_filaments ?? []).map((pf) => pf.color_hex || '#cccccc')}
              />
            </div>
          )}

          {request.quote_message && (
            <p className="mt-3 text-sm text-amber-800 border-t border-amber-200 pt-2">
              &ldquo;{request.quote_message}&rdquo;
            </p>
          )}
          {request.status === 'quoted' && (
            <div className="mt-4 border-t border-amber-200 pt-4">
              <QuoteActions requestId={requestId} />
            </div>
          )}
        </div>
      )}

      {/* Order summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Order summary</h2>
        <p className="text-sm text-slate-600">{request.description}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div>
            <span className="text-slate-400">Material</span>
            <span className="ml-2 font-medium text-slate-900">{MATERIAL_LABELS[request.material]}</span>
          </div>
          <div>
            <span className="text-slate-400">Quality</span>
            <span className="ml-2 font-medium text-slate-900">{QUALITY_LABELS[request.quality]}</span>
          </div>
          <div>
            <span className="text-slate-400">Size</span>
            <span className="ml-2 font-medium text-slate-900">{SIZE_LABELS[request.size]}</span>
          </div>
          <div>
            <span className="text-slate-400">Deadline</span>
            <span className="ml-2 font-medium text-slate-900">
              {new Date(request.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-400">Fulfillment</span>
            <span className="ml-2 font-medium text-slate-900">
              {request.fulfillment === 'delivery'
                ? `🚚 Delivery${request.delivery_address ? ` — ${request.delivery_address}` : ''}`
                : `🏠 Pickup${printer?.pickup_address ? ` — ${printer.pickup_address}` : ''}`}
            </span>
          </div>
          {request.weight_g && (
            <div>
              <span className="text-slate-400">Weight</span>
              <span className="ml-2 font-medium text-slate-900">~{request.weight_g}g</span>
            </div>
          )}
          {request.print_hours && (
            <div>
              <span className="text-slate-400">Print time</span>
              <span className="ml-2 font-medium text-slate-900">~{request.print_hours}h</span>
            </div>
          )}
        </div>
        {/* STL file links */}
        {(request.stl_urls?.length > 0 || request.stl_url) && (
          <div className="border-t border-slate-100 pt-2 flex flex-wrap gap-3">
            {(request.stl_urls?.length > 0
              ? request.stl_urls
              : [request.stl_url!]
            ).map((url, i) => (
              <Link
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-orange-500 hover:text-orange-600"
              >
                {request.stl_urls?.length > 1 ? `File ${i + 1}` : 'View STL'} ↗
              </Link>
            ))}
          </div>
        )}
        {request.notes && (
          <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">
            Notes: {request.notes}
          </p>
        )}
      </div>

      {/* Contact */}
      {printer?.contact_phone && (
        <div className="mt-4 text-center text-xs text-slate-400">
          Questions? Contact {printer.name} on{' '}
          <a href={`https://wa.me/${printer.contact_phone.replace(/\D/g, '')}`} className="text-orange-500 hover:text-orange-600 font-medium">
            WhatsApp
          </a>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-slate-300">
        Order #{requestId.slice(0, 8).toUpperCase()}
      </p>
    </div>
  )
}
