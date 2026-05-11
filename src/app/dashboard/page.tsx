import Link from 'next/link'
import { Star, Package, CheckCircle, Clock } from 'lucide-react'
import { printers, mockRequests } from '@/lib/data'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import type { RequestStatus } from '@/lib/types'
import RequestCard from '@/components/RequestCard'

// For the demo, we show the first printer's data as "the logged-in owner"
const MY_PRINTER_ID = '1'

export default function DashboardPage() {
  const printer = printers.find((p) => p.id === MY_PRINTER_ID)!
  const requests = mockRequests.filter((r) => r.printer_id === MY_PRINTER_ID)

  const newCount = requests.filter((r) => r.status === 'new').length
  const activeCount = requests.filter((r) =>
    ['accepted', 'printing'].includes(r.status)
  ).length
  const doneCount = requests.filter((r) =>
    ['collected', 'reviewed'].includes(r.status)
  ).length

  const tabs: { label: string; statuses: RequestStatus[] }[] = [
    { label: 'New', statuses: ['new'] },
    { label: 'In Progress', statuses: ['quoted', 'accepted', 'printing'] },
    { label: 'Ready / Done', statuses: ['done', 'collected', 'reviewed'] },
    { label: 'All', statuses: ['new', 'quoted', 'accepted', 'printing', 'done', 'collected', 'reviewed', 'declined', 'cancelled'] },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{printer.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{printer.printer_model}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              printer.available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {printer.available ? 'Available' : 'Busy'}
          </span>
          <Link
            href="/dashboard/listing"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Edit listing
          </Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'New requests', value: newCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: Clock, label: 'In progress', value: activeCount, color: 'text-purple-600', bg: 'bg-purple-50' },
          { icon: CheckCircle, label: 'Completed', value: doneCount, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-2 inline-flex rounded-lg p-2 ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Rating ── */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        <span className="text-lg font-bold text-slate-900">{printer.rating}</span>
        <span className="text-sm text-slate-500">({printer.review_count} reviews)</span>
        <span className="ml-auto text-sm text-slate-400">
          <Link href={`/printers/${printer.id}`} className="hover:text-orange-500">
            View public listing →
          </Link>
        </span>
      </div>

      {/* ── Job Queue ── */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Job queue</h2>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const count = requests.filter((r) => tab.statuses.includes(r.status)).length
            return (
              <button
                key={tab.label}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition first:bg-slate-100"
              >
                {tab.label}
                {count > 0 && (
                  <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-600">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Request list — showing all for demo */}
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <p className="text-slate-400">No requests yet</p>
              <p className="mt-1 text-xs text-slate-300">
                Share your listing to start getting print requests
              </p>
            </div>
          ) : (
            requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
