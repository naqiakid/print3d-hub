'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { submitReview } from '@/lib/actions'

export default function ReviewForm({
  requestId,
  ownerId,
}: {
  requestId: string
  ownerId: string
}) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (rating < 1) { setError('Please pick a star rating.'); return }
    setError('')
    startTransition(async () => {
      const result = await submitReview(requestId, ownerId, rating, comment)
      if ('error' in result) { setError(result.error); return }
      setSubmitted(true)
    })
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-sm font-semibold text-green-800">Thanks for your review!</p>
        <p className="mt-1 text-xs text-green-600">It helps other customers find great printers.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">How was your print?</h2>
        <p className="mt-0.5 text-xs text-slate-500">Leave a quick rating for the owner.</p>
      </div>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHoverRating(i)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5"
          >
            <Star
              className={`h-7 w-7 transition ${
                i <= (hoverRating || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-slate-100 text-slate-200'
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Anything you'd like to share? (optional)"
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition"
      >
        {isPending ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  )
}
