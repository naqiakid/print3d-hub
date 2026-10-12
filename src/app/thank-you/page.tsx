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
    <div className="min-h-[85vh] py-16 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl bg-neutral-900/90 rounded-3xl shadow-2xl border border-neutral-800 overflow-hidden backdrop-blur-md">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-b from-neutral-800/80 via-neutral-900 to-neutral-950 text-white p-8 text-center relative overflow-hidden border-b border-neutral-800">
          <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none">
            <Printer className="w-64 h-64 text-white" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner mb-4">
              <CheckCircle2 className="h-9 w-9 text-emerald-400" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-2">
              Order Specification Received
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Thank You! We Have Received Your Quote Request
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
              Your 3D model geometry and print specifications have been queued for studio slicing and feasibility verification.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Order Details Highlight (if available) */}
          {orderRef && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                <div>
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Order Reference</p>
                  <p className="font-mono font-bold text-white text-base tracking-wider">{orderRef}</p>
                </div>
                {estAmount && (
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Estimated Total</p>
                    <p className="font-mono font-bold text-orange-400 text-base">RM {estAmount}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-neutral-400 gap-2 pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 text-neutral-500" />
                  Expected Review: <strong className="text-neutral-200">Within 24 Hours</strong>
                </span>
                {customerEmail && (
                  <span className="text-neutral-400 truncate max-w-xs text-[11px]">
                    Updates sent to: <strong className="text-neutral-300 font-mono">{customerEmail}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Timeline / Next Steps */}
          <div>
            <h2 className="text-[11px] font-mono font-semibold uppercase tracking-widest text-neutral-500 mb-4">
              Production Workflow
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950/60 p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-orange-400 font-bold text-xs">
                  <FileCheck className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-white text-xs tracking-wide">1. Slicing &amp; Review</h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  We check CAD manifolds, wall thicknesses, and calculate precise grams &amp; machine print duration.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950/60 p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-emerald-400 font-bold text-xs">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-white text-xs tracking-wide">2. WhatsApp Direct</h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  We confirm your final invoice, dispatch timetable, and convenient payment methods.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950/60 p-4 space-y-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-blue-400 font-bold text-xs">
                  <Truck className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-white text-xs tracking-wide">3. Precision Print</h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Your components are printed on Bambu Lab / Voron machines and prepped for courier or studio collection.
                </p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            {requestId ? (
              <Link
                href={`/track/${requestId}`}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-medium py-3 px-4 shadow-sm transition active:scale-98 text-xs tracking-wide"
              >
                <Package className="h-3.5 w-3.5 text-neutral-300" />
                <span>Track Order Live</span>
                <ExternalLink className="h-3 w-3 text-neutral-400" />
              </Link>
            ) : (
              <Link
                href="/track"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-medium py-3 px-4 shadow-sm transition active:scale-98 text-xs tracking-wide"
              >
                <Package className="h-3.5 w-3.5 text-neutral-300" />
                <span>Track Order Status</span>
              </Link>
            )}

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 shadow-lg shadow-emerald-950/40 transition active:scale-98 text-xs tracking-wide"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Fast-Track on WhatsApp</span>
            </a>
          </div>

          {/* Secondary Links */}
          <div className="pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between text-xs text-neutral-500 gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-white transition font-medium"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Back to Homepage</span>
            </Link>

            <Link
              href="/browse/products"
              className="inline-flex items-center gap-1 text-neutral-400 hover:text-white font-medium transition"
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
