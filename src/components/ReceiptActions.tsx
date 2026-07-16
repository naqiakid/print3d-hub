'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { confirmDeliveryReceived } from '@/lib/actions'

export default function ReceiptActions({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleConfirm() {
    setError('')
    startTransition(async () => {
      const result = await confirmDeliveryReceived(requestId)
      if ('error' in result) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          <CheckCircle className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 font-bold">Have you received your order?</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Click the button below to confirm that your 3D printed items have arrived safely. 
            Once confirmed, you can leave a review for the maker.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirming…
            </>
          ) : (
            'Yes, I received it'
          )}
        </button>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      </div>
    </div>
  )
}
