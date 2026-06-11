'use client'

import { useState, useTransition } from 'react'
import { acceptQuote, declineQuote } from '@/lib/actions'

export default function QuoteActions({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)

  function handleAccept() {
    setError('')
    startTransition(async () => {
      const result = await acceptQuote(requestId)
      if (result?.error) setError(result.error)
      else setDone('accepted')
    })
  }

  function handleDecline() {
    setError('')
    startTransition(async () => {
      const result = await declineQuote(requestId)
      if (result?.error) setError(result.error)
      else setDone('declined')
    })
  }

  if (done === 'accepted') {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
        Quote accepted — the owner has been notified and will start printing soon.
      </div>
    )
  }

  if (done === 'declined') {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        You declined this quote. The request has been cancelled.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={isPending}
          className="flex-1 rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
        >
          {isPending ? '...' : 'Accept Quote'}
        </button>
        <button
          onClick={handleDecline}
          disabled={isPending}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
