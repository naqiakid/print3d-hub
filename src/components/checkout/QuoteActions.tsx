'use client'

import { useState, useTransition } from 'react'
import { Lock, Loader2, ShieldCheck } from 'lucide-react'
import { acceptQuote, declineQuote } from '@/lib/actions'
import { formatRM } from '@/lib/pricing'
import PaymentModal from './DuitNowPaymentModal'

interface QuoteActionsProps {
  requestId: string
  quotedPrice?: number
  printPrice?: number
  deliveryCost?: number
  whatsapp?: string | null
  studioName?: string
}

export default function QuoteActions({
  requestId,
  quotedPrice,
  printPrice,
  deliveryCost,
  whatsapp,
  studioName,
}: QuoteActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)

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

  function handleRequestRevision() {
    if (typeof window !== 'undefined') {
      window.location.hash = '#revise-request-section'
      const el = document.getElementById('revise-request-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
    setShowDeclineConfirm(false)
  }

  if (done === 'accepted') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Quote confirmed! Please complete your payment below to lock in your printing slot.</span>
        </div>
        {quotedPrice && quotedPrice > 0 && (
          <PaymentModal
            orderId={requestId}
            amount={quotedPrice}
            printPrice={printPrice}
            deliveryCost={deliveryCost}
            whatsapp={whatsapp}
            studioName={studioName}
          />
        )}
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

  if (showDeclineConfirm) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
        <p className="text-xs text-amber-800 leading-relaxed">
          If the price is too high or you want to adjust settings (materials, colors, custom text, or quantity), you can request a revision. The owner will review and send you a new quote.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleRequestRevision}
            className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
          >
            ✏️ Request Revision / Negotiate
          </button>
          <button
            onClick={handleDecline}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            {isPending ? 'Cancelling...' : 'Cancel Request entirely'}
          </button>
          <button
            onClick={() => setShowDeclineConfirm(false)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
          >
            Keep Quote
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  const [isGatewayLoading, setIsGatewayLoading] = useState(false)

  async function handleGatewayCheckout() {
    setError('')
    setIsGatewayLoading(true)
    try {
      // First ensure quote is accepted if needed
      const acceptRes = await acceptQuote(requestId)
      if (acceptRes?.error) {
        setError(acceptRes.error)
        setIsGatewayLoading(false)
        return
      }

      // Call checkout API
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setIsGatewayLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('No checkout URL returned')
        setIsGatewayLoading(false)
      }
    } catch (err: unknown) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start payment')
      setIsGatewayLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {/* Primary Option: Automated Payment Gateway (FPX / Card) */}
        <button
          onClick={handleGatewayCheckout}
          disabled={isPending || isGatewayLoading}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3.5 px-4 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGatewayLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Connecting to Payment Gateway...</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 text-emerald-200" />
              <span>
                💳 Pay Online (FPX Banking / Card){quotedPrice ? ` · ${formatRM(quotedPrice)}` : ''}
              </span>
            </>
          )}
        </button>

        {/* Secondary Option: Direct DuitNow QR (Manual Verification) */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleAccept}
            disabled={isPending || isGatewayLoading}
            className="flex-1 rounded-xl border border-pink-200 bg-pink-50/70 hover:bg-pink-100/70 py-2.5 px-3 text-xs font-bold text-pink-900 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <span>📲 Pay via DuitNow QR (Direct Transfer)</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowDeclineConfirm(true)}
            disabled={isPending || isGatewayLoading}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Options / Decline
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
