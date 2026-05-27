'use client'

import { useState, useTransition } from 'react'
import { Calendar, FileText, MessageSquare } from 'lucide-react'
import type { PrintRequest, RequestStatus, Printer } from '@/lib/types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRINT_TYPE_LABELS,
  MATERIAL_LABELS,
  SIZE_LABELS,
  QUALITY_LABELS,
} from '@/lib/types'
import { updateRequestStatus, sendQuote } from '@/lib/actions'
import { calculateEstimate, formatRM } from '@/lib/pricing'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

export default function RequestCard({ request, printer }: { request: PrintRequest; printer: Printer }) {
  const [expanded, setExpanded] = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteDate, setQuoteDate] = useState('')
  const [quoteMessage, setQuoteMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [isPending, startTransition] = useTransition()

  const estimate =
    printer.filament_costs && printer.filament_costs[request.material]
      ? calculateEstimate({
          size: request.size,
          quality: request.quality,
          material: request.material,
          power_watts: printer.power_watts ?? 150,
          cost_per_kg: printer.filament_costs[request.material]!,
          electricity_rate: printer.electricity_rate ?? 0.57,
          markup_percent: printer.markup_percent ?? 30,
        })
      : null

  const [quotePrice, setQuotePrice] = useState(
    estimate ? String(estimate.suggested_price) : '',
  )

  function handleStatusUpdate(newStatus: RequestStatus) {
    setActionError('')
    startTransition(async () => {
      const result = await updateRequestStatus(request.id, newStatus)
      if (result?.error) setActionError(result.error)
    })
  }

  function handleSendQuote() {
    if (!quotePrice || !quoteDate) return
    setActionError('')
    startTransition(async () => {
      const result = await sendQuote(request.id, Number(quotePrice), quoteDate, quoteMessage)
      if (result?.error) setActionError(result.error)
      else setShowQuoteForm(false)
    })
  }

  const TERMINAL = new Set<RequestStatus>(['collected', 'declined', 'cancelled', 'reviewed'])
  const daysUntilDeadline = Math.ceil(
    (new Date(request.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const isUrgent = !TERMINAL.has(request.status) && daysUntilDeadline <= 2

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${isUrgent ? 'border-red-300' : 'border-slate-200'}`}>
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900 truncate">{request.customer_name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[request.status]}`}>
              {STATUS_LABELS[request.status]}
            </span>
          </div>
          <p className="text-sm text-slate-500 truncate">{request.description}</p>
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className={`flex items-center gap-1 mb-1 ${isUrgent ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            <Calendar className="h-3.5 w-3.5" />
            {isUrgent && daysUntilDeadline <= 0 ? 'Overdue!' : isUrgent ? `${daysUntilDeadline}d left` : `Due ${new Date(request.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}`}
          </div>
          {request.quoted_price && (
            <div className="font-semibold text-slate-900">RM{request.quoted_price}</div>
          )}
        </div>
        <span className="text-slate-300 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Specs */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div>
              <span className="text-slate-400">Print type</span>
              <span className="ml-2 font-medium text-slate-900">{PRINT_TYPE_LABELS[request.print_type]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Material</span>
              <span className="font-medium text-slate-900">{MATERIAL_LABELS[request.material]}</span>
              {request.color && (
                <>
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-slate-200 shadow-sm"
                    style={{ background: request.color_hex || '#888' }}
                  />
                  <span className="text-slate-500">{request.color}</span>
                </>
              )}
            </div>
            <div>
              <span className="text-slate-400">Size</span>
              <span className="ml-2 font-medium text-slate-900">{SIZE_LABELS[request.size]}</span>
            </div>
            <div>
              <span className="text-slate-400">Quality</span>
              <span className="ml-2 font-medium text-slate-900">{QUALITY_LABELS[request.quality]}</span>
            </div>
            {(request.supports || request.selected_addons?.length > 0) && (
              <div className="col-span-2 flex flex-wrap gap-1.5">
                {request.supports && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Supports</span>
                )}
                {request.selected_addons?.filter((a) => a !== 'supports').map((addon) => {
                  const ADDON_LABELS: Record<string, string> = {
                    ironing: 'Ironing',
                    color_change: 'Color change',
                    pause_insert: 'Embedded insert',
                    fuzzy_skin: 'Fuzzy skin',
                  }
                  return (
                    <span key={addon} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {ADDON_LABELS[addon] ?? addon}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <MessageSquare className="mb-0.5 mr-1 inline h-3.5 w-3.5 text-slate-400" />
              {request.notes}
            </div>
          )}

          {/* STL slice data */}
          {(request.weight_g || request.print_hours) && (
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
              {request.weight_g && <span>~{request.weight_g}g filament</span>}
              {request.weight_g && request.print_hours && <span className="text-slate-300">·</span>}
              {request.print_hours && <span>~{request.print_hours}h print time</span>}
              <span className="ml-auto text-slate-400">from STL</span>
            </div>
          )}

          {/* Files */}
          {(request.stl_urls?.length > 0 || request.stl_url || request.file_url) && (
            <div className="flex flex-wrap gap-2">
              {(request.stl_urls?.length > 0
                ? request.stl_urls
                : [request.stl_url ?? request.file_url ?? '']
              ).map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600"
                >
                  <FileText className="h-4 w-4" />
                  {request.stl_urls?.length > 1 ? `File ${i + 1}` : 'Download STL'}
                </a>
              ))}
            </div>
          )}

          {/* Quote info */}
          {request.quoted_price && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm">
              <p className="font-medium text-amber-900">
                Quote sent: RM{request.quoted_price} · Ready by{' '}
                {request.quoted_by_date &&
                  new Date(request.quoted_by_date).toLocaleDateString('en-MY', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
              </p>
              {request.quote_message && (
                <p className="mt-1 text-amber-700">{request.quote_message}</p>
              )}
            </div>
          )}

          {/* Contact */}
          <div className="text-xs text-slate-400">
            {request.customer_email} · {request.customer_phone}
          </div>

          {/* Inline quote form */}
          {showQuoteForm && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-800">Send a quote</p>
              {estimate && (
                <div className="rounded-lg bg-white border border-orange-100 px-3 py-2 text-xs text-slate-500 space-y-0.5">
                  <p>Filament: ~{estimate.weight_g}g · {formatRM(estimate.filament_cost)}</p>
                  <p>Electricity: ~{estimate.hours}h · {formatRM(estimate.electricity_cost)}</p>
                  <p className="font-medium text-slate-700">
                    Base: {formatRM(estimate.base_cost)} → Suggested: {formatRM(estimate.suggested_price)}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Price (RM)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="35"
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Ready by</label>
                  <input
                    type="date"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Message (optional)</label>
                <input
                  type="text"
                  placeholder="Any notes for the customer..."
                  value={quoteMessage}
                  onChange={(e) => setQuoteMessage(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSendQuote}
                  disabled={!quotePrice || !quoteDate || isPending}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
                >
                  {isPending ? 'Sending...' : 'Send Quote'}
                </button>
                <button
                  onClick={() => setShowQuoteForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {actionError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{actionError}</p>
          )}

          {/* Action buttons */}
          {!showQuoteForm && (
            <div className="flex gap-2 pt-1">
              {request.status === 'new' && (
                <>
                  <button
                    onClick={() => {
                      setQuotePrice(estimate ? String(estimate.suggested_price) : '')
                      setShowQuoteForm(true)
                    }}
                    disabled={isPending}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    Send Quote
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('declined')}
                    disabled={isPending}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    {isPending ? '...' : 'Decline'}
                  </button>
                </>
              )}
              {request.status === 'quoted' && (
                <button
                  onClick={() => handleStatusUpdate('accepted')}
                  disabled={isPending}
                  className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
                >
                  {isPending ? '...' : 'Customer Confirmed'}
                </button>
              )}
              {request.status === 'accepted' && (
                <button
                  onClick={() => handleStatusUpdate('printing')}
                  disabled={isPending}
                  className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-600 disabled:opacity-50"
                >
                  {isPending ? '...' : 'Mark as Printing'}
                </button>
              )}
              {request.status === 'printing' && (
                <button
                  onClick={() => handleStatusUpdate('done')}
                  disabled={isPending}
                  className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
                >
                  {isPending ? '...' : 'Mark as Done'}
                </button>
              )}
              {request.status === 'done' && (
                <button
                  onClick={() => handleStatusUpdate('collected')}
                  disabled={isPending}
                  className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
                >
                  {isPending ? '...' : 'Mark as Collected'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
