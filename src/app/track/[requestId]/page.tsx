import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  MapPin,
  Calendar,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
  Printer,
  Sparkles,
  Layers,
  Box,
  Share2,
  Check,
  HelpCircle,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { PrintRequest, Shop, FilamentMaterial, Review } from '@/lib/types'
import {
  STATUS_LABELS,
  MATERIAL_LABELS,
  SIZE_LABELS,
  QUALITY_LABELS,
  getStatusLabel,
  getWhatsAppLink,
  cleanDescription,
} from '@/lib/types'
import { formatRM } from '@/lib/pricing'
import QuoteActions from '@/components/QuoteActions'
import DuitNowPaymentModal from '@/components/checkout/DuitNowPaymentModal'
import ReviseRequest from '@/components/ReviseRequest'
import ReviewForm from '@/components/ReviewForm'
import ReceiptActions from '@/components/ReceiptActions'
import TrackingSummary from '@/components/TrackingSummary'
import CopyLinkButton from '@/components/CopyLinkButton'
import QuotePriceBreakdown from '@/components/QuotePriceBreakdown'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://print3d-hub.vercel.app'

const PICKUP_TIMELINE: {
  status: string
  label: string
  makerActivity: string
  customerRole: string
  nextMilestone: string
}[] = [
  {
    status: 'new',
    label: '1. Request Received & Review',
    makerActivity: 'Inspecting 3D geometry manifoldness, wall thickness, support angles & slicing toolpaths.',
    customerRole: 'Awaiting studio quote notification.',
    nextMilestone: 'Official price quote & target completion date confirmed by maker.',
  },
  {
    status: 'quoted',
    label: '2. Official Quote Sent',
    makerActivity: 'Quote submitted with sliced machine runtime, material weight & confirmed print addons.',
    customerRole: 'Review price breakdown and accept/pay to schedule print job.',
    nextMilestone: 'Print job scheduled in active machine queue.',
  },
  {
    status: 'accepted',
    label: '3. Quote Confirmed & Payment',
    makerActivity: 'Awaiting customer payment verification via WhatsApp. Once verified, bed is leveled and printing begins.',
    customerRole: 'Complete DuitNow / instant transfer and submit receipt screenshot to start printing.',
    nextMilestone: 'Payment verified & printing starts on the build plate.',
  },
  {
    status: 'printing',
    label: '4. Printing on Bed',
    makerActivity: 'Live layer extrusion in progress. First-layer adhesion and surface quality monitored.',
    customerRole: 'Print in progress.',
    nextMilestone: 'Print completion, cooling, and post-processing inspection.',
  },
  {
    status: 'done',
    label: '5. Ready for Studio Pickup',
    makerActivity: 'Part cooled, carefully removed from PEI sheet, supports detached, tolerances verified.',
    customerRole: 'Collect your print at the studio pickup location.',
    nextMilestone: 'Handover and verified customer review.',
  },
  {
    status: 'collected',
    label: '6. Collected & Completed',
    makerActivity: 'Print inspected and safely handed over to customer.',
    customerRole: 'Enjoy your 3D print and leave a review.',
    nextMilestone: 'Order successfully completed!',
  },
]

const DELIVERY_TIMELINE: {
  status: string
  label: string
  makerActivity: string
  customerRole: string
  nextMilestone: string
}[] = [
  {
    status: 'new',
    label: '1. Request Received & Review',
    makerActivity: 'Inspecting 3D geometry manifoldness, wall thickness, support angles & slicing toolpaths.',
    customerRole: 'Awaiting studio quote notification.',
    nextMilestone: 'Official price quote & target completion date confirmed by maker.',
  },
  {
    status: 'quoted',
    label: '2. Official Quote Sent',
    makerActivity: 'Quote submitted with sliced machine runtime, delivery fee & confirmed print addons.',
    customerRole: 'Review price breakdown and accept/pay to schedule print job.',
    nextMilestone: 'Print job scheduled in active machine queue.',
  },
  {
    status: 'accepted',
    label: '3. Quote Confirmed & Payment',
    makerActivity: 'Awaiting customer payment verification via WhatsApp. Once verified, bed is leveled and printing begins.',
    customerRole: 'Complete DuitNow / instant transfer and submit receipt screenshot to start printing.',
    nextMilestone: 'Payment verified & printing starts on the build plate.',
  },
  {
    status: 'printing',
    label: '4. Printing on Bed',
    makerActivity: 'Live layer extrusion in progress. First-layer adhesion and surface quality monitored.',
    customerRole: 'Print in progress.',
    nextMilestone: 'Print completion, cooling, and protective packaging.',
  },
  {
    status: 'done',
    label: '5. Packaged for Delivery',
    makerActivity: 'Part cleaned, dimensions caliper-checked, bubble-wrapped and boxed for courier.',
    customerRole: 'Awaiting courier dispatch.',
    nextMilestone: 'Courier handover with tracking number.',
  },
  {
    status: 'shipping',
    label: '6. Out for Delivery',
    makerActivity: 'Dispatched with courier service to your delivery address.',
    customerRole: 'Receive package and confirm delivery receipt.',
    nextMilestone: 'Delivery confirmation and customer review.',
  },
  {
    status: 'collected',
    label: '7. Delivered & Completed',
    makerActivity: 'Delivery confirmed.',
    customerRole: 'Enjoy your 3D print and leave a review.',
    nextMilestone: 'Order successfully completed!',
  },
]

const TERMINAL_NEGATIVE = ['declined', 'cancelled']

function stepIndex(status: string, timeline: { status: string }[]) {
  return timeline.findIndex((s) => s.status === status)
}

const ADDON_LABELS: Record<string, string> = {
  supports:        'Support structures',
  ironing:         'Ironing (smooth top surface)',
  color_change:    'Multi-color / AMS system',
  pause_insert:    'Embedded heat-set inserts',
  fuzzy_skin:      'Fuzzy skin textured grip',
  text_on_surface: 'Surface text engraving/embossing',
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>
  searchParams?: Promise<{ payment?: string; method?: string; session_id?: string }>
}) {
  const { requestId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const paymentParam = resolvedSearchParams.payment

  const supabase = await createClient()

  const { data: reqData } = await supabase
    .from('requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (!reqData) notFound()
  const request = reqData as unknown as PrintRequest

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isOwner = user?.id === request.owner_id

  const { data: printerData } = await supabase
    .from('profiles')
    .select('name, whatsapp, turnaround, pickup_address, materials, lat, lng, delivery_available, delivery_rate_per_km')
    .eq('id', request.owner_id)
    .maybeSingle()

  const printer = printerData as Pick<
    Shop,
    'name' | 'whatsapp' | 'turnaround' | 'pickup_address' | 'materials' | 'lat' | 'lng' | 'delivery_available' | 'delivery_rate_per_km'
  > | null

  type CatalogFlags = {
    allow_material_choice: boolean
    allow_color_choice: boolean
    allow_custom_text: boolean
    allow_resize: boolean
  }
  let catalogFlags: CatalogFlags | null = null

  const [catalogResult, filamentResult, reviewResult] = await Promise.all([
    request.catalog_item_id
      ? supabase
          .from('catalog_items')
          .select('allow_material_choice, allow_color_choice, allow_custom_text, allow_resize, stl_urls, description')
          .eq('id', request.catalog_item_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('filaments')
      .select('id, material, color, color_hex')
      .eq('owner_id', request.owner_id)
      .eq('in_stock', true)
      .order('material')
      .order('color'),
    supabase
      .from('reviews')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle(),
  ])

  if (catalogResult.data) {
    catalogFlags = catalogResult.data as CatalogFlags
  }

  type FilamentColor = { id: string; material: string; color: string; color_hex: string }
  const filaments = (filamentResult.data ?? []) as FilamentColor[]

  const { data: reviewData } = reviewResult
  const review = reviewData as unknown as Review | null

  // Parse special lines out of notes once
  const rawNotes = (request.notes ?? '')
    .replace(/^\[\d+\.?\d*×\d+\.?\d*×\d+\.?\d*mm\]\s*/, '')
    .replace(/^(ASAP — rush order\.|Anytime — no rush\.)\s*/, '')
  const insertMatch  = rawNotes.match(/\nEmbedded inserts: ([^\n]+)/)
  const surfaceMatch = rawNotes.match(/\nSurface text: "([^"]+)"/)
  const insertText  = insertMatch?.[1]?.trim() ?? null
  const surfaceText = surfaceMatch?.[1]?.trim() ?? null

  const isNegative = TERMINAL_NEGATIVE.includes(request.status)
  const isDelivery = request.fulfillment === 'delivery'

  const dynamicTimeline = isDelivery ? DELIVERY_TIMELINE : PICKUP_TIMELINE
  const rawStep = stepIndex(request.status, dynamicTimeline)
  const currentStep = rawStep === -1 ? 0 : rawStep

  const hasGcode    = (request.gcode_urls?.length ?? 0) > 0
  const hasSupports = request.supports || request.selected_addons?.includes('supports')

  // Date formatted
  const createdDate = request.created_at
    ? new Date(request.created_at).toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Progress percentage calculation
  const progressPct = Math.round(((currentStep + 1) / dynamicTimeline.length) * 100)

  // Status Badge formatting
  const getStatusBadge = () => {
    switch (request.status) {
      case 'new':
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-700',
          dot: 'bg-blue-500 animate-pulse',
          label: 'Maker Review & Slicing',
        }
      case 'quoted':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500 animate-ping',
          label: 'Official Quote Ready',
        }
      case 'accepted':
        return {
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
          dot: 'bg-indigo-500',
          label: 'In Production Queue',
        }
      case 'printing':
        return {
          bg: 'bg-purple-50 border-purple-200 text-purple-700',
          dot: 'bg-purple-500 animate-pulse',
          label: 'Printing on Bed',
        }
      case 'done':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          dot: 'bg-emerald-500',
          label: isDelivery ? 'Packaged for Courier' : 'Ready for Pickup',
        }
      case 'shipping':
        return {
          bg: 'bg-sky-50 border-sky-200 text-sky-700',
          dot: 'bg-sky-500',
          label: 'Out for Delivery',
        }
      case 'collected':
        return {
          bg: 'bg-green-50 border-green-200 text-green-700',
          dot: 'bg-green-500',
          label: 'Completed & Delivered',
        }
      case 'declined':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-700',
          dot: 'bg-rose-500',
          label: 'Quote Declined',
        }
      case 'cancelled':
        return {
          bg: 'bg-slate-100 border-slate-300 text-slate-600',
          dot: 'bg-slate-400',
          label: 'Cancelled',
        }
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
          dot: 'bg-slate-400',
          label: getStatusLabel(request.status, request.fulfillment),
        }
    }
  }

  const badge = getStatusBadge()
  const activeTimelineItem = dynamicTimeline[currentStep] || dynamicTimeline[0]

  return (
    <div className="min-h-screen bg-slate-50/50 py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 space-y-4">

        {/* ── Top Header Bar (Compact & Screen-Optimized) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 mb-0.5">
              <Link href="/" className="text-orange-600 hover:text-orange-700 transition">
                Print3D Hub
              </Link>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span>Order Tracking</span>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span className="font-mono text-slate-800">#QID-{requestId.slice(0, 8).toUpperCase()}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Order &amp; Print Verification</span>
            </h1>
            <p className="text-xs text-slate-500">
              Studio: <strong className="text-slate-800 font-semibold">{printer?.name ?? 'Qid3D Studio'}</strong>
              {printer?.turnaround ? ` · Turnaround: ${printer.turnaround}` : ''}
              {createdDate ? ` · Placed ${createdDate}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-2xs ${badge.bg}`}
            >
              <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>

            {printer?.whatsapp && (
              <a
                href={getWhatsAppLink(
                  printer.whatsapp,
                  `Hi ${printer.name}, I'm checking in on my print order #QID-${requestId.slice(0, 8).toUpperCase()}.\n${APP_URL}/track/${requestId}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold transition shadow-2xs"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>Chat Studio</span>
              </a>
            )}
          </div>
        </div>

        {/* ── Payment Gateway Result Banners ── */}
        {paymentParam === 'success' && (
          <div className="rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white font-bold shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-100" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">
                  Payment Verified &amp; Confirmed!
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Your payment has been received. Your 3D print job is locked in and scheduled for the Ender-3 build plate!
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-bold shrink-0 self-start sm:self-auto">
              ✓ Automated FPX / Card Paid
            </span>
          </div>
        )}

        {paymentParam === 'cancelled' && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Online payment checkout was cancelled. You can retry paying online anytime or use direct DuitNow transfer below.
              </span>
            </div>
            <Link
              href={`/track/${requestId}`}
              className="text-amber-800 underline font-bold hover:text-amber-950 shrink-0"
            >
              Dismiss
            </Link>
          </div>
        )}

        {/* ── Studio Admin Banner (Visible when maker views order) ── */}
        {isOwner && (
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5 text-slate-800 min-w-0">
              <span className="flex h-6 px-2 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white font-black text-[10px] tracking-wider">
                MAKER
              </span>
              <span className="leading-snug">
                <strong>Studio Admin Mode:</strong> You own this print request. Review customer files, slice in your software, and submit your confirmed quote in your Dashboard.
              </span>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-1.5 font-bold transition shadow-2xs shrink-0 self-start sm:self-center"
            >
              <span>Open Maker Dashboard &rarr;</span>
            </Link>
          </div>
        )}

        {/* ── Main Two-Column Grid (Dynamic Desktop Fit, Minimal Scrolling) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* ════════════════════════════════════════════════════════════════
              LEFT COLUMN: Ender-3 Bed 3D Preview + Compact Segmented Specs
              ════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-4">
            <TrackingSummary
              request={request}
              pickupAddress={printer?.pickup_address ?? null}
              catalogItemStlUrls={catalogResult?.data?.stl_urls ?? null}
            />

            {/* Existing Customer Review (if already reviewed) */}
            {review && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Your Verified Review</h3>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i <= review.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100 italic">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              RIGHT COLUMN: Full Request Journey, Action Hero Card & Timeline
              ════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">

            {/* ── 1. Full Request Journey Status Card (High Trust & Transparency) ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5 text-orange-600 font-extrabold uppercase tracking-wider text-[11px]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Request Journey Status
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    Step {currentStep + 1} of {dynamicTimeline.length} ({progressPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(10, progressPct)}%` }}
                  />
                </div>
              </div>

              {/* What is happening right now? (Maker activity transparency) */}
              <div className="rounded-xl border border-blue-150 bg-blue-50/70 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                  <Clock className="h-4 w-4 text-blue-600 shrink-0 animate-pulse" />
                  <span>Current Activity: {activeTimelineItem.label}</span>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed font-medium">
                  {activeTimelineItem.makerActivity}
                </p>
                <div className="pt-1.5 border-t border-blue-200/50 flex flex-wrap items-center justify-between gap-1 text-[11px] text-blue-700">
                  <span><strong>Next Step:</strong> {activeTimelineItem.nextMilestone}</span>
                  {printer?.turnaround && (
                    <span className="text-blue-600 font-semibold">~{printer.turnaround}</span>
                  )}
                </div>
              </div>

              {/* Contextual Action Hero (Quote / WhatsApp / Printing) */}
              {request.status === 'new' && printer?.whatsapp && (
                <a
                  href={getWhatsAppLink(
                    printer.whatsapp,
                    `Hello ${printer.name}! I have submitted print request #QID-${requestId.slice(0, 8).toUpperCase()}.\n\nReview 3D file & quote here:\n${APP_URL}/track/${requestId}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-green-700 transition text-center"
                >
                  <MessageCircle className="h-4 w-4" />
                  Notify Maker on WhatsApp (Expedite Review)
                </a>
              )}

              {/* Official Quote Action Card (When Quoted) */}
              {request.quoted_price && request.status !== 'new' && (
                <div className="space-y-3">
                  <QuotePriceBreakdown
                    request={request}
                    studioName={printer?.name ?? 'Qid3D Studio'}
                    defaultExpanded={true}
                  />

                  {request.status === 'quoted' && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                          Ready to Proceed?
                        </span>
                        <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          Active Quote
                        </span>
                      </div>
                      <QuoteActions
                        requestId={requestId}
                        quotedPrice={(request.quoted_price ?? 0) + (request.delivery_cost ?? 0)}
                        printPrice={request.quoted_price ?? 0}
                        deliveryCost={request.delivery_cost ?? 0}
                        whatsapp={printer?.whatsapp}
                        studioName={printer?.name ?? 'Qid3D Studio'}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Payment Checkout Card (When Quote is Confirmed/Accepted) */}
              {request.status === 'accepted' && (
                <div className="space-y-3">
                  {request.payment_status === 'paid' ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-2 shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span className="text-sm font-bold text-emerald-900">
                          ✓ Payment Verified &amp; Received!
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        Your payment of {formatRM((request.quoted_price ?? 0) + (request.delivery_cost ?? 0))} has been verified by {printer?.name || 'the studio'}. Your 3D print job is locked in and scheduled for the Ender-3 build plate!
                      </p>
                      <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                        <span>Payment Method: DuitNow / Bank Transfer</span>
                        <span className="bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
                          Paid
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5 shadow-xs">
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500 mt-1 animate-ping shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">
                            Quote Confirmed — Payment Required to Begin Printing
                          </p>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            Please complete payment of {formatRM((request.quoted_price ?? 0) + (request.delivery_cost ?? 0))} via DuitNow QR or Instant Bank Transfer below and submit your receipt screenshot. Your print job will be queued immediately upon maker verification.
                          </p>
                        </div>
                      </div>

                      <DuitNowPaymentModal
                        orderId={requestId}
                        amount={(request.quoted_price ?? 0) + (request.delivery_cost ?? 0)}
                        printPrice={request.quoted_price ?? 0}
                        deliveryCost={request.delivery_cost ?? 0}
                        whatsapp={printer?.whatsapp}
                        studioName={printer?.name ?? 'Qid3D Studio'}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Printing Status Banner */}
              {request.status === 'printing' && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-900 flex items-center gap-2.5">
                  <Printer className="h-4 w-4 text-purple-600 animate-bounce shrink-0" />
                  <span>Your model is currently printing on the Ender-3 bed with verified adhesion.</span>
                </div>
              )}

              {/* Done Status Banner */}
              {request.status === 'done' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    {isDelivery
                      ? 'Print complete and packaged securely. Awaiting courier handover.'
                      : `Print complete! Ready for pickup at: ${printer?.pickup_address || 'studio'}.`}
                  </span>
                </div>
              )}

              {/* Shipping Receipt Action */}
              {request.status === 'shipping' && isDelivery && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-900 flex items-center gap-2.5">
                    <Truck className="h-4 w-4 text-sky-600 shrink-0" />
                    <span>Package is with the delivery courier. Click below once received!</span>
                  </div>
                  <ReceiptActions requestId={requestId} />
                </div>
              )}

              {/* Review Prompt */}
              {request.status === 'collected' && !review && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-800 mb-2">Leave a Verified Studio Review:</p>
                  <ReviewForm requestId={requestId} ownerId={request.owner_id} />
                </div>
              )}
            </div>

            {/* ── 2. Full Production Journey Roadmap (Compact Vertical Milestones) ── */}
            {!isNegative && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Production Roadmap
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Step {currentStep + 1} of {dynamicTimeline.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {dynamicTimeline.map((step, i) => {
                    const isCompleted = currentStep > i
                    const isActive = currentStep === i
                    const isUpcoming = currentStep < i

                    return (
                      <div
                        key={step.status}
                        className={`flex items-start gap-2.5 p-2 rounded-xl transition ${
                          isActive
                            ? 'bg-orange-50/70 border border-orange-200/80 shadow-2xs'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5 ${
                            isActive
                              ? 'bg-orange-500 text-white shadow-xs ring-2 ring-orange-200'
                              : isCompleted
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs leading-tight font-bold ${
                              isActive
                                ? 'text-orange-600 font-extrabold'
                                : isCompleted
                                ? 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                            {step.makerActivity}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 3. Studio Maker & Support Card ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Studio Accountability
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.2">
                  Verified Maker
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 font-black text-xs">
                  {printer?.name ? printer.name.slice(0, 2).toUpperCase() : '3D'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {printer?.name || 'Qid3D Studio'}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    Turnaround: {printer?.turnaround || '24-48h'} · Direct WhatsApp active
                  </p>
                </div>
              </div>

              {printer?.pickup_address && (
                <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{printer.pickup_address}</span>
                </div>
              )}

              {/* Revise Request trigger (if order is in review or quoted) */}
              {['new', 'quoted'].includes(request.status) && printer?.materials && (() => {
                const qtyMatch = (request.notes ?? '').match(/Quantity: (\d+) copies/)
                const parsedQuantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1
                return (
                  <div className="pt-1 border-t border-slate-100">
                    <ReviseRequest
                      requestId={requestId}
                      currentMaterial={request.material}
                      currentColor={request.color}
                      currentColorHex={request.color_hex}
                      currentSelectedAddons={request.selected_addons ?? []}
                      currentDeclinedAddons={request.declined_addons ?? []}
                      availableMaterials={printer.materials as FilamentMaterial[]}
                      filaments={filaments}
                      status={request.status}
                      allowMaterialChange={catalogFlags ? catalogFlags.allow_material_choice : true}
                      allowColorChange={catalogFlags ? catalogFlags.allow_color_choice : true}
                      currentQuantity={parsedQuantity}
                      currentFulfillment={request.fulfillment ?? 'pickup'}
                      currentDeliveryAddress={request.delivery_address}
                      currentNotes={request.notes ?? ''}
                      printer={{
                        pickup_address: printer.pickup_address,
                        delivery_available: printer.delivery_available,
                        delivery_rate_per_km: printer.delivery_rate_per_km,
                        lat: printer.lat,
                        lng: printer.lng,
                      }}
                    />
                  </div>
                )
              })()}

              {/* Share / Copy Tracking Link */}
              <div className="pt-1 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 block">
                  Bookmark or share your live order link:
                </span>
                <CopyLinkButton url={`${APP_URL}/track/${requestId}`} />
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
