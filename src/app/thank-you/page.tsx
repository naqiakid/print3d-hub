import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  FileCheck,
  Truck,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
  Package,
  Home,
  Printer
} from 'lucide-react'
import { STUDIO_CONFIG } from '@/config/studio'

export const metadata: Metadata = {
  title: 'Quote Request Received | 3MF Studio',
  description: 'Your 3D print quote request has been received. Our studio is reviewing your CAD specifications.',
  robots: {
    index: false,
    follow: false,
  },
}

interface ThankYouPageProps {
  searchParams?: Promise<{
    id?: string
    ref?: string
    email?: string
    amount?: string
  }>
}

export default async function ThankYouPage({ searchParams }: ThankYouPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const requestId = resolvedSearchParams.id
  const orderRef = resolvedSearchParams.ref || (requestId ? `3MF-${requestId.slice(0, 8).toUpperCase()}` : null)
  const customerEmail = resolvedSearchParams.email
  const estAmount = resolvedSearchParams.amount

  const cleanPhone = (STUDIO_CONFIG.whatsappNumber || '60173587894').replace(/\D/g, '')
  const waMessage = orderRef
    ? `Hi 3MF Studio! I just submitted a 3D print quote request (Ref: ${orderRef}). Can you review my model?`
    : `Hi 3MF Studio! I just submitted a 3D print quote request on your website. Can you review my model?`
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`

  return (
    <div className="min-h-[80vh] bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 overflow-hidden">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-900 text-white p-8 text-center relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <Printer className="w-64 h-64 text-white" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-inner mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-300" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-xs font-bold text-emerald-200 uppercase tracking-widest mb-2">
              Request Received
            </span>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Thank You! We Have Received Your Quote Request
            </h1>

            <p className="mt-2 text-sm text-emerald-100 max-w-md mx-auto leading-relaxed">
              Your 3D model specifications have been queued for studio slicing and feasibility check.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Order Details Highlight (if available) */}
          {orderRef && (
            <div className="rounded-2xl border border-orange-200/70 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-slate-50 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200/50 pb-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Reference</p>
                  <p className="font-mono font-black text-slate-900 text-base">{orderRef}</p>
                </div>
                {estAmount && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Total</p>
                    <p className="font-mono font-black text-orange-600 text-base">RM {estAmount}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2 pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 text-orange-500" />
                  Expected Review: <strong className="text-slate-800">Within 24 Hours</strong>
                </span>
                {customerEmail && (
                  <span className="text-slate-500 truncate max-w-xs">
                    Updates sent to: <strong className="text-slate-700">{customerEmail}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Timeline / Next Steps */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              What Happens Next?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600 font-bold text-xs">
                  <FileCheck className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">1. Slicing &amp; Review</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We check geometry, structural walls, and calculate precise filament &amp; machine print time.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 font-bold text-xs">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">2. WhatsApp Quote</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We send you the finalized price, print timeframe, and convenient payment details.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 font-bold text-xs">
                  <Truck className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">3. Print &amp; Ship</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Once confirmed, your parts are printed on our calibrated machines and prepared for pickup or courier.
                </p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            {requestId ? (
              <Link
                href={`/track/${requestId}`}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 shadow-sm transition active:scale-98 text-xs sm:text-sm"
              >
                <Package className="h-4 w-4" />
                <span>Track Order Live</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </Link>
            ) : (
              <Link
                href="/track"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 shadow-sm transition active:scale-98 text-xs sm:text-sm"
              >
                <Package className="h-4 w-4" />
                <span>Track Order Status</span>
              </Link>
            )}

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 shadow-md shadow-emerald-600/20 transition active:scale-98 text-xs sm:text-sm"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Fast-Track on WhatsApp</span>
            </a>
          </div>

          {/* Secondary Links */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-orange-600 transition font-medium"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Back to Homepage</span>
            </Link>

            <Link
              href="/browse/products"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-orange-600 font-medium transition"
            >
              <span>Explore Ready-to-Buy Catalog</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

        </div>

      </div>
    </div>
  )
}
