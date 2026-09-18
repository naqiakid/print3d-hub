'use client'

import { useState } from 'react'
import { QrCode, ShieldCheck, Copy, Check, MessageCircle, Phone, CreditCard, Sparkles, Loader2, Lock } from 'lucide-react'
import { formatRM } from '@/lib/pricing'

interface PaymentModalProps {
  orderId: string
  amount: number
  printPrice?: number
  deliveryCost?: number
  studioName?: string
  whatsapp?: string | null
  onPaymentSuccess?: () => void
}

export default function PaymentModal({
  orderId,
  amount,
  printPrice,
  deliveryCost,
  studioName = 'Qid3D Studio',
  whatsapp = '+60123456789',
  onPaymentSuccess
}: PaymentModalProps) {
  const [copiedRef, setCopiedRef] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [receiptSent, setReceiptSent] = useState(false)
  const [isGatewayLoading, setIsGatewayLoading] = useState(false)
  const [gatewayError, setGatewayError] = useState('')

  async function handleGatewayCheckout() {
    setGatewayError('')
    setIsGatewayLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: orderId }),
      })
      const data = await res.json()
      if (data.error) {
        setGatewayError(data.error)
        setIsGatewayLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        setGatewayError('No checkout URL returned')
        setIsGatewayLoading(false)
      }
    } catch (err: unknown) {
      console.error('Checkout error:', err)
      setGatewayError(err instanceof Error ? err.message : 'Failed to start payment')
      setIsGatewayLoading(false)
    }
  }

  const orderRef = `QID-${orderId.slice(0, 8).toUpperCase()}`

  // Format phone number nicely (e.g. 012-345 6789)
  const rawPhone = (whatsapp || '+60123456789').replace(/\s+/g, '')
  const cleanWhatsApp = rawPhone.replace(/\D/g, '')
  
  // Malaysian local display (01X-XXX XXXX)
  let displayPhone = rawPhone
  if (cleanWhatsApp.startsWith('60')) {
    const local = '0' + cleanWhatsApp.slice(2)
    if (local.length === 10) {
      displayPhone = `${local.slice(0, 3)}-${local.slice(3, 6)} ${local.slice(6)}`
    } else if (local.length === 11) {
      displayPhone = `${local.slice(0, 3)}-${local.slice(3, 7)} ${local.slice(7)}`
    }
  }

  const handleCopyRef = () => {
    navigator.clipboard.writeText(orderRef)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
  }

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(displayPhone.replace(/[-\s]/g, ''))
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  const waUrl = `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(
    `Hi ${studioName}! I have confirmed my quote and transferred ${formatRM(amount)} for Order #${orderRef}.\n\nAttached is my bank payment receipt / screenshot. Please verify and begin printing!\n\nOrder Link: ${typeof window !== 'undefined' ? window.location.href : ''}`
  )}`

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Secure Malaysian Payment
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-1">Payment Checkout</h3>
          <p className="text-xs text-slate-500">
            Order <span className="font-mono font-bold text-slate-700">{orderRef}</span>
          </p>
        </div>

        <div className="sm:text-right bg-orange-50/70 border border-orange-100 rounded-xl px-3.5 py-2 sm:bg-transparent sm:border-0 sm:p-0">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Total Payable</p>
          <p className="text-2xl font-black text-orange-600 font-mono leading-tight">
            {formatRM(amount)}
          </p>
          {printPrice && deliveryCost ? (
            <p className="text-[10px] text-slate-400">
              Print: {formatRM(printPrice)} + Delivery: {formatRM(deliveryCost)}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── 1. Automated Gateway Option (Instant FPX / Card) ── */}
      <div className="rounded-2xl border border-emerald-300/80 bg-linear-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs shrink-0">
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-emerald-950">
                  Instant Online Banking (FPX) &amp; Cards
                </h4>
                <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[9px] font-bold text-emerald-900 uppercase tracking-wider">
                  Automated
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Maybank2u, CIMB Clicks, Public Bank, Cards · Instant automatic verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGatewayCheckout}
            disabled={isGatewayLoading}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {isGatewayLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Redirecting...</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-emerald-200" />
                <span>Pay {formatRM(amount)} Online</span>
              </>
            )}
          </button>
        </div>
        {gatewayError && (
          <p className="text-xs text-red-600 font-medium">{gatewayError}</p>
        )}
      </div>

      <div className="flex items-center gap-2 my-1 text-slate-400 text-xs justify-center">
        <div className="h-px bg-slate-200 flex-1" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">or pay directly via duitnow qr</span>
        <div className="h-px bg-slate-200 flex-1" />
      </div>

      {/* DuitNow QR & Instant Bank Transfer Card */}
      <div className="rounded-2xl border-2 border-pink-500/25 bg-linear-to-b from-pink-50/30 to-white p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-tr from-pink-600 to-rose-500 font-black text-white text-sm shadow-xs">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">DuitNow QR &amp; Instant Transfer</h4>
                <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-bold text-pink-700 uppercase tracking-wider">
                  Zero Fee
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Maybank MAE, CIMB OCTO, Touch &apos;n Go eWallet, Bank Islam, etc.
              </p>
            </div>
          </div>
        </div>

        {/* Content Box */}
        <div className="flex flex-col sm:flex-row items-center gap-5 bg-white p-4 rounded-xl border border-pink-200/60 shadow-2xs">
          {/* DuitNow QR Visual */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-pink-300 bg-pink-50/50 shrink-0 w-36 h-36 text-center shadow-inner">
            <div className="relative">
              <QrCode className="h-16 w-16 text-pink-600 mb-1" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-4 w-4 rounded-full bg-white flex items-center justify-center font-bold text-[9px] text-pink-600 shadow-xs">
                  D
                </span>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-pink-700 uppercase tracking-wider">
              Scan DuitNow QR
            </span>
          </div>

          {/* Transfer Details & Reference */}
          <div className="space-y-3 text-xs text-slate-600 flex-1 w-full">
            {/* Payment Reference */}
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/70">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Payment Reference (Required)
                </span>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs transition"
                >
                  {copiedRef ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-500" />}
                  {copiedRef ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="mt-1 font-mono font-bold text-slate-900 text-sm tracking-wide">
                {orderRef}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Paste this into your banking app &quot;Recipient Reference&quot;.
              </p>
            </div>

            {/* DuitNow Phone ID / Bank Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-slate-50/80 p-2 border border-slate-200/50">
                <span className="text-[10px] font-medium text-slate-400 block">DuitNow ID (Phone)</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-bold text-slate-800 font-mono">{displayPhone}</span>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="text-[10px] font-bold text-pink-600 hover:text-pink-700 underline"
                  >
                    {copiedPhone ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50/80 p-2 border border-slate-200/50">
                <span className="text-[10px] font-medium text-slate-400 block">Beneficiary</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">{studioName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submission & WhatsApp Verification */}
      <div className="space-y-3 pt-1">
        {receiptSent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-bold text-sm">
              <Check className="h-4 w-4 text-emerald-600" /> Receipt Sent via WhatsApp!
            </div>
            <p className="text-xs text-emerald-700">
              The studio maker will verify your payment and queue your 3D print immediately.
            </p>
          </div>
        ) : null}

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setReceiptSent(true)
            onPaymentSuccess?.()
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3.5 px-4 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition active:scale-98 text-center"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Send Payment Receipt on WhatsApp 📱</span>
        </a>

        <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
          <span>Once your receipt is verified, your model will be queued on the printer immediately!</span>
        </div>
      </div>
    </div>
  )
}
