'use client'

import { useState, useRef, useEffect, useTransition, lazy, Suspense } from 'react'
import { Calendar, FileText, MessageSquare, ExternalLink, Upload, X, Loader2, FileCode2, Plus, Download } from 'lucide-react'
import type { PrintRequest, RequestStatus, RequestPrinterView, FilamentMaterial } from '@/lib/types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRINT_TYPE_LABELS,
  MATERIAL_LABELS,
  SIZE_LABELS,
  getStatusLabel,
  getWhatsAppLink,
  parseAssemblyMetadata,
  cleanDescription,
  getExcerpt,
} from '@/lib/types'
import { updateRequestStatus, updatePaymentStatus, sendQuote } from '@/lib/actions'
import {
  calculateEstimate,
  formatRM,
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_MARKUP_PERCENT,
  DEFAULT_MACHINE_RATE,
  DEFAULT_WASTE_PERCENT,
  DEFAULT_FILAMENT_COST_PER_KG,
} from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import { getPresetById } from '@/lib/printer-models'
import { parseGcodeFile } from '@/lib/parse-gcode'

const STLViewer = lazy(() => import('@/components/STLViewer'))

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://print3d-hub.vercel.app'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const selectClass =
  'rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-orange-400 focus:outline-none'

type GcodeItem = {
  id: string
  file: File
  parsing: boolean
  error: string
  stats: {
    weight_g: number | null
    print_hours: number | null
    layer_count: number | null
    slicer: string | null
  } | null
  material: FilamentMaterial
  color: string
  colorHex: string
}

function fmtHours(h: number | null | undefined): string {
  if (!h) return '—'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

export default function RequestCard({ request, printer, onCardDragStart }: { request: PrintRequest; printer: RequestPrinterView; onCardDragStart?: (e: React.DragEvent) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteDate, setQuoteDate] = useState('')
  const [quoteMessage, setQuoteMessage] = useState('')
  const [confirmedAddons, setConfirmedAddons] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Payment status state
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState<'pending' | 'paid' | 'unpaid' | 'refunded'>(
    request.payment_status ?? 'pending'
  )

  useEffect(() => {
    setCurrentPaymentStatus(request.payment_status ?? 'pending')
  }, [request.payment_status])

  function handlePaymentUpdate(newStatus: 'pending' | 'paid' | 'unpaid') {
    setCurrentPaymentStatus(newStatus)
    startTransition(async () => {
      const err = await updatePaymentStatus(request.id, newStatus)
      if (err?.error) {
        setActionError(err.error)
        setCurrentPaymentStatus(request.payment_status ?? 'pending')
      }
    })
  }

  const gcodeInputRef = useRef<HTMLInputElement>(null)
  const [gcodeItems, setGcodeItems] = useState<GcodeItem[]>([])
  const [quoteMarkup, setQuoteMarkup] = useState(printer.markup_percent ?? DEFAULT_MARKUP_PERCENT)
  const [quotePrice, setQuotePrice] = useState('')
  const updatingFromPrice = useRef(false)
  const [breakdown, setBreakdown] = useState<{
    perPlate: { label: string; cost: number }[]
    electricityCost: number
    machineCost: number
    wasteCost: number
    baseCost: number
    markup: number
    total: number
    powerWatts: number
    electricityRate: number
    markupPct: number
  } | null>(null)

  // Delivery cost breakdown (delivery orders only)
  const [deliveryCost, setDeliveryCost] = useState('')

  // Quote model upload (3D file for customer 360° review)
  const defaultModelUrl = request.quote_model_url || request.stl_urls?.[0] || request.file_url || null
  const previewInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultModelUrl)
  const [previewUploading, setPreviewUploading] = useState(false)
  const [machineRate, setMachineRate] = useState<number>(printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE)

  // Delivery auto-calculation
  const [deliveryCalcKm, setDeliveryCalcKm] = useState<number | null>(null)
  const [deliveryCalcLoading, setDeliveryCalcLoading] = useState(false)
  const [deliveryCalcError, setDeliveryCalcError] = useState('')

  const defaultMaterial = (request.material ?? 'pla') as FilamentMaterial
  const defaultColorHex = request.color && request.color !== 'Any' ? (request.color_hex || '#888888') : '#888888'
  const defaultColorName = request.color && request.color !== 'Any' ? request.color : ''

  const modelPowerWatts = getPresetById(printer.printer_model_id ?? '')?.power_watts ?? 200

  const estimate =
    printer.filament_costs && printer.filament_costs[defaultMaterial]
      ? calculateEstimate({
          size: request.size,
          quality: request.quality,
          material: defaultMaterial,
          power_watts: modelPowerWatts,
          cost_per_kg: printer.filament_costs[defaultMaterial]!,
          electricity_rate:      printer.electricity_rate      ?? DEFAULT_ELECTRICITY_RATE,
          markup_percent:        printer.markup_percent        ?? DEFAULT_MARKUP_PERCENT,
          machine_rate_per_hour: printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE,
          waste_percent:         printer.waste_percent         ?? DEFAULT_WASTE_PERCENT,
          // Customer's STL was auto-sliced at request time — use the real measurement
          // instead of the generic size-bucket guess, when available.
          known_weight_g: request.weight_g,
          known_hours:    request.print_hours,
        })
      : null

  const totalWeight = gcodeItems.reduce((s, i) => s + (i.stats?.weight_g ?? 0), 0)
  const totalHours  = gcodeItems.reduce((s, i) => s + (i.stats?.print_hours ?? 0), 0)
  const totalLayers = gcodeItems.reduce((s, i) => s + (i.stats?.layer_count ?? 0), 0)
  const allDone     = gcodeItems.length > 0 && gcodeItems.every((i) => !i.parsing)
  const anyStats    = gcodeItems.some((i) => i.stats?.weight_g != null)

  // Recalculate price whenever per-plate materials/stats or markup changes
  useEffect(() => {
    if (!anyStats) return
    const powerWatts  = modelPowerWatts
    const elecRate    = printer.electricity_rate ?? DEFAULT_ELECTRICITY_RATE
    const markupPct   = quoteMarkup

    const perPlate = gcodeItems
      .filter((i) => (i.stats?.weight_g ?? 0) > 0)
      .map((i, idx) => {
        const w         = i.stats!.weight_g!
        const costPerKg = printer.filament_costs?.[i.material] ?? DEFAULT_FILAMENT_COST_PER_KG[i.material] ?? 55
        const cost      = (w / 1000) * costPerKg
        return {
          label: `Plate ${idx + 1} — ${w}g ${MATERIAL_LABELS[i.material]}${i.color ? ` (${i.color})` : ''} @ RM${costPerKg}/kg`,
          cost,
        }
      })

    const wastePct          = printer.waste_percent         ?? DEFAULT_WASTE_PERCENT
    const totalFilamentCost = perPlate.reduce((s, p) => s + p.cost, 0)

    const cpkg = totalWeight > 0 ? (totalFilamentCost / (totalWeight / 1000)) : 0
    const est = calculateEstimate({
      size: 'medium',
      quality: 'basic',
      material: gcodeItems[0]?.material ?? 'pla',
      power_watts: powerWatts,
      cost_per_kg: cpkg,
      electricity_rate: elecRate,
      markup_percent: markupPct,
      machine_rate_per_hour: machineRate,
      waste_percent: wastePct,
      known_weight_g: totalWeight,
      known_hours: totalHours,
    })

    setBreakdown({
      perPlate,
      electricityCost: est.electricity_cost,
      machineCost: est.machine_cost,
      wasteCost: est.waste_cost,
      baseCost: est.base_cost,
      markup: est.suggested_price - est.base_cost,
      total: est.suggested_price,
      powerWatts,
      electricityRate: elecRate,
      markupPct
    })
    if (!updatingFromPrice.current) setQuotePrice(est.suggested_price.toFixed(2))
    updatingFromPrice.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcodeItems, quoteMarkup, anyStats, totalHours, machineRate])

  const isEastMalaysia = (addr: string) => {
    return /\b(sabah|sarawak|labuan|kuching|miri|sibu|bintulu|kota kinabalu|sandakan|tawau|lahad datu|keningau)\b/i.test(addr) ||
      /\b(87\d{3}|8[8-9]\d{3}|9[0-8]\d{3})\b/.test(addr)
  }

  // Auto-set realistic Malaysian delivery fee (Pos Laju / J&T parcel standard)
  useEffect(() => {
    if (!showQuoteForm || request.fulfillment !== 'delivery') return
    const addr = request.delivery_address?.trim() || ''
    if (deliveryCost && parseFloat(deliveryCost) > 0) return

    if (isEastMalaysia(addr)) {
      setDeliveryCost('15.00')
    } else {
      setDeliveryCost('8.00')
    }
  }, [showQuoteForm, request.fulfillment, request.delivery_address, deliveryCost])

  function handleQuotePriceChange(val: string) {
    setQuotePrice(val)
    const price = parseFloat(val)
    const baseCost = breakdown?.baseCost ?? (estimate && !anyStats ? estimate.base_cost : null)
    if (!isNaN(price) && baseCost != null && baseCost > 0) {
      updatingFromPrice.current = true
      setQuoteMarkup(Math.max(0, Math.round(((price - baseCost) / baseCost) * 1000) / 10))
    }
  }

  function openQuoteForm() {
    setQuoteDate('')
    setQuoteMessage('')
    setGcodeItems([])
    setQuoteMarkup(printer.markup_percent ?? DEFAULT_MARKUP_PERCENT)
    setBreakdown(null)
    setQuotePrice('')
    setPreviewUrl(defaultModelUrl)
    // Pre-check every requested addon — owner reviews and unchecks any they couldn't apply
    const addons = new Set<string>()
    if (request.supports) addons.add('supports')
    for (const a of (request.selected_addons ?? [])) addons.add(a)
    setConfirmedAddons(addons)
    setShowQuoteForm(true)
  }

  async function parseGcodeLocally(item: GcodeItem) {

    try {
      const stats = await parseGcodeFile(item.file)
      setGcodeItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, parsing: false, stats } : i),
      )
    } catch {
      setGcodeItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, parsing: false } : i)),
      )
    }
  }

  function addGcodeFiles(files: FileList | File[]) {
    const startIdx = gcodeItems.length
    const sortedPrefs = [...(request.color_preferences ?? [])].sort((a, b) => a.part_number - b.part_number)
    const newItems: GcodeItem[] = Array.from(files)
      .filter((f) => /\.(gcode|bgcode)$/i.test(f.name))
      .map((f, i) => {
        const pref = sortedPrefs[startIdx + i]
        return {
          id: crypto.randomUUID(),
          file: f,
          parsing: true,
          error: '',
          stats: null,
          material: defaultMaterial,
          color: pref?.color || defaultColorName,
          colorHex: pref?.color_hex || defaultColorHex,
        }
      })
    if (!newItems.length) return
    setGcodeItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => parseGcodeLocally(item))
  }

  function updatePlate(id: string, patch: Partial<Pick<GcodeItem, 'material' | 'color' | 'colorHex'>>) {
    setGcodeItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function removeGcode(id: string) {
    setGcodeItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function handlePreviewFile(file: File) {
    setPreviewUploading(true)
    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `quote-models/${request.id}_${Date.now()}_${safeName}`
    const { data: uploadData } = await supabase.storage.from('stl-files').upload(path, file)
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
      setPreviewUrl(urlData.publicUrl)
    }
    setPreviewUploading(false)
    if (previewInputRef.current) previewInputRef.current.value = ''
  }

  function handleStatusUpdate(newStatus: RequestStatus) {
    setActionError('')
    startTransition(async () => {
      const result = await updateRequestStatus(request.id, newStatus)
      if (result?.error) setActionError(result.error)
    })
  }

  function handleSendQuote() {
    const finalPrice = parseFloat(quotePrice)
    if (!finalPrice || isNaN(finalPrice)) {
      setActionError('Please upload G-code to calculate the price, or enter a quote price.')
      return
    }
    if (!quoteDate) {
      setActionError('Please select an estimated completion date.')
      return
    }
    if (gcodeItems.length === 0) {
      setActionError('Upload the sliced G-code file before sending the quote.')
      return
    }
    if (!allDone) {
      setActionError('Please wait for the G-code file to finish reading.')
      return
    }
    setActionError('')
    startTransition(async () => {
      // 1. Upload sliced G-code files to Supabase Storage so maker can download them anytime later
      const supabase = createClient()
      const uploadedGcodeUrls: string[] = []
      for (const item of gcodeItems) {
        const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `gcodes/${request.id}/${Date.now()}_${safeName}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('stl-files')
          .upload(path, item.file, { upsert: true })
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
          uploadedGcodeUrls.push(urlData.publicUrl)
        } else if (uploadErr) {
          console.error('Gcode upload error:', uploadErr)
        }
      }

      const plateFilaments = gcodeItems.map((i) => ({
        material: i.material,
        color: i.color,
        color_hex: i.colorHex,
        weight_g: i.stats?.weight_g ?? null,
      }))
      // Primary material = first plate's material, or customer's requested material
      const primaryMaterial = gcodeItems[0]?.material ?? defaultMaterial
      const parsedDeliveryCost = parseFloat(deliveryCost) > 0 ? parseFloat(deliveryCost) : null
      const modelToUse = previewUrl || defaultModelUrl || undefined

      const result = await sendQuote(
        request.id,
        Math.round(finalPrice * 100) / 100,
        quoteDate,
        quoteMessage,
        uploadedGcodeUrls.length > 0 ? uploadedGcodeUrls : undefined,
        totalWeight > 0 ? Math.round(totalWeight * 10) / 10 : null,
        totalHours  > 0 ? Math.round(totalHours  * 10) / 10 : null,
        primaryMaterial,
        plateFilaments.length ? plateFilaments : undefined,
        [...confirmedAddons],
        parsedDeliveryCost,
        undefined,
        modelToUse,
      )
      if (result?.error) setActionError(result.error)
      else setShowQuoteForm(false)
    })
  }

  const isCatalogOrder = !!request.catalog_item_id

  const TERMINAL = new Set<RequestStatus>(['collected', 'declined', 'cancelled', 'reviewed'])
  const daysUntilDeadline = Math.ceil(
    (new Date(request.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  const isUrgent = !TERMINAL.has(request.status) && daysUntilDeadline <= 2

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
        isUrgent ? 'border-red-300' : 'border-slate-200'
      }`}
    >
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        draggable={!!onCardDragStart}
        onDragStart={onCardDragStart}
        className="flex w-full flex-col gap-3 p-4 text-left hover:bg-slate-50 transition"
      >
        {/* Header Row (Name + Status Badge + Arrow) */}
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-900 truncate text-sm">{request.customer_name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${STATUS_COLORS[request.status]}`}>
              {getStatusLabel(request.status, request.fulfillment)}
            </span>
          </div>
          <span className="text-slate-350 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
        </div>

        {/* Subtitle / Description */}
        <p className="text-xs text-slate-500 font-medium line-clamp-2 w-full">
          {request.model_title || getExcerpt(request.description, 95) || 'No description provided'}
        </p>

        {/* Tag / Chip row */}
        <div className="flex flex-wrap items-center gap-1.5 w-full">
          {/* Request Type Tag */}
          {(() => {
            const isCatalog = !!request.catalog_item_id
            const hasStl = !!(request.stl_url || request.stl_urls?.length > 0 || request.file_url)
            return isCatalog ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                🛍️ Shop Order
              </span>
            ) : hasStl ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                ⚙️ Custom STL
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                🔗 Reference
              </span>
            )
          })()}

          {/* Fulfillment Mode Tag */}
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            request.fulfillment === 'delivery'
              ? 'bg-blue-50 border-blue-100 text-blue-600'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            {request.fulfillment === 'delivery' ? '🚚 Delivery' : '🏠 Pickup'}
          </span>

          {/* Material + Color Tag */}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            {request.color && request.color !== 'Any' && (
              <span className="h-2 w-2 rounded-full border border-slate-350 shrink-0" style={{ background: request.color_hex || '#888' }} />
            )}
            {MATERIAL_LABELS[request.material] ?? request.material}
            {request.color && request.color !== 'Any' ? ` · ${request.color}` : ''}
          </span>

          {/* Payment Status Tag */}
          {(request.status === 'accepted' || request.status === 'printing' || request.status === 'done' || request.status === 'shipping' || request.status === 'collected') && (
            currentPaymentStatus === 'paid' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                💳 Paid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                ⏳ Unpaid
              </span>
            )
          )}

          {/* G-code Stored Tag */}
          {(request.gcode_urls?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-700">
              💾 G-code Ready ({request.gcode_urls.length})
            </span>
          )}
        </div>

        {/* Footer Row (Expected Due Date + Price) */}
        <div className="flex items-center justify-between w-full border-t border-slate-100 pt-2.5 mt-0.5">
          {/* Due Date */}
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${isUrgent ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isUrgent && daysUntilDeadline <= 0
                ? 'Overdue!'
                : `Due ${new Date(request.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </span>
          </div>

          {/* Price & Payment Status */}
          {request.quoted_price && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5">
                RM {((request.quoted_price ?? 0) + (request.delivery_cost ?? 0)).toFixed(2)}
              </span>
              {currentPaymentStatus === 'paid' && (
                <span className="text-[10px] font-bold text-emerald-600">✓ Paid</span>
              )}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          draggable="false"
          onDragStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setExpanded(false)} />
          
          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Details</p>
                <h3 className="text-base font-bold text-slate-900">
                  {request.customer_name} · #{request.id.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-left">
              {isCatalogOrder && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 flex gap-4 items-start">
                  {request.model_image ? (
                    <img
                      src={request.model_image}
                      alt={request.model_title || 'Product photo'}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover border border-emerald-100 bg-white"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">
                      🛍️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Catalog Product</p>
                    <h4 className="text-base font-extrabold text-slate-900 mt-0.5">{request.model_title || 'Unknown Catalog Product'}</h4>
                    {request.catalog_item_id && (
                      <p className="text-xs text-slate-500 mt-1">
                        Product ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">{request.catalog_item_id.slice(0, 8)}</code>
                      </p>
                    )}
                  </div>
                </div>
              )}
          {/* 3D preview with customer's chosen colors */}
          {(() => {
            const stlUrls = (request.stl_urls?.length ?? 0) > 0
              ? request.stl_urls
              : request.stl_url ? [request.stl_url]
              : request.file_url ? [request.file_url]
              : []
            if (stlUrls.length === 0) return null

            // Build per-file, per-part color arrays from color_preferences
            const prefs = request.color_preferences ?? []
            const fileNames: string[] = []
            const seenParts = new Set<number>()
            for (const p of prefs) {
              if (!seenParts.has(p.part_number)) {
                seenParts.add(p.part_number)
                fileNames.push(p.file_name ?? '')
              }
            }
            while (fileNames.length < stlUrls.length) {
              fileNames.push(stlUrls[fileNames.length].split('/').pop() ?? '')
            }
            const requestHexes = request.color_hex ? request.color_hex.split('|') : []
            const colorsByFile = stlUrls.map((_, idx) => {
              const sorted = prefs
                .filter((p) => p.part_number === idx + 1)
                .sort((a, b) => (a.part_index ?? 1) - (b.part_index ?? 1))
              const chosenHex = requestHexes[idx] && requestHexes[idx] !== '#888888' ? requestHexes[idx] : null
              return {
                color: sorted[0]?.color_hex || chosenHex || '#cccccc',
                parts: sorted.length > 1 ? sorted.map((p) => p.color_hex || '#cccccc') : [] as string[],
              }
            })
            return (
              <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 200 }}>
                <Suspense fallback={
                  <div className="h-full flex items-center justify-center bg-slate-50 text-xs text-slate-400">
                    Loading 3D preview…
                  </div>
                }>
                  <STLViewer
                    urls={stlUrls}
                    fileNames={fileNames}
                    colors={colorsByFile.map((c) => c.color)}
                    partColors={colorsByFile.map((c) => c.parts)}
                    assemblyOffsets={parseAssemblyMetadata(request.description)}
                    className="h-full"
                  />
                </Suspense>
              </div>
            )
          })()}

          {/* Specs */}
          {(() => {
            // Parse special lines out of notes so they can get their own callout sections
            const rawNotes = (request.notes ?? '').replace(/^\[\d+\.?\d*×\d+\.?\d*×\d+\.?\d*mm\]\s*/, '').trim()
            const insertMatch  = rawNotes.match(/\nEmbedded inserts: ([^\n]+)/)
            const surfaceMatch = rawNotes.match(/\nSurface text: "([^"]+)"/)
            const insertText  = insertMatch?.[1]?.trim() ?? null
            const surfaceText = surfaceMatch?.[1]?.trim() ?? null
            const cleanNotes  = rawNotes
              .replace(/\nEmbedded inserts: [^\n]+/, '')
              .replace(/\nSurface text: "[^"]*"/, '')
              .trim()

            const hasSupports = request.supports || request.selected_addons?.includes('supports')
            const declinedSupports = (request.declined_addons ?? []).includes('supports')
            // Tags shown inline: ironing, fuzzy_skin, color_change (AMS). pause_insert and text_on_surface get callout sections.
            const inlineTags = (request.selected_addons ?? []).filter(
              (a) => !['supports', 'pause_insert', 'text_on_surface'].includes(a),
            )
            const declinedInlineTags = (request.declined_addons ?? []).filter(
              (a) => !['supports', 'pause_insert', 'text_on_surface'].includes(a),
            )
            const ADDON_LABELS: Record<string, string> = {
              ironing: 'Ironing',
              color_change: 'Multi-color / AMS',
              fuzzy_skin: 'Fuzzy skin',
            }

            return (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-slate-400">Print type</span>
                    <span className="ml-2 font-medium text-slate-900">{PRINT_TYPE_LABELS[request.print_type]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Material</span>
                    <span className="font-medium text-slate-900">{MATERIAL_LABELS[request.material]}</span>
                    {request.color && request.color !== 'Any' && !request.color.includes('|') && (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border border-slate-200 shadow-sm" style={{ background: request.color_hex || '#888' }} />
                        <span className="text-slate-500">{request.color}</span>
                      </>
                    )}
                  </div>

                  {request.color && request.color !== 'Any' && request.color.includes('|') && (
                    <div className="col-span-2 mt-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2 w-full">
                      <p className="text-xs font-semibold text-slate-600">Part Colors:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(request.stl_urls && request.stl_urls.length > 0 ? request.stl_urls : []).map((url, i) => {
                          const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${i + 1}`
                          const colors = request.color.split('|')
                          const hexes = (request.color_hex || '').split('|')
                          const partColor = colors[i] || 'Any'
                          const partHex = hexes[i] || '#888888'
                          return (
                            <div key={url} className="flex items-center gap-1.5 min-w-0">
                              <span className="text-slate-400 truncate max-w-[60%]">{filename}:</span>
                              <span className="h-2.5 w-2.5 rounded-full border border-slate-250 shrink-0" style={{ background: partHex }} />
                              <span className="font-medium text-slate-700">{partColor === 'Any' ? 'Owner Decides' : partColor}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const m = request.notes?.match(/^\[(\d+\.?\d*)×(\d+\.?\d*)×(\d+\.?\d*)mm\]/)
                    if (!m) return null
                    return (
                      <div>
                        <span className="text-slate-400">Size</span>
                        <span className="ml-2 font-medium text-slate-900">{m[1]} × {m[2]} × {m[3]} mm</span>
                      </div>
                    )
                  })()}
                  <div>
                    <span className="text-slate-400">Quality</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {request.quality === 'advanced' ? 'Advanced' : 'Basic'}
                    </span>
                  </div>
                  {(hasSupports || declinedSupports || inlineTags.length > 0 || declinedInlineTags.length > 0) && (
                    <div className="col-span-2 flex flex-wrap gap-1.5">
                      {hasSupports && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Supports</span>
                      )}
                      {declinedSupports && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">✗ No supports</span>
                      )}
                      {inlineTags.map((addon) => (
                        <span key={addon} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {ADDON_LABELS[addon] ?? addon}
                        </span>
                      ))}
                      {declinedInlineTags.map((addon) => (
                        <span key={`no-${addon}`} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">
                          ✗ No {(ADDON_LABELS[addon] ?? addon).toLowerCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Embedded inserts callout */}
                {request.selected_addons?.includes('pause_insert') && (
                  <div className="rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">⏸ Embedded inserts requested</p>
                    {insertText
                      ? <p className="text-sm text-yellow-900">{insertText}</p>
                      : <p className="text-xs text-yellow-600 italic">Customer did not specify details — ask before slicing.</p>}
                  </div>
                )}

                {/* Surface text callout */}
                {request.selected_addons?.includes('text_on_surface') && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <p className="text-xs font-semibold text-indigo-700 mb-1">✏️ Text on surface requested</p>
                    {surfaceText
                      ? <p className="text-sm font-medium text-indigo-900">"{surfaceText}"</p>
                      : <p className="text-xs text-indigo-600 italic">Customer did not enter text — ask before slicing.</p>}
                  </div>
                )}

                {/* Notes — special lines already extracted above */}
                {cleanNotes ? (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 whitespace-pre-line">
                    <MessageSquare className="mb-0.5 mr-1 inline h-3.5 w-3.5 text-slate-400" />
                    {cleanNotes}
                  </div>
                ) : null}
              </>
            )
          })()}

          {/* Customer's per-part color preferences */}
          {(request.color_preferences?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
              <p className="text-xs font-medium text-violet-600 mb-2">
                Customer color preferences · {request.color_preferences.length} part{request.color_preferences.length > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {request.color_preferences.map((pref) => (
                  <span key={pref.part_number} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-violet-200 px-2.5 py-1 text-xs text-violet-800">
                    <span className="h-2.5 w-2.5 rounded-full border border-violet-200" style={{ background: pref.color_hex || '#888' }} />
                    {request.color_preferences.length > 1 && `Part ${pref.part_number} · `}
                    {pref.color || 'Any'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Machine G-code Files & Downloads */}
          {(request.gcode_urls?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-teal-600" />
                  <p className="text-xs font-bold text-teal-900">
                    Stored G-code Files · {request.gcode_urls.length} plate{request.gcode_urls.length > 1 ? 's' : ''}
                  </p>
                </div>
                <span className="rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 border border-teal-200">
                  Ready to Print
                </span>
              </div>

              {/* Plate filament chips */}
              {(request.plate_filaments?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {request.plate_filaments.map((pf, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white border border-teal-200 px-2 py-0.5 text-xs text-teal-800">
                      <span className="h-2.5 w-2.5 rounded-full border border-teal-300" style={{ background: pf.color_hex || '#888' }} />
                      Plate {i + 1} · {MATERIAL_LABELS[pf.material]} {pf.color && `· ${pf.color}`}
                    </span>
                  ))}
                </div>
              )}

              {(request.weight_g || request.print_hours) && (
                <div className="flex gap-4 text-xs font-medium text-teal-800 border-t border-teal-200/50 pt-2">
                  {request.weight_g   && <span>~{request.weight_g}g filament</span>}
                  {request.print_hours && <span>~{fmtHours(request.print_hours)} print time</span>}
                </div>
              )}

              {/* G-code Download Actions */}
              <div className="pt-2 border-t border-teal-200/50 space-y-2">
                <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                  Transfer to Printer:
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                  {request.gcode_urls.map((url, i) => {
                    const rawName = url.split('/').pop()?.replace(/^\d+_/, '') || `plate_${i + 1}.gcode`
                    return (
                      <a
                        key={url}
                        href={url}
                        download={rawName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-white border border-teal-300 hover:border-teal-500 hover:bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 shadow-2xs transition active:scale-98"
                      >
                        <Download className="h-4 w-4 text-teal-600" />
                        <span>Download {rawName}</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Model source */}
          {request.model_url && (
            <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
              {request.model_image && (
                <img src={request.model_image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              )}
              <div className="min-w-0">
                <p className="mb-0.5 text-xs font-medium text-blue-500">Model source</p>
                {request.model_title && <p className="text-sm font-semibold text-slate-900 leading-snug">{request.model_title}</p>}
                <a href={request.model_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition break-all">
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {request.model_url}
                </a>
              </div>
            </div>
          )}


          {/* STL files */}
          {((request.stl_urls?.length ?? 0) > 0 || request.stl_url || request.file_url) && (
            <div className="flex flex-wrap gap-2">
              {((request.stl_urls?.length ?? 0) > 0 ? request.stl_urls : [request.stl_url ?? request.file_url ?? '']).map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600">
                  <FileText className="h-4 w-4" />
                  {(request.stl_urls?.length ?? 0) > 1 ? `File ${i + 1}` : 'Download STL'}
                </a>
              ))}
            </div>
          )}

          {/* Existing quote summary */}
          {request.quoted_price && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm">
              <p className="font-medium text-amber-900">
                {isCatalogOrder ? (
                  <>Catalog price: RM{request.quoted_price}</>
                ) : (
                  <>
                    Quote sent: RM{request.quoted_price} · Ready by{' '}
                    {request.quoted_by_date && new Date(request.quoted_by_date).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </>
                )}
              </p>
              {request.quote_message && <p className="mt-1 text-amber-700">{request.quote_message}</p>}
            </div>
          )}

          {/* Fulfillment */}
          <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            request.fulfillment === 'delivery'
              ? 'border-blue-100 bg-blue-50'
              : 'border-slate-100 bg-slate-50'
          }`}>
            <span className="text-base leading-none mt-0.5">
              {request.fulfillment === 'delivery' ? '🚚' : '🏠'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <span>
                  {request.fulfillment === 'delivery' ? 'Delivery requested' : 'Pickup'}
                  {request.fulfillment === 'delivery' && printer.delivery_rate_per_km && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      RM {Number(printer.delivery_rate_per_km).toFixed(2)}/km
                    </span>
                  )}
                </span>
                {request.fulfillment === 'delivery' && request.delivery_address && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(request.delivery_address)}${
                      printer.lat && printer.lng ? `&origin=${printer.lat},${printer.lng}` : ''
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Get Directions
                  </a>
                )}
              </p>
              {request.fulfillment === 'delivery' && request.delivery_address && (
                <p className="text-xs text-slate-500 mt-1">{request.delivery_address}</p>
              )}
              {request.fulfillment === 'pickup' && printer.pickup_address && (
                <p className="text-xs text-slate-500 mt-0.5">{printer.pickup_address}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="text-xs text-slate-400">{request.customer_email} · {request.customer_phone}</div>

          {/* ── Quote form ── */}
          {showQuoteForm && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 space-y-4">
              <p className="text-sm font-semibold text-slate-800">Send a quote</p>

              {/* G-code upload */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">
                  G-code files{' '}
                  <span className="font-normal text-slate-400">— slice in your slicer, upload each plate</span>
                </p>

                {gcodeItems.length === 0 ? (
                  <label
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-orange-200 bg-white px-4 py-6 text-center hover:border-orange-400 hover:bg-orange-50/50 transition"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); addGcodeFiles(e.dataTransfer.files) }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                      <Upload className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Drop .gcode files here</p>
                      <p className="text-xs text-slate-400 mt-0.5">or click to browse · .gcode and .bgcode accepted</p>
                    </div>
                    <input type="file" accept=".gcode,.bgcode" multiple className="hidden"
                      onChange={(e) => { if (e.target.files) addGcodeFiles(e.target.files) }} />
                  </label>
                ) : (
                  <div className="space-y-2">
                    {gcodeItems.map((item, idx) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        {/* Plate header row */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <FileCode2 className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="flex-1 truncate text-sm text-slate-700">{item.file.name}</span>

                          {item.parsing && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Loader2 className="h-3 w-3 animate-spin" /> Reading
                            </span>
                          )}
                          {!item.parsing && item.stats && (
                            <span className="shrink-0 text-xs font-medium text-teal-600">
                              {item.stats.weight_g != null && `${item.stats.weight_g}g`}
                              {item.stats.weight_g != null && item.stats.print_hours != null && ' · '}
                              {item.stats.print_hours != null && fmtHours(item.stats.print_hours)}
                              {item.stats.layer_count ? ` · ${item.stats.layer_count} layers` : ''}
                            </span>
                          )}
                          {!item.parsing && !item.stats && !item.error && (
                            <span className="shrink-0 text-xs text-slate-400">No stats found</span>
                          )}
                          {item.error && <span className="shrink-0 text-xs text-red-500">{item.error}</span>}

                          <button type="button" onClick={() => removeGcode(item.id)}
                            className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-700 transition">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Per-plate filament selector */}
                        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
                          <span className="text-xs text-slate-500 shrink-0">Plate {idx + 1} filament:</span>

                          <select
                            value={item.material}
                            onChange={(e) => updatePlate(item.id, { material: e.target.value as FilamentMaterial })}
                            className={selectClass}
                          >
                            {(Object.entries(MATERIAL_LABELS) as [FilamentMaterial, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>

                          <input
                            type="text"
                            placeholder="Color name"
                            value={item.color}
                            onChange={(e) => updatePlate(item.id, { color: e.target.value })}
                            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none"
                          />

                          <div className="relative shrink-0">
                            <input
                              type="color"
                              value={item.colorHex}
                              onChange={(e) => updatePlate(item.id, { colorHex: e.target.value })}
                              className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0.5"
                              title="Pick color"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Totals row */}
                    {allDone && anyStats && (
                      <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs">
                        <span className="font-medium text-teal-800">
                          {gcodeItems.length > 1 && `${gcodeItems.length} plates · `}Total:
                        </span>
                        <span className="ml-1 text-teal-700">
                          {totalWeight > 0 && `~${Math.round(totalWeight * 10) / 10}g filament`}
                          {totalWeight > 0 && totalHours > 0 && ' · '}
                          {totalHours > 0 && `~${fmtHours(totalHours)} print time`}
                          {totalLayers > 0 && ` · ${totalLayers} layers`}
                        </span>
                      </div>
                    )}

                    <button type="button" onClick={() => gcodeInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition">
                      <Plus className="h-3.5 w-3.5" /> Add another plate
                    </button>
                    <input ref={gcodeInputRef} type="file" accept=".gcode,.bgcode" multiple className="hidden"
                      onChange={(e) => { if (e.target.files) { addGcodeFiles(e.target.files); e.target.value = '' } }} />

                    {/* Model preview in-context with G-code stats */}
                    {previewUrl && (
                      <Suspense fallback={<div className="h-44 rounded-xl bg-slate-100 animate-pulse" />}>
                        <STLViewer
                          urls={[previewUrl]}
                          colors={[gcodeItems[0]?.colorHex || defaultColorHex || '#e0e0e0']}
                          className="h-44 w-full rounded-xl border border-slate-200"
                        />
                      </Suspense>
                    )}
                  </div>
                )}
              </div>

              {/* 3D model file status & optional override */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-slate-700">
                    3D Model Preview <span className="text-[11px] font-normal text-slate-400">(Optional — customer&apos;s model is active)</span>
                  </p>
                  {previewUrl && previewUrl !== defaultModelUrl && defaultModelUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(defaultModelUrl)}
                      className="text-[11px] font-medium text-orange-600 hover:underline"
                    >
                      Reset to customer&apos;s model
                    </button>
                  )}
                </div>

                {previewUrl ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                        <span className="text-xs font-semibold text-teal-800">
                          {previewUrl === defaultModelUrl
                            ? 'Customer’s original 3D model active'
                            : 'Revised 3D model uploaded'}
                        </span>
                      </div>
                      <p className="text-[11px] text-teal-600 truncate mt-0.5 font-mono">
                        {previewUrl.split('/').pop()?.split('?')[0] || 'model.stl'}
                      </p>
                    </div>
                    <label className="cursor-pointer shrink-0 rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 transition shadow-2xs">
                      Replace
                      <input
                        ref={previewInputRef}
                        type="file"
                        accept=".stl,.3mf,.obj"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePreviewFile(f) }}
                      />
                    </label>
                  </div>
                ) : (
                  <label
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-5 text-center hover:border-orange-300 hover:bg-orange-50/40 transition ${previewUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePreviewFile(f) }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                      <Upload className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700">
                        {previewUploading ? 'Uploading…' : 'Optional: Upload revised 3D model'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Only needed if you altered the STL/3MF geometry</p>
                    </div>
                    <input ref={previewInputRef} type="file" accept=".stl,.3mf,.obj" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePreviewFile(f) }} />
                  </label>
                )}
              </div>

              {/* ── Feature confirmation checklist ── */}
              {(() => {
                const addonsToConfirm: { key: string; label: string; detail?: string }[] = []
                const rawNotes = (request.notes ?? '').replace(/^\[\d+\.?\d*×\d+\.?\d*×\d+\.?\d*mm\]\s*/, '').trim()
                const insertText  = rawNotes.match(/\nEmbedded inserts: ([^\n]+)/)?.[1]?.trim()
                const surfaceText = rawNotes.match(/\nSurface text: "([^"]+)"/)?.[1]?.trim()

                if (request.supports || request.selected_addons?.includes('supports'))
                  addonsToConfirm.push({ key: 'supports', label: 'Support structures' })
                for (const a of (request.selected_addons ?? [])) {
                  if (a === 'supports') continue
                  const LABELS: Record<string, string> = {
                    ironing: 'Ironing (smooth top)',
                    color_change: 'Multi-color / AMS',
                    fuzzy_skin: 'Fuzzy skin texture',
                    pause_insert: 'Embedded inserts',
                    text_on_surface: 'Text on surface',
                  }
                  addonsToConfirm.push({
                    key: a,
                    label: LABELS[a] ?? a,
                    detail: a === 'pause_insert' ? insertText : a === 'text_on_surface' ? (surfaceText ? `"${surfaceText}"` : undefined) : undefined,
                  })
                }

                const declinedAddons = request.declined_addons ?? []
                const ADDON_CONFIRM_LABELS: Record<string, string> = {
                  supports: 'Support structures',
                  ironing: 'Ironing (smooth top)',
                  color_change: 'Multi-color / AMS',
                  fuzzy_skin: 'Fuzzy skin texture',
                  pause_insert: 'Embedded inserts',
                  text_on_surface: 'Text on surface',
                }

                if (addonsToConfirm.length === 0 && declinedAddons.length === 0) return null
                return (
                  <div className="rounded-xl border border-orange-200 bg-white p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-0.5">Confirm applied features</p>
                    <p className="text-[11px] text-slate-400 mb-3">
                      These were requested by the customer. Tick what you have set up in the sliced file — uncheck anything you couldn&apos;t apply.
                    </p>
                    {addonsToConfirm.length > 0 && (
                      <div className="space-y-2">
                        {addonsToConfirm.map(({ key, label, detail }) => {
                          const checked = confirmedAddons.has(key)
                          return (
                            <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setConfirmedAddons((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(key)) next.delete(key)
                                    else next.add(key)
                                    return next
                                  })
                                }}
                                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-orange-500"
                              />
                              <div>
                                <span className={`text-xs font-medium ${checked ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                  {label}
                                </span>
                                {detail && (
                                  <p className={`text-[11px] mt-0.5 ${checked ? 'text-slate-500' : 'text-slate-300'}`}>{detail}</p>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                    {declinedAddons.length > 0 && (
                      <div className={`${addonsToConfirm.length > 0 ? 'mt-3 pt-3 border-t border-slate-100' : ''}`}>
                        <p className="text-[11px] font-semibold text-red-500 mb-1">Customer said NO to:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {declinedAddons.map((key) => (
                            <span key={key} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-500">
                              ✗ {ADDON_CONFIRM_LABELS[key] ?? key}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── Price breakdown (strictly G-code driven) ── */}
              {(() => {
                const bd = breakdown
                if (!bd) {
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 shrink-0">
                          <FileCode2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">Awaiting Sliced G-Code</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Upload your <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700">.gcode</code> file above to automatically compute exact filament grams, machine time, and the price breakdown.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-3">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Quote price</span>
                          <span className="text-[10px] text-slate-400">Calculates from G-code or type manually</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            step="0.50"
                            placeholder="0.00"
                            value={quotePrice}
                            onChange={(e) => handleQuotePriceChange(e.target.value)}
                            className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )
                }

                const baseCost  = bd.baseCost
                const markupAmt = bd.markup
                return (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Price breakdown</span>
                        <span className="rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                          Calculated from G-code
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {totalWeight.toFixed(1)}g · {fmtHours(totalHours)}
                      </span>
                    </div>

                    <div className="px-4 py-3 space-y-2 text-xs">
                      {bd.perPlate.map((p, i) => (
                        <div key={i} className="flex justify-between text-slate-600">
                          <span className="text-slate-500">{p.label}</span>
                          <span className="font-medium text-slate-800 tabular-nums">RM {p.cost.toFixed(2)}</span>
                        </div>
                      ))}

                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-500">
                          Electricity ({fmtHours(totalHours)} × {bd.powerWatts}W × RM{bd.electricityRate}/kWh)
                        </span>
                        <span className="font-medium text-slate-800 tabular-nums">RM {bd.electricityCost.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          Machine wear ({fmtHours(totalHours)} ×
                          <span className="inline-flex items-center gap-0.5">
                            <span className="text-[11px] text-slate-400">RM</span>
                            <input
                              type="number"
                              min="0.25"
                              max="10"
                              step="0.25"
                              value={machineRate}
                              onChange={(e) => setMachineRate(Math.max(0, Number(e.target.value)))}
                              className="w-14 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-xs font-semibold text-slate-800 focus:border-orange-400 focus:outline-none"
                              title="Machine rate per hour (wear & maintenance)"
                            />
                            <span className="text-[11px] text-slate-400">/hr)</span>
                          </span>
                        </span>
                        <span className="font-medium text-slate-800 tabular-nums">RM {bd.machineCost.toFixed(2)}</span>
                      </div>

                      {bd.wasteCost > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span className="text-slate-500">Waste & maintenance ({printer.waste_percent ?? DEFAULT_WASTE_PERCENT}%)</span>
                          <span className="font-medium text-slate-800 tabular-nums">RM {bd.wasteCost.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-2 font-medium">
                        <span>Base production cost</span>
                        <span className="tabular-nums font-semibold text-slate-700">RM {baseCost.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-500">
                        <span className="flex items-center gap-1.5">
                          Profit margin
                          <span className="inline-flex items-center gap-0.5">
                            <input
                              type="number" min="0" max="500" step="5"
                              value={quoteMarkup}
                              onChange={(e) => setQuoteMarkup(Math.max(0, Number(e.target.value)))}
                              className="w-16 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-xs font-semibold text-slate-800 focus:border-orange-400 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400">%</span>
                          </span>
                        </span>
                        <span className="tabular-nums font-medium text-slate-700">RM {markupAmt.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                        <div>
                          <span className="text-sm font-bold text-slate-900 block">Quote price</span>
                          <span className="text-[10px] text-slate-400">Final price customer sees</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-400">RM</span>
                          <input
                            type="number"
                            min="0"
                            step="0.50"
                            value={quotePrice}
                            onChange={(e) => handleQuotePriceChange(e.target.value)}
                            className="w-28 rounded-xl border-2 border-orange-400 bg-orange-50/80 px-2.5 py-1 text-right text-base font-black text-orange-600 focus:border-orange-500 focus:outline-none shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Ready by + message */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Ready by</label>
                <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Message to customer (optional)</label>
                <input type="text" placeholder="Any notes for the customer..." value={quoteMessage}
                  onChange={(e) => setQuoteMessage(e.target.value)} className={inputClass} />
              </div>

              {/* ── Delivery cost (delivery orders only) ── */}
              {request.fulfillment === 'delivery' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-blue-900">🚚 Courier Postage (Pos Laju / J&T)</span>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          {isEastMalaysia(request.delivery_address || '') ? 'East Malaysia' : 'Semenanjung'}
                        </span>
                      </div>
                      {request.delivery_address && (
                        <p className="text-xs text-blue-700 mt-0.5 line-clamp-1">{request.delivery_address}</p>
                      )}
                    </div>
                    {totalWeight > 0 && (
                      <span className="shrink-0 text-[10px] font-medium text-blue-600 bg-white/80 border border-blue-200 rounded-md px-1.5 py-0.5">
                        ~{Math.round(totalWeight)}g part (&lt;1kg parcel bracket)
                      </span>
                    )}
                  </div>

                  {/* 1-Click Postal Preset Buttons */}
                  <div>
                    <p className="text-[11px] font-medium text-blue-800 mb-1.5">Quick Postage Presets:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDeliveryCost('8.00')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${
                          deliveryCost === '8.00'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100/50'
                        }`}
                      >
                        📦 West MY · RM 8.00
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryCost('15.00')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${
                          deliveryCost === '15.00'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100/50'
                        }`}
                      >
                        ✈️ East MY · RM 15.00
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryCost('12.00')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${
                          deliveryCost === '12.00'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100/50'
                        }`}
                      >
                        🛵 Local Runner · RM 12.00
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryCost('0.00')}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${
                          deliveryCost === '0.00' || deliveryCost === '0'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Free Postage
                      </button>
                    </div>
                  </div>

                  {/* Delivery Fee Input */}
                  <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                    <div>
                      <span className="text-xs font-semibold text-blue-900 block">Postage Fee</span>
                      <span className="text-[10px] text-blue-500">Charged to customer at checkout</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-blue-600">RM</span>
                      <input
                        type="number"
                        min="0"
                        step="0.50"
                        placeholder="0.00"
                        value={deliveryCost}
                        onChange={(e) => setDeliveryCost(e.target.value)}
                        className="w-24 rounded-lg border border-blue-300 bg-white px-2 py-1 text-right text-sm font-bold text-blue-900 focus:border-blue-500 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleSendQuote}
                  disabled={!parseFloat(quotePrice) || !quoteDate || isPending}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50">
                  {isPending ? 'Sending...' : 'Send Quote'}
                </button>
                <button onClick={() => setShowQuoteForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{actionError}</p>
          )}

          {/* Action buttons */}
          {!showQuoteForm && (
            <div className="flex gap-2 pt-1">
              {request.status === 'new' && isCatalogOrder && (
                <>
                  <button onClick={() => handleStatusUpdate('accepted')} disabled={isPending}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50">
                    {isPending ? '...' : 'Accept'}
                  </button>
                  <button onClick={() => handleStatusUpdate('declined')} disabled={isPending}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-50">
                    {isPending ? '...' : 'Decline'}
                  </button>
                </>
              )}
              {request.status === 'new' && !isCatalogOrder && (
                <>
                  <button onClick={openQuoteForm} disabled={isPending}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50">
                    Send Quote
                  </button>
                  <button onClick={() => handleStatusUpdate('declined')} disabled={isPending}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-50">
                    {isPending ? '...' : 'Decline'}
                  </button>
                </>
              )}
              {request.status === 'quoted' && (
                <div className="flex flex-col gap-2 w-full">
                  <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                    Awaiting customer acceptance
                  </p>
                  <a
                    href={getWhatsAppLink(
                      request.customer_phone,
                      `Hi ${request.customer_name}! I have submitted the quote for your 3D print request (#${request.id.slice(0,8).toUpperCase()}).\n\nTotal price: RM ${((request.quoted_price ?? 0) + (request.delivery_cost ?? 0)).toFixed(2)}\nExpected completion: ${request.quoted_by_date ? new Date(request.quoted_by_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}\n\nReview and accept the quote here:\n${APP_URL}/track/${request.id}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition text-center"
                  >
                    💬 Notify Customer on WhatsApp
                  </a>
                </div>
              )}
              {request.status === 'accepted' && (
                <div className="flex flex-col gap-2.5 w-full">
                  {/* Quick G-code Download for Printer Transfer */}
                  {(request.gcode_urls?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-5 w-5 text-teal-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-teal-950">
                            Machine G-code Stored ({request.gcode_urls.length} plate{request.gcode_urls.length > 1 ? 's' : ''})
                          </p>
                          <p className="text-[10px] text-teal-700">
                            Download and copy file to printer SD card
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {request.gcode_urls.map((url, idx) => {
                          const fname = url.split('/').pop()?.replace(/^\d+_/, '') || `plate_${idx + 1}.gcode`
                          return (
                            <a
                              key={url}
                              href={url}
                              download={fname}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1.5 text-xs font-bold shadow-2xs transition active:scale-98"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download Plate {idx + 1}</span>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payment Status Box */}
                  <div className={`rounded-xl border p-3.5 space-y-2.5 ${
                    currentPaymentStatus === 'paid'
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-amber-200 bg-amber-50/80'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          currentPaymentStatus === 'paid'
                            ? 'bg-emerald-500'
                            : 'bg-amber-500 animate-pulse'
                        }`} />
                        <span className={`text-xs font-bold ${
                          currentPaymentStatus === 'paid' ? 'text-emerald-900' : 'text-amber-900'
                        }`}>
                          {currentPaymentStatus === 'paid'
                            ? '✓ Payment Verified & Received'
                            : 'Customer Confirmed Quote · Awaiting Payment'}
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-xs text-slate-900 bg-white/90 border border-slate-200/60 rounded-md px-2 py-0.5 shadow-2xs">
                        {formatRM((request.quoted_price ?? 0) + (request.delivery_cost ?? 0))}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">
                      {currentPaymentStatus === 'paid'
                        ? 'Payment has been checked and verified. This print job is cleared to begin production on the Ender-3 build plate.'
                        : 'Customer confirmed the quote and is transferring funds via DuitNow / Malaysian bank transfer. Verify the WhatsApp receipt before loading filament.'}
                    </p>

                    {/* Quick Toggle for Admin: Mark Paid / Unpaid */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/40 text-xs">
                      <span className="text-[11px] font-medium text-slate-500">Payment Status:</span>
                      <div className="flex items-center gap-1.5">
                        {currentPaymentStatus !== 'paid' ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handlePaymentUpdate('paid')}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 shadow-2xs transition disabled:opacity-50"
                          >
                            ✓ Mark Payment as Received
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handlePaymentUpdate('pending')}
                            className="text-[10px] text-slate-400 hover:text-slate-600 underline transition"
                          >
                            Revert to Unpaid
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Start Printing Button */}
                  <button
                    onClick={() => {
                      if (currentPaymentStatus !== 'paid') {
                        handlePaymentUpdate('paid')
                      }
                      handleStatusUpdate('printing')
                    }}
                    disabled={isPending}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                      currentPaymentStatus === 'paid'
                        ? 'bg-purple-600 hover:bg-purple-700 active:scale-98'
                        : 'bg-purple-500/90 hover:bg-purple-600'
                    }`}
                  >
                    {isPending
                      ? 'Updating...'
                      : currentPaymentStatus === 'paid'
                        ? '🚀 Start Printing on Bed'
                        : '✓ Verify Payment & Start Printing'}
                  </button>

                  {/* WhatsApp Quick Chat */}
                  <a
                    href={getWhatsAppLink(
                      request.customer_phone,
                      `Hi ${request.customer_name}! Thanks for confirming your quote for order #${request.id.slice(0, 8).toUpperCase()}.\n\nTotal payable: RM ${((request.quoted_price ?? 0) + (request.delivery_cost ?? 0)).toFixed(2)}.\n\n${
                        currentPaymentStatus === 'paid'
                          ? "We have verified your payment receipt. Your print job is now queued for printing!"
                          : "Kindly send over your payment receipt screenshot here so I can verify and start printing your model immediately!"
                      }`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition text-center"
                  >
                    💬 {currentPaymentStatus === 'paid' ? 'Chat on WhatsApp' : 'Check Receipt / Chat on WhatsApp'}
                  </a>
                </div>
              )}
              {request.status === 'printing' && (
                <div className="flex flex-col gap-2.5 w-full">
                  {/* Quick G-code Download for Printer Transfer */}
                  {(request.gcode_urls?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-5 w-5 text-teal-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-teal-950">
                            Machine G-code Stored ({request.gcode_urls.length} plate{request.gcode_urls.length > 1 ? 's' : ''})
                          </p>
                          <p className="text-[10px] text-teal-700">
                            Download and copy file to printer SD card
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {request.gcode_urls.map((url, idx) => {
                          const fname = url.split('/').pop()?.replace(/^\d+_/, '') || `plate_${idx + 1}.gcode`
                          return (
                            <a
                              key={url}
                              href={url}
                              download={fname}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1.5 text-xs font-bold shadow-2xs transition active:scale-98"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download Plate {idx + 1}</span>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <button onClick={() => handleStatusUpdate('done')} disabled={isPending}
                    className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50">
                    {isPending ? '...' : 'Mark as Done'}
                  </button>
                  <a
                    href={getWhatsAppLink(
                      request.customer_phone,
                      `Hi ${request.customer_name}! Your 3D print request (#${request.id.slice(0,8).toUpperCase()}) is currently printing on the machine! Follow progress live here:\n${APP_URL}/track/${request.id}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition text-center"
                  >
                    💬 Notify Customer on WhatsApp
                  </a>
                </div>
              )}
              {request.status === 'done' && (
                <div className="flex flex-col gap-2 w-full">
                  {request.fulfillment === 'delivery' ? (
                    <button onClick={() => handleStatusUpdate('shipping')} disabled={isPending}
                      className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50">
                      {isPending ? '...' : 'Mark as Shipped'}
                    </button>
                  ) : (
                    <button onClick={() => handleStatusUpdate('collected')} disabled={isPending}
                      className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50">
                      {isPending ? '...' : 'Mark as Collected'}
                    </button>
                  )}
                  <a
                    href={getWhatsAppLink(
                      request.customer_phone,
                      `Hi ${request.customer_name}! Great news: your 3D print (#${request.id.slice(0,8).toUpperCase()}) is completed and ready! You can coordinate pickup/delivery and view completion photos here:\n${APP_URL}/track/${request.id}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition text-center"
                  >
                    💬 Send Completion Notification
                  </a>
                </div>
              )}
              {request.status === 'shipping' && (
                <div className="flex flex-col gap-2 w-full">
                  <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700 font-medium">
                    Shipped · Awaiting customer confirmation
                  </p>
                  <a
                    href={getWhatsAppLink(
                      request.customer_phone,
                      `Hi ${request.customer_name}! Your 3D print order (#${request.id.slice(0,8).toUpperCase()}) has been shipped and is on the way! You can track package delivery details here:\n${APP_URL}/track/${request.id}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition text-center"
                  >
                    💬 Send Shipping Tracker Link
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
            </div>
          </div>
      )}
    </div>
  )
}
