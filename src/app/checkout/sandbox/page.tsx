'use client'

import React, { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CreditCard,
  Building2,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock,
} from 'lucide-react'
import { formatRM } from '@/lib/pricing'

const MALAYSIAN_BANKS = [
  { id: 'MBB', name: 'Maybank2u', color: 'bg-yellow-400 text-slate-950' },
  { id: 'CIMB', name: 'CIMB Clicks', color: 'bg-red-600 text-white' },
  { id: 'PBB', name: 'Public Bank', color: 'bg-red-700 text-white' },
  { id: 'RHB', name: 'RHB Now', color: 'bg-blue-600 text-white' },
  { id: 'HLB', name: 'Hong Leong Connect', color: 'bg-blue-900 text-white' },
  { id: 'BIMB', name: 'Bank Islam', color: 'bg-red-800 text-white' },
]

function SandboxCheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('requestId') || ''
  const sessionId = searchParams.get('sessionId') || ''
  const rawAmount = parseFloat(searchParams.get('amount') || '0')
  const amount = isNaN(rawAmount) ? 0 : rawAmount

  const [selectedMethod, setSelectedMethod] = useState<'fpx' | 'card' | 'grabpay'>('fpx')
  const [selectedBank, setSelectedBank] = useState('MBB')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const orderRef = requestId ? `QID-${requestId.slice(0, 8).toUpperCase()}` : 'Order'

  const handleSimulatePayment = () => {
    setError('')
    startTransition(async () => {
      try {
        const res = await fetch('/api/webhooks/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `evt_sim_${Date.now()}`,
            type: 'checkout.session.completed',
            data: {
              object: {
                id: sessionId,
                client_reference_id: requestId,
                payment_status: 'paid',
                payment_method_types: [selectedMethod === 'fpx' ? `fpx_${selectedBank.toLowerCase()}` : selectedMethod],
                amount_total: Math.round(amount * 100),
                currency: 'myr',
                metadata: {
                  request_id: requestId,
                },
              },
            },
          }),
        })

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`)
        }

        // Redirect back to tracking page with payment success
        router.push(`/track/${requestId}?payment=success&method=${selectedMethod}`)
      } catch (err: unknown) {
        console.error('Payment simulation failed:', err)
        setError(err instanceof Error ? err.message : 'Simulation failed')
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-100/70 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Sandbox Notice Banner */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span>Developer Sandbox · Malaysian Payment Gateway Test Mode</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            This simulated checkout allows you to test Malaysian Online Banking (FPX) and Card payments locally.
            To connect live payments, add your real <code className="font-mono bg-amber-150 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code> in <code className="font-mono bg-amber-150 px-1 py-0.5 rounded">.env.local</code>.
          </p>
        </div>

        {/* Payment Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order Reference</span>
              <p className="font-mono font-black text-slate-800 text-sm">{orderRef}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Payable</span>
              <p className="font-mono font-black text-2xl text-emerald-600 leading-none mt-0.5">
                {formatRM(amount)}
              </p>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Select Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod('fpx')}
                className={`rounded-xl border p-3 text-center transition flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'fpx'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold shadow-2xs ring-1 ring-orange-400'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Building2 className="h-5 w-5 text-orange-600" />
                <span className="text-xs">FPX Banking</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                className={`rounded-xl border p-3 text-center transition flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'card'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold shadow-2xs ring-1 ring-orange-400'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="text-xs">Debit / Credit</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('grabpay')}
                className={`rounded-xl border p-3 text-center transition flex flex-col items-center gap-1.5 ${
                  selectedMethod === 'grabpay'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold shadow-2xs ring-1 ring-orange-400'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="font-black text-emerald-600 text-sm">GrabPay</span>
                <span className="text-xs">E-Wallet</span>
              </button>
            </div>
          </div>

          {/* Sub-options for FPX Bank Selection */}
          {selectedMethod === 'fpx' && (
            <div className="space-y-2 pt-1 animate-fade-in">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Select Malaysian Bank (FPX)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {MALAYSIAN_BANKS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBank(b.id)}
                    className={`rounded-xl border p-2.5 text-xs text-left transition flex items-center justify-between ${
                      selectedBank === b.id
                        ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{b.name}</span>
                    {selectedBank === b.id && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Test Card Info */}
          {selectedMethod === 'card' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-slate-600 font-mono text-[11px]">
                <span>Card Number:</span>
                <span className="font-bold text-slate-900">4242 •••• •••• 4242</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-mono text-[11px]">
                <span>Expiry / CVC:</span>
                <span className="font-bold text-slate-900">12/28 · 123</span>
              </div>
              <p className="text-[10px] text-slate-400 text-center pt-1">
                Simulated Visa / Mastercard Test Card
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSimulatePayment}
              className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-3.5 text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Payment via Bank...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>
                    Pay {formatRM(amount)} via {selectedMethod === 'fpx' ? selectedBank : selectedMethod.toUpperCase()}
                  </span>
                </>
              )}
            </button>

            <Link
              href={`/track/${requestId}?payment=cancelled`}
              className="block text-center text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Cancel and return to order tracking
            </Link>

            {error && (
              <p className="text-xs text-red-600 text-center font-medium bg-red-50 p-2 rounded-lg">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>256-bit Encrypted Malaysian Gateway Simulation</span>
        </div>
      </div>
    </div>
  )
}

export default function SandboxCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-xs">Loading payment gateway...</div>}>
      <SandboxCheckoutContent />
    </Suspense>
  )
}
