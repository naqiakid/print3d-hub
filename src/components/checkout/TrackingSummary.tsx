'use client'

import { useState } from 'react'
import {
  Box,
  Layers,
  Maximize2,
  CheckCircle2,
  Sparkles,
  Truck,
  MapPin,
  Download,
  FileCode,
  ShieldCheck,
  Palette,
  FileText,
} from 'lucide-react'
import type { PrintRequest, FilamentMaterial } from '@/lib/types'
import {
  MATERIAL_LABELS,
  QUALITY_LABELS,
  getColorHexByName,
} from '@/lib/types'
import Ender3BedViewerWrapper from '@/components/configurator/Ender3BedViewerFromUrlsWrapper'

interface TrackingSummaryProps {
  request: PrintRequest
  pickupAddress: string | null
  catalogItemStlUrls?: string[] | null
}

export default function TrackingSummary({ request, pickupAddress, catalogItemStlUrls }: TrackingSummaryProps) {
  const [activeTab, setActiveTab] = useState<'specs' | 'fulfillment' | 'files'>('specs')

  // ── 1. Robust URL Resolution (catalogItemStlUrls -> stl_urls -> stl_url -> file_url) ──
  const extractUrls = (val: unknown): string[] => {
    if (!val) return []
    if (Array.isArray(val)) return val.filter((u) => typeof u === 'string' && u.trim().length > 0)
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (Array.isArray(parsed)) return parsed.filter((u) => typeof u === 'string' && u.trim().length > 0)
        } catch {}
      }
      return [trimmed]
    }
    return []
  }

  const rawUrls = [
    ...(catalogItemStlUrls && catalogItemStlUrls.length > 0 ? catalogItemStlUrls : []),
    ...extractUrls(request.stl_urls),
    ...extractUrls(request.stl_url),
    ...extractUrls(request.file_url),
  ]
  const sourceUrls = Array.from(new Set(rawUrls)).filter((u): u is string => typeof u === 'string' && u.trim().length > 0)

  // ── 2. Parse Multiple Copies Customizations ──
  const parsed = (() => {
    const notesStr = request.notes ?? ''
    if (!notesStr.includes('Item Customisations (Multiple Copies):')) {
      return null
    }

    const copies: { name?: string; color?: string; partColors?: { partName: string; color: string }[] }[] = []
    let customerNotes = ''

    const parts = notesStr.split(/Copy #\d+:/g)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i] || ''
      let nameVal: string | undefined
      let colorVal: string | undefined
      const partColors: { partName: string; color: string }[] = []

      const lines = part.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('- Color:')) {
          colorVal = trimmed.replace('- Color:', '').trim()
        } else if (trimmed.includes('to engrave:') || trimmed.includes('to emboss:') || trimmed.includes('text:')) {
          const match = trimmed.match(/"([^"]+)"/)
          if (match) {
            nameVal = match[1]
          } else {
            const spl = trimmed.split(':')
            nameVal = spl[1]?.trim()
          }
        } else if (trimmed.startsWith('-') && trimmed.includes(':')) {
          const cleanLine = trimmed.slice(1).trim()
          const colonIdx = cleanLine.indexOf(':')
          if (colonIdx !== -1) {
            const partName = cleanLine.slice(0, colonIdx).trim()
            const color = cleanLine.slice(colonIdx + 1).trim()
            partColors.push({ partName, color })
          }
        }
      }
      copies.push({ name: nameVal, color: colorVal, partColors })
    }

    const customerNotesMatch = notesStr.match(/Customer Notes:\s*([\s\S]*)$/i)
    if (customerNotesMatch) {
      customerNotes = customerNotesMatch[1].trim()
    } else {
      const clean = notesStr
        .replace(/Item Customisations [\s\S]*?(Copy #\d+:[\s\S]*?)+/i, '')
        .replace(/Customer Notes:[\s\S]*/i, '')
        .trim()
      if (clean) customerNotes = clean
    }

    return { copies, customerNotes }
  })()

  // ── 3. Parse Specifications from Notes & Request Fields ──
  const notesStr = request.notes ?? ''

  // Dimensions
  const dimsMatch =
    notesStr.match(/\[Dims:\s*([\d\.]+)×([\d\.]+)×([\d\.]+)mm\]/i) ||
    notesStr.match(/\[([\d\.]+)×([\d\.]+)×([\d\.]+)mm\]/i)
  const dimensions = dimsMatch
    ? { x: parseFloat(dimsMatch[1]), y: parseFloat(dimsMatch[2]), z: parseFloat(dimsMatch[3]) }
    : null

  // Quantity
  const qtyMatch =
    notesStr.match(/\[Quantity:\s*([^\]]+)\]/i) || notesStr.match(/Quantity:\s*([^\n]+)/i)
  const quantityLabel = qtyMatch ? qtyMatch[1].trim() : '1 piece'

  // Infill
  const infillMatch = notesStr.match(/Infill:\s*(\d+)%/i)
  const infillPct = request.custom_infill ?? (infillMatch ? parseInt(infillMatch[1], 10) : 20)

  // Nozzle
  const nozzleMatch = notesStr.match(/Nozzle:\s*(\d+\.?\d*)mm/i)
  const nozzleMm = nozzleMatch ? parseFloat(nozzleMatch[1]) : 0.4

  // Weight & Hours
  const weightVal =
    request.weight_g ??
    (() => {
      const m = notesStr.match(/\[Est\. Weight:\s*~?(\d+\.?\d*)g\]/i)
      return m ? parseFloat(m[1]) : null
    })()

  const hoursVal =
    request.print_hours ??
    (() => {
      const m = notesStr.match(/\[Est\. Print Time:\s*~?(\d+\.?\d*)h\]/i)
      return m ? parseFloat(m[1]) : null
    })()

  // Clean Customer Notes
  let cleanNotes = parsed ? parsed.customerNotes : notesStr
  cleanNotes = cleanNotes
    .replace(/\[Dims:[^\]]+\]/gi, '')
    .replace(/\[Quantity:[^\]]+\]/gi, '')
    .replace(/Spec:[^\n]+/gi, '')
    .replace(/Infill:\s*\d+%/gi, '')
    .replace(/Nozzle:\s*[\d\.]+mm/gi, '')
    .replace(/\[Est\. Weight:[^\]]+\]/gi, '')
    .replace(/\[Est\. Print Time:[^\]]+\]/gi, '')
    .replace(/\[(?:Instant Estimate|Customer Est\. Price|Customer Est\. Total):[^\]]+\]/gi, '')
    .replace(/Customer Notes:\s*/gi, '')
    .replace(/Parts Breakdown \([^\)]*\):[\s\S]*?(?=\n\n|$)/gi, '')
    .trim()

  // Material Details
  const materialKey = (request.material?.toLowerCase() || 'pla') as FilamentMaterial
  const materialLabel = MATERIAL_LABELS[materialKey] || request.material?.toUpperCase() || 'PLA'
  const materialDescriptions: Record<string, string> = {
    pla: 'Rigid & High-Detail FDM',
    petg: 'Tough & Impact Resistant (Heat to 75°C)',
    abs: 'Durable & Structural (Heat to 95°C)',
    tpu: 'Flexible 95A Rubber-like Shockproof',
    nylon: 'High Tensile & Friction Resistant',
    pc: 'High-Temp Industrial Grade',
  }
  const materialSubtext = materialDescriptions[materialKey] || 'Direct-drive FDM Printing'

  // Color Details
  const activeColorName = request.color && request.color !== 'Any' ? request.color : 'Maker Decides'
  const activeColorHex =
    request.color_hex && request.color_hex.startsWith('#')
      ? request.color_hex
      : getColorHexByName(activeColorName)

  // Surface text
  const activeText =
    parsed && parsed.copies[0]
      ? (parsed.copies[0].name ?? '')
      : (() => {
          const surfaceTextMatch = notesStr.match(/Surface text: "([^"]+)"/i) || notesStr.match(/text: "([^"]+)"/i)
          return surfaceTextMatch?.[1] ?? ''
        })()

  // Primary file name
  const primaryFileName = (() => {
    if (sourceUrls.length > 0) {
      const u = sourceUrls[0]
      const raw = u.split('/').pop()?.split('?')[0] || '3D Model'
      return raw.replace(/^\d+_/, '')
    }
    return request.description?.replace(/Custom 3D print: /i, '').split('(')[0]?.trim() || 'Custom 3D Model'
  })()

  return (
    <div className="space-y-4">

      {/* ── 1. Authentic Ender-3 Bed 3D Viewer (Directly Reused from Homepage) ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Viewport Top Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-150 px-4 py-2.5 bg-slate-50/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 font-bold">
              <Box className="h-3.5 w-3.5" />
            </span>
            <div className="truncate">
              <h2 className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                <span>{primaryFileName}</span>
                <span className="text-[10px] font-normal text-slate-400">· Ender-3 V3 SE Bed (220×220mm)</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              <FileCode className="h-2.5 w-2.5" />
              {primaryFileName.toLowerCase().endsWith('.3mf') ? '3MF Package' : 'STL Model'}
            </span>
            {sourceUrls.length > 0 && (
              <a
                href={sourceUrls[0]}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-orange-600 transition shadow-2xs"
                title="Download source 3D file"
              >
                <Download className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
          </div>
        </div>

        {/* The Reusable Ender-3 3D Bed Viewer Component */}
        <Ender3BedViewerWrapper
          urls={sourceUrls}
          colorHex={activeColorHex}
          materialType={materialKey}
          fileName={primaryFileName}
          dimensions={dimensions}
          volumeCc={weightVal ? Math.max(0.5, weightVal / 1.25) : undefined}
          quantity={parsed?.copies.length || 1}
          className="border-0 shadow-none rounded-none"
          canvasHeight="h-[300px] sm:h-[340px] lg:h-[370px]"
        />
      </div>

      {/* ── 2. Compact & Dynamic Print Verification Card (Segmented Tabs) ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        {/* Card Header & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Print Verification Specs
              </h3>
            </div>
          </div>

          {/* Segmented Control Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`rounded-lg px-2.5 py-1 text-[11px] transition ${
                activeTab === 'specs'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Parameters
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fulfillment')}
              className={`rounded-lg px-2.5 py-1 text-[11px] transition ${
                activeTab === 'fulfillment'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Fulfillment &amp; Notes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`rounded-lg px-2.5 py-1 text-[11px] transition ${
                activeTab === 'files'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Files ({sourceUrls.length})
            </button>
          </div>
        </div>

        {/* TAB 1: Core Parameters (High-Density 4-Quadrant Grid) */}
        {activeTab === 'specs' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 animate-fade-in">
            {/* Box A: Material & Color */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Palette className="h-3 w-3 text-orange-500" />
                Material &amp; Color
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 rounded-md border border-slate-300 shadow-2xs shrink-0"
                  style={{ background: activeColorHex }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-none truncate">{materialLabel}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{activeColorName}</p>
                </div>
              </div>
            </div>

            {/* Box B: Infill Density */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-blue-500" />
                  Infill
                </span>
                <span className="text-blue-600 font-bold">{infillPct}%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, infillPct))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {infillPct <= 15 ? 'Light Prototype' : infillPct <= 35 ? 'Standard Rigid' : 'Heavy-Duty Solid'}
              </p>
            </div>

            {/* Box C: Bounding Box & Qty */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Maximize2 className="h-3 w-3 text-teal-500" />
                Size &amp; Qty
              </div>
              <p className="text-xs font-bold text-slate-900 font-mono leading-none">
                {dimensions ? `${dimensions.x}×${dimensions.y}×${dimensions.z}mm` : request.size || 'Standard'}
              </p>
              <p className="text-[10px] text-orange-600 font-semibold mt-0.5">
                Quantity: {quantityLabel}
              </p>
            </div>

            {/* Box D: Nozzle & Quality */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Nozzle &amp; Layer
              </div>
              <p className="text-xs font-bold text-slate-900 leading-none">
                {nozzleMm}mm Nozzle
              </p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                {QUALITY_LABELS[request.quality] || '0.2mm Standard'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Fulfillment & Notes */}
        {activeTab === 'fulfillment' && (
          <div className="space-y-2.5 pt-1 animate-fade-in text-xs">
            <div className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 p-3 border border-slate-150">
              {request.fulfillment === 'delivery' ? (
                <Truck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              ) : (
                <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  {request.fulfillment === 'delivery' ? 'Delivery Address' : 'Studio Self-Pickup Point'}
                </p>
                <p className="text-slate-700 mt-0.5 leading-relaxed font-medium">
                  {request.fulfillment === 'delivery'
                    ? request.delivery_address || 'Address provided to studio maker'
                    : pickupAddress || 'Ampang, Selangor, Malaysia (Near LRT Ampang)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Recipient: {request.customer_name} ({request.customer_phone})
                </p>
              </div>
            </div>

            {cleanNotes && (
              <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-150 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Customer Instructions
                </span>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-xs">
                  {cleanNotes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Parts & File Downloads */}
        {activeTab === 'files' && (
          <div className="space-y-2 pt-1 animate-fade-in">
            {activeText && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 flex items-center gap-2 text-xs">
                <span className="font-bold text-indigo-900">Custom Surface Engraving:</span>
                <span className="font-mono text-indigo-700">&ldquo;{activeText}&rdquo;</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {sourceUrls.map((url, i) => {
                const fname = url.split('/').pop()?.split('?')[0]?.replace(/^\d+_/, '') || `File ${i + 1}`
                return (
                  <a
                    key={url}
                    href={url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition shadow-2xs"
                  >
                    <Download className="h-3 w-3" />
                    <span>{sourceUrls.length > 1 ? `Part ${i + 1} (${fname})` : fname}</span>
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
