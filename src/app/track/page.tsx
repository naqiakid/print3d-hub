import Link from 'next/link'
import { Package, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { STATUS_LABELS, type RequestStatus, getStatusLabel } from '@/lib/types'
import { formatRM } from '@/lib/pricing'

type RequestRow = {
  id: string
  created_at: string
  status: string
  description: string
  quoted_price: number | null
  fulfillment: 'pickup' | 'delivery'
  printers: { name: string } | null
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  new:       'bg-slate-100 text-slate-600',
  quoted:    'bg-amber-100 text-amber-700',
  accepted:  'bg-blue-100 text-blue-700',
  printing:  'bg-indigo-100 text-indigo-700',
  done:      'bg-green-100 text-green-700',
  shipping:  'bg-blue-100 text-blue-700',
  collected: 'bg-green-100 text-green-700',
  reviewed:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
}

export default async function TrackLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  const trimmedEmail = email?.trim().toLowerCase() ?? ''

  let requests: RequestRow[] = []
  let queried = false

  if (trimmedEmail) {
    queried = true
    const supabase = await createClient()
    const { data } = await supabase
      .from('requests')
      .select('id, created_at, status, description, quoted_price, fulfillment, printers(name)')
      .eq('customer_email', trimmedEmail)
      .order('created_at', { ascending: false })
    requests = (data ?? []) as unknown as RequestRow[]
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
          <Package className="h-6 w-6 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Track your orders</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter the email address you used when placing your request.
        </p>
      </div>

      <form method="GET" action="/track" className="mb-8 flex gap-2">
        <input
          name="email"
          type="email"
          required
          defaultValue={email}
          placeholder="your@email.com"
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
        >
          <Search className="h-4 w-4" />
          Look up
        </button>
      </form>

      {queried && requests.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No orders found</p>
          <p className="mt-1 text-xs text-slate-400">
            No requests submitted with <span className="font-medium">{trimmedEmail}</span>.
            <br />
            Check you used the same email when placing your order.
          </p>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            {requests.length} order{requests.length !== 1 ? 's' : ''} for {trimmedEmail}
          </p>
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/track/${req.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">
                    {req.printers?.name ?? 'Unknown printer'} ·{' '}
                    {new Date(req.created_at).toLocaleDateString('en-MY', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm font-medium text-slate-900 line-clamp-1">{req.description}</p>
                  {req.quoted_price && (
                    <p className="mt-0.5 text-xs text-slate-500">Quote: {formatRM(req.quoted_price)}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[req.status as RequestStatus] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {getStatusLabel(req.status as RequestStatus, req.fulfillment) ?? req.status}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-orange-500">View details →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
