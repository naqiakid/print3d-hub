'use client'

import { useState } from 'react'
import { Calendar, FileText, MessageSquare } from 'lucide-react'
import type { PrintRequest } from '@/lib/types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRINT_TYPE_LABELS,
  MATERIAL_LABELS,
  SIZE_LABELS,
  QUALITY_LABELS,
} from '@/lib/types'

export default function RequestCard({ request }: { request: PrintRequest }) {
  const [expanded, setExpanded] = useState(false)

  const nextActions: Record<string, { label: string; color: string }[]> = {
    new: [
      { label: 'Send Quote', color: 'bg-orange-500 text-white hover:bg-orange-600' },
      { label: 'Decline', color: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
    ],
    quoted: [],
    accepted: [
      { label: 'Mark as Printing', color: 'bg-purple-500 text-white hover:bg-purple-600' },
    ],
    printing: [
      { label: 'Mark as Done', color: 'bg-teal-500 text-white hover:bg-teal-600' },
    ],
    done: [
      { label: 'Mark as Collected', color: 'bg-green-500 text-white hover:bg-green-600' },
    ],
    collected: [],
    reviewed: [],
    declined: [],
    cancelled: [],
  }

  const actions = nextActions[request.status] ?? []

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
        <div className="shrink-0 text-right text-xs text-slate-400">
          <div className="flex items-center gap-1 mb-1">
            <Calendar className="h-3.5 w-3.5" />
            Due {new Date(request.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
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
            <div>
              <span className="text-slate-400">Material</span>
              <span className="ml-2 font-medium text-slate-900">{MATERIAL_LABELS[request.material]}</span>
            </div>
            <div>
              <span className="text-slate-400">Size</span>
              <span className="ml-2 font-medium text-slate-900">{SIZE_LABELS[request.size]}</span>
            </div>
            <div>
              <span className="text-slate-400">Quality</span>
              <span className="ml-2 font-medium text-slate-900">{QUALITY_LABELS[request.quality]}</span>
            </div>
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <MessageSquare className="mb-0.5 mr-1 inline h-3.5 w-3.5 text-slate-400" />
              {request.notes}
            </div>
          )}

          {/* File */}
          {request.file_url && (
            <a
              href={request.file_url}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600"
            >
              <FileText className="h-4 w-4" /> Download file
            </a>
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

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex gap-2 pt-1">
              {actions.map(({ label, color }) => (
                <button
                  key={label}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${color}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
