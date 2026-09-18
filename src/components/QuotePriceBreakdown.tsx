'use client'

import React, { useState } from 'react'
import {
  Clock,
  Layers,
  Sparkles,
  Truck,
  MapPin,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCode,
  Info,
  Package,
} from 'lucide-react'
import type { PrintRequest, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS, getColorHexByName } from '@/lib/types'
import { formatRM } from '@/lib/pricing'

interface QuotePriceBreakdownProps {
  request: PrintRequest
  studioName?: string
  className?: string
  defaultExpanded?: boolean
}

export default function QuotePriceBreakdown({
  request,
  studioName = 'Qid3D Studio',
  className = '',
  defaultExpanded = true,
}: QuotePriceBreakdownProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const printPrice = request.quoted_price ?? 0
  const deliveryCost = request.delivery_cost ?? 0
  const totalAmount = printPrice + deliveryCost

  const materialKey = (request.material?.toLowerCase() || 'pla')
  const materialLabel = (MATERIAL_LABELS as Record<string, string>)[materialKey] || request.material?.toUpperCase() || 'PLA'

  // Extract specifications from notes
  const notesStr = request.notes ?? ''
  const infillMatch = notesStr.match(/Infill:\s*(\d+)%/i)
  const infillPct = request.custom_infill ?? (infillMatch ? parseInt(infillMatch[1], 10) : 20)

  const nozzleMatch = notesStr.match(/Nozzle:\s*(\d+\.?\d*)mm/i)
  const nozzleMm = nozzleMatch ? parseFloat(nozzleMatch[1]) : 0.4

  const hasPlateFilaments = Array.isArray(request.plate_filaments) && request.plate_filaments.length > 0

  const ADDON_FRIENDLY_NAMES: Record<string, { title: string; desc: string }> = {
    supports: { title: 'Support Structures', desc: 'Slicer-generated supports carefully removed & cleaned' },
    ironing: { title: 'Top Layer Ironing', desc: 'Smooth heated nozzle pass for gloss top surface' },
    color_change: { title: 'Multi-Color / AMS', desc: 'Calibrated multi-filament color transitions' },
    pause_insert: { title: 'Heat-Set Brass Inserts', desc: 'M3/M4 threaded brass inserts installed' },
    fuzzy_skin: { title: 'Fuzzy Skin Texture', desc: 'High-grip non-slip textured outer perimeter' },
    text_on_surface: { title: 'Custom Surface Text', desc: 'Embossed / engraved personalized lettering' },
  }

  return (
    <div className={`rounded-2xl border border-amber-200/80 bg-amber-50/50 overflow-hidden shadow-xs ${className}`}>
      {/* ── Main Quote Summary Bar ── */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-800 font-bold">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Official Price Breakdown
              </h3>
              <p className="text-[11px] text-amber-800">
                Verified by {studioName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/70 px-2.5 py-0.5 text-[10px] font-bold">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              Guaranteed Quote
            </span>
          </div>
        </div>

        {/* Big Total Row */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-950 font-mono tracking-tight">
                {formatRM(totalAmount)}
              </span>
              <span className="text-xs font-medium text-amber-800">
                MYR · Total Payable
              </span>
            </div>
            <p className="text-[11px] text-amber-800 font-medium mt-0.5">
              3D Print Production ({formatRM(printPrice)}) + {request.fulfillment === 'delivery' ? `Courier Delivery (${formatRM(deliveryCost)})` : 'Self Pickup (Free)'}
            </p>
          </div>

          {request.quoted_by_date && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100/70 border border-amber-200 px-3 py-1.5 text-xs text-amber-900 font-medium self-start sm:self-auto">
              <Calendar className="h-3.5 w-3.5 text-amber-700" />
              <span>
                Estimated Ready:{' '}
                <strong>
                  {new Date(request.quoted_by_date).toLocaleDateString('en-MY', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Maker's Personal Message */}
        {request.quote_message && (
          <div className="rounded-xl bg-amber-100/60 border border-amber-200/60 p-3 text-xs text-amber-950 italic leading-relaxed">
            &ldquo;{request.quote_message}&rdquo;
          </div>
        )}
      </div>

      {/* ── Toggle Details Button ── */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 bg-amber-100/50 hover:bg-amber-100 border-t border-amber-200/60 text-xs font-semibold text-amber-900 transition"
      >
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-amber-700" />
          {expanded ? 'Hide Itemized Price Breakdown' : 'View Itemized What You Pay For'}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* ── Itemized Breakdown Details ── */}
      {expanded && (
        <div className="p-4 sm:p-5 bg-white border-t border-amber-200/60 space-y-4">
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              1. 3D Print Production ({formatRM(printPrice)})
            </h4>

            {/* A. Filament Material */}
            <div className="rounded-xl border border-slate-150 bg-slate-50/80 p-3 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 font-bold mt-0.5">
                  <Layers className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="font-bold text-slate-800">Filament &amp; Raw Material</p>
                  {hasPlateFilaments ? (
                    <div className="space-y-1 mt-1">
                      {request.plate_filaments!.map((plate, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <span
                            className="h-2 w-2 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: plate.color_hex || getColorHexByName(plate.color) }}
                          />
                          <span>
                            Plate {idx + 1}: {plate.weight_g ? `${plate.weight_g}g ` : ''}
                            {plate.material.toUpperCase()} · {plate.color || 'Standard'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      ~{request.weight_g ? `${request.weight_g}g ` : ''}{materialLabel} ({request.color || 'Maker Choice'})
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Premium virgin filament spool, pre-dried &amp; vacuum-stored
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 shrink-0">Included</span>
            </div>

            {/* B. Machine Time */}
            <div className="rounded-xl border border-slate-150 bg-slate-50/80 p-3 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 font-bold mt-0.5">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="font-bold text-slate-800">Ender-3 Machine Print Time</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    ~{request.print_hours ? `${request.print_hours} hours` : '1.5–2 hours'} continuous precision FDM print time
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    0.4mm brass nozzle · 60°C heated magnetic build plate · bed leveling
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 shrink-0">Included</span>
            </div>

            {/* C. Slicing, Infill & Add-ons */}
            <div className="rounded-xl border border-slate-150 bg-slate-50/80 p-3 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="font-bold text-slate-800">Slicing &amp; Print Specs</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {infillPct}% structural infill · {nozzleMm}mm nozzle · verified toolpaths
                  </p>
                  {request.confirmed_addons && request.confirmed_addons.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {request.confirmed_addons.map((addon) => {
                        const info = ADDON_FRIENDLY_NAMES[addon]
                        return (
                          <span
                            key={addon}
                            className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            {info ? info.title : addon}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Includes brim/raft removal &amp; surface cleanup
                    </p>
                  )}
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 shrink-0">Included</span>
            </div>
          </div>

          {/* 2. Fulfillment & Delivery */}
          <div className="space-y-3 pt-2 border-t border-slate-150">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              2. Fulfillment &amp; Courier ({formatRM(deliveryCost)})
            </h4>

            <div className="rounded-xl border border-slate-150 bg-slate-50/80 p-3 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 font-bold mt-0.5">
                  <Truck className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="font-bold text-slate-800">
                    {request.fulfillment === 'delivery'
                      ? 'Pos Laju / J&T Express Standard Parcel'
                      : 'Studio Self-Pickup'}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    {request.fulfillment === 'delivery'
                      ? (request.delivery_address || 'Customer destination address')
                      : 'Free pickup at maker studio location'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {request.fulfillment === 'delivery'
                      ? 'Bubble-wrapped & reinforced carton protective packaging'
                      : 'Inspect and collect in person'}
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-slate-900 shrink-0">
                {request.fulfillment === 'delivery' ? formatRM(deliveryCost) : 'RM 0.00'}
              </span>
            </div>
          </div>

          {/* 3. Final Total Calculation */}
          <div className="rounded-xl bg-slate-100 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>3D Print Production Subtotal</span>
              <span className="font-mono font-semibold">{formatRM(printPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Delivery &amp; Postage</span>
              <span className="font-mono font-semibold">
                {request.fulfillment === 'delivery' ? formatRM(deliveryCost) : 'RM 0.00 (Free)'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between font-bold text-sm text-slate-900">
              <span>Total Price Quoted</span>
              <span className="font-mono text-base text-amber-950 font-black">{formatRM(totalAmount)}</span>
            </div>
          </div>

          {/* Quality badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> No hidden fees or surprise surcharges
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Sliced for Creality Ender-3
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Direct studio WhatsApp support
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
