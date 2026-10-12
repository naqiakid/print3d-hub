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
  new:       'border border-neutral-700 bg-neutral-900 text-neutral-300',
  quoted:    'border border-amber-500/30 bg-amber-950/40 text-amber-300',
  accepted:  'border border-blue-500/30 bg-blue-950/40 text-blue-300',
  printing:  'border border-purple-500/30 bg-purple-950/40 text-purple-300',
  done:      'border border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
  shipping:  'border border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
  collected: 'border border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
  reviewed:  'border border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
  declined:  'border border-rose-500/30 bg-rose-950/40 text-rose-300',
  cancelled: 'border border-neutral-800 bg-neutral-950 text-neutral-500',
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
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-orange-400 shadow-xl">
          <Package className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Track Order Status</h1>
        <p className="mt-1.5 text-xs text-neutral-400">
          Enter the email address you used when requesting your 3D print quote.
        </p>
      </div>

      <form method="GET" action="/track" className="mb-8 flex gap-2">
        <input
          name="email"
          type="email"
          required
          defaultValue={email}
          placeholder="your@email.com"
          className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-600 transition"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition cursor-pointer shadow-lg"
        >
          <Search className="h-3.5 w-3.5" />
          Look up
        </button>
      </form>

      {queried && requests.length === 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-6 py-10 text-center">
          <p className="text-xs font-medium text-neutral-300">No orders found</p>
          <p className="mt-1 text-[11px] text-neutral-500">
            No print requests associated with <span className="font-mono text-neutral-400">{trimmedEmail}</span>.
            <br />
            Ensure you entered the exact email address used at submission.
          </p>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
            {requests.length} order{requests.length !== 1 ? 's' : ''} found
          </p>
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/track/${req.id}`}
              className="block rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 hover:border-neutral-700 hover:bg-neutral-900 transition shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-neutral-400 mb-1">
                    {req.printers?.name ?? 'Studio Core'} ·{' '}
                    {new Date(req.created_at).toLocaleDateString('en-MY', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs font-medium text-white line-clamp-1">{req.description}</p>
                  {req.quoted_price && (
                    <p className="mt-1 text-[11px] font-mono text-neutral-300">Quote: {formatRM(req.quoted_price)}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${STATUS_COLORS[req.status as RequestStatus] ?? 'border border-neutral-800 bg-neutral-900 text-neutral-400'}`}
                >
                  {getStatusLabel(req.status as RequestStatus, req.fulfillment) ?? req.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-mono text-orange-400 hover:underline">View live details →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
