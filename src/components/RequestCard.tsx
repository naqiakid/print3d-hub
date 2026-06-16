'use client'

import { useState, useRef, useEffect, useTransition, lazy, Suspense } from 'react'
import { Calendar, FileText, MessageSquare, ExternalLink, Upload, X, Loader2, FileCode2, Plus } from 'lucide-react'
import type { PrintRequest, RequestStatus, Printer, FilamentMaterial } from '@/lib/types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRINT_TYPE_LABELS,
  MATERIAL_LABELS,
  SIZE_LABELS,
} from '@/lib/types'
import { updateRequestStatus, sendQuote } from '@/lib/actions'
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

const STLViewer = lazy(() => import('./STLViewer'))

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const selectClass =
  'rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-orange-400 focus:outline-none'

type GcodeItem = {
  id: string
  file: File
  url: string | null
  uploading: boolean
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

export default function RequestCard({ request, printer }: { request: PrintRequest; printer: Printer }) {
  const [expanded, setExpanded] = useState(false)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteDate, setQuoteDate] = useState('')
  const [quoteMessage, setQuoteMessage] = useState('')
  const [confirmedAddons, setConfirmedAddons] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState('')
  const [isPending, startTransition] = useTransition()

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

  // Model file upload for quote (when customer only gave a link)
  const quoteStlInputRef = useRef<HTMLInputElement>(null)
  const [quoteStlUrls, setQuoteStlUrls] = useState<string[]>([])
  const [stlUploading, setStlUploading] = useState(false)

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
        })
      : null

  const totalWeight = gcodeItems.reduce((s, i) => s + (i.stats?.weight_g ?? 0), 0)
  const totalHours  = gcodeItems.reduce((s, i) => s + (i.stats?.print_hours ?? 0), 0)
  const totalLayers = gcodeItems.reduce((s, i) => s + (i.stats?.layer_count ?? 0), 0)
  const allDone     = gcodeItems.length > 0 && gcodeItems.every((i) => !i.uploading && !i.parsing)
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

    const machineRate       = printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE
    const wastePct          = printer.waste_percent         ?? DEFAULT_WASTE_PERCENT
    const totalFilamentCost = perPlate.reduce((s, p) => s + p.cost, 0)
    const electricityCost   = totalHours > 0 ? totalHours * (powerWatts / 1000) * elecRate : 0
    const machineCost       = totalHours > 0 ? totalHours * machineRate : 0
    const subtotal          = totalFilamentCost + electricityCost + machineCost
    const wasteCost         = subtotal * (wastePct / 100)
    const baseCost          = subtotal + wasteCost
    const markup            = baseCost * (markupPct / 100)
    const total             = baseCost + markup

    setBreakdown({ perPlate, electricityCost, machineCost, wasteCost, baseCost, markup, total, powerWatts, electricityRate: elecRate, markupPct })
    if (!updatingFromPrice.current) setQuotePrice(total.toFixed(2))
    updatingFromPrice.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcodeItems, quoteMarkup, anyStats, totalHours])

  // For estimate path (no gcode): sync quotePrice when markup changes
  useEffect(() => {
    if (updatingFromPrice.current || anyStats || !estimate) return
    const total = estimate.base_cost * (1 + quoteMarkup / 100)
    setQuotePrice(total.toFixed(2))
    updatingFromPrice.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteMarkup, anyStats])

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
    // Pre-check every requested addon — owner reviews and unchecks any they couldn't apply
    const addons = new Set<string>()
    if (request.supports) addons.add('supports')
    for (const a of (request.selected_addons ?? [])) addons.add(a)
    setConfirmedAddons(addons)
    setShowQuoteForm(true)
  }

  async function uploadAndParseGcode(item: GcodeItem) {
    const supabase = createClient()
    const path = `gcode/${request.id}/${Date.now()}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { data: uploadData, error } = await supabase.storage
      .from('stl-files')
      .upload(path, item.file)

    if (error || !uploadData) {
      setGcodeItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, uploading: false, error: error?.message ?? 'Upload failed' } : i,
        ),
      )
      return
    }

    const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    setGcodeItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, uploading: false, url: publicUrl, parsing: true } : i,
      ),
    )

    try {
      const res  = await fetch(`/api/parse-gcode?url=${encodeURIComponent(publicUrl)}`)
      const data = await res.json()
      setGcodeItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, parsing: false, stats: data.error ? null : data }
            : i,
        ),
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
          url: null,
          uploading: true,
          parsing: false,
          error: '',
          stats: null,
          material: defaultMaterial,
          color: pref?.color || defaultColorName,
          colorHex: pref?.color_hex || defaultColorHex,
        }
      })
    if (!newItems.length) return
    setGcodeItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => uploadAndParseGcode(item))
  }

  function updatePlate(id: string, patch: Partial<Pick<GcodeItem, 'material' | 'color' | 'colorHex'>>) {
    setGcodeItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function removeGcode(id: string) {
    setGcodeItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function handleStlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStlUploading(true)
    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `quote/${request.id}_${Date.now()}_${safeName}`
    const { data: uploadData } = await supabase.storage.from('stl-files').upload(path, file)
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
      setQuoteStlUrls([urlData.publicUrl])
    }
    setStlUploading(false)
    if (quoteStlInputRef.current) quoteStlInputRef.current.value = ''
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
    if (!finalPrice || !quoteDate) return
    setActionError('')
    startTransition(async () => {
      const urls = gcodeItems.map((i) => i.url).filter(Boolean) as string[]
      const plateFilaments = gcodeItems.map((i) => ({
        material: i.material,
        color: i.color,
        color_hex: i.colorHex,
      }))
      // Primary material = first plate's material, or customer's requested material
      const primaryMaterial = gcodeItems[0]?.material ?? defaultMaterial
      const parsedDeliveryCost   = parseFloat(deliveryCost) > 0 ? parseFloat(deliveryCost) : null
      const mergedStlUrls        = quoteStlUrls.length > 0
        ? [...(request.stl_urls ?? []), ...quoteStlUrls]
        : undefined

      const result = await sendQuote(
        request.id,
        Math.round(finalPrice * 100) / 100,
        quoteDate,
        quoteMessage,
        urls.length ? urls : undefined,
        totalWeight > 0 ? Math.round(totalWeight * 10) / 10 : null,
        totalHours  > 0 ? Math.round(totalHours  * 10) / 10 : null,
        primaryMaterial,
        plateFilaments.length ? plateFilaments : undefined,
        [...confirmedAddons],
        parsedDeliveryCost,
        mergedStlUrls,
      )
      if (result?.error) setActionError(result.error)
      else setShowQuoteForm(false)
    })
  }

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
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900 truncate">{request.customer_name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[request.status]}`}>
              {STATUS_LABELS[request.status]}
            </span>
          </div>
          {/* Key job info — what the owner needs at a glance */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {/* Material + color */}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {request.color && request.color !== 'Any' && (
                <span className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0" style={{ background: request.color_hex || '#888' }} />
              )}
              {MATERIAL_LABELS[request.material] ?? request.material}
              {request.color && request.color !== 'Any' ? ` · ${request.color}` : ''}
            </span>
            {/* Quality tier */}
            {request.quality && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {request.quality === 'advanced' ? 'Advanced' : 'Basic'}
              </span>
            )}
            {/* Supports */}
            {(request.supports || request.selected_addons?.includes('supports')) && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Supports</span>
            )}
            {(request.declined_addons ?? []).includes('supports') && (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">✗ No supports</span>
            )}
            {/* Other key options */}
            {(request.selected_addons ?? []).filter((a) => ['ironing', 'fuzzy_skin', 'color_change', 'pause_insert', 'text_on_surface'].includes(a)).map((a) => (
              <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {a === 'ironing' ? 'Ironing' : a === 'fuzzy_skin' ? 'Fuzzy skin' : a === 'color_change' ? 'Multi-color' : a === 'pause_insert' ? 'Inserts' : 'Surface text'}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 truncate">{request.description}</p>
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className={`flex items-center gap-1 mb-1 ${isUrgent ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            <Calendar className="h-3.5 w-3.5" />
            {isUrgent && daysUntilDeadline <= 0
              ? 'Overdue!'
              : isUrgent
              ? `${daysUntilDeadline}d left`
              : `Due ${new Date(request.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}`}
          </div>
          {request.quoted_price && (
            <div className="font-semibold text-slate-900">RM{request.quoted_price}</div>
          )}
        </div>
        <span className="text-slate-300 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
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
            const colorsByFile = stlUrls.map((_, idx) => {
              const sorted = prefs
                .filter((p) => p.part_number === idx + 1)
                .sort((a, b) => (a.part_index ?? 1) - (b.part_index ?? 1))
              return {
                color: sorted[0]?.color_hex || defaultColorHex || '#cccccc',
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
                    {request.color && request.color !== 'Any' && (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border border-slate-200 shadow-sm" style={{ background: request.color_hex || '#888' }} />
                        <span className="text-slate-500">{request.color}</span>
                      </>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400">Size</span>
                    {(() => {
                      const m = request.notes?.match(/^\[(\d+\.?\d*)×(\d+\.?\d*)×(\d+\.?\d*)mm\]/)
                      return m
                        ? <span className="ml-2 font-medium text-slate-900">{m[1]} × {m[2]} × {m[3]} mm</span>
                        : <span className="ml-2 font-medium text-slate-900">{SIZE_LABELS[request.size]}</span>
                    })()}
                  </div>
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

          {/* Already-sliced G-code stats */}
          {(request.gcode_urls?.length ?? 0) > 0 && (request.weight_g || request.print_hours) && (
            <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
              <p className="text-xs font-medium text-teal-600 mb-1.5">
                Sliced · {request.gcode_urls.length} plate{request.gcode_urls.length > 1 ? 's' : ''}
              </p>
              {/* Plate filament chips */}
              {(request.plate_filaments?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {request.plate_filaments.map((pf, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white border border-teal-200 px-2 py-0.5 text-xs text-teal-800">
                      <span className="h-2.5 w-2.5 rounded-full border border-teal-300" style={{ background: pf.color_hex || '#888' }} />
                      Plate {i + 1} · {MATERIAL_LABELS[pf.material]} {pf.color && `· ${pf.color}`}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-4 text-sm font-medium text-teal-900">
                {request.weight_g   && <span>~{request.weight_g}g filament</span>}
                {request.print_hours && <span>~{fmtHours(request.print_hours)} print time</span>}
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
                Quote sent: RM{request.quoted_price} · Ready by{' '}
                {request.quoted_by_date && new Date(request.quoted_by_date).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
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
            <div>
              <p className="font-medium text-slate-800">
                {request.fulfillment === 'delivery' ? 'Delivery requested' : 'Pickup'}
                {request.fulfillment === 'delivery' && printer.delivery_rate_per_km && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">
                    RM {Number(printer.delivery_rate_per_km).toFixed(2)}/km
                  </span>
                )}
              </p>
              {request.fulfillment === 'delivery' && request.delivery_address && (
                <p className="text-xs text-slate-500 mt-0.5">{request.delivery_address}</p>
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

                          {item.uploading && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Loader2 className="h-3 w-3 animate-spin" /> Uploading
                            </span>
                          )}
                          {item.parsing && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Loader2 className="h-3 w-3 animate-spin" /> Analysing
                            </span>
                          )}
                          {!item.uploading && !item.parsing && item.stats && (
                            <span className="shrink-0 text-xs font-medium text-teal-600">
                              {item.stats.weight_g != null && `${item.stats.weight_g}g`}
                              {item.stats.weight_g != null && item.stats.print_hours != null && ' · '}
                              {item.stats.print_hours != null && fmtHours(item.stats.print_hours)}
                              {item.stats.layer_count ? ` · ${item.stats.layer_count} layers` : ''}
                            </span>
                          )}
                          {!item.uploading && !item.parsing && !item.stats && !item.error && (
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
                  </div>
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

              {/* ── Price breakdown (always visible) ── */}
              {(() => {
                const bd  = breakdown
                const est = bd ? null : estimate
                if (!bd && !est) return (
                  <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-400">
                    Price will be calculated once you upload a G-code file, or configure filament costs in your account settings.
                  </div>
                )
                const baseCost  = bd ? bd.baseCost : est!.base_cost
                const markupAmt = bd ? bd.markup   : est!.base_cost * (quoteMarkup / 100)
                const total     = bd ? bd.total    : est!.base_cost * (1 + quoteMarkup / 100)
                return (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Price breakdown</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bd ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-600'}`}>
                        {bd ? 'From G-code' : 'Size estimate'}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5 text-xs">
                      {bd ? (
                        <>
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
                          {bd.machineCost > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span className="text-slate-500">Machine ({fmtHours(totalHours)} × RM{printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE}/hr)</span>
                              <span className="font-medium text-slate-800 tabular-nums">RM {bd.machineCost.toFixed(2)}</span>
                            </div>
                          )}
                          {bd.wasteCost > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span className="text-slate-500">Waste & maintenance ({printer.waste_percent ?? DEFAULT_WASTE_PERCENT}%)</span>
                              <span className="font-medium text-slate-800 tabular-nums">RM {bd.wasteCost.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span className="text-slate-500">Filament (~{est!.weight_g}g estimate)</span>
                            <span className="font-medium text-slate-800 tabular-nums">RM {est!.filament_cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span className="text-slate-500">Electricity (~{est!.hours}h estimate)</span>
                            <span className="font-medium text-slate-800 tabular-nums">RM {est!.electricity_cost.toFixed(2)}</span>
                          </div>
                          {est!.machine_cost > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span className="text-slate-500">Machine (~{est!.hours}h estimate)</span>
                              <span className="font-medium text-slate-800 tabular-nums">RM {est!.machine_cost.toFixed(2)}</span>
                            </div>
                          )}
                          {est!.waste_cost > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span className="text-slate-500">Waste & maintenance ({printer.waste_percent ?? DEFAULT_WASTE_PERCENT}%)</span>
                              <span className="font-medium text-slate-800 tabular-nums">RM {est!.waste_cost.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-2">
                        <span>Base cost</span>
                        <span className="tabular-nums">RM {baseCost.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-500">
                        <span className="flex items-center gap-1.5">
                          Profit margin
                          <span className="inline-flex items-center gap-0.5">
                            <input
                              type="number" min="0" max="500" step="5"
                              value={quoteMarkup}
                              onChange={(e) => setQuoteMarkup(Math.max(0, Number(e.target.value)))}
                              className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-xs font-medium text-slate-700 focus:border-orange-400 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400">%</span>
                          </span>
                        </span>
                        <span className="tabular-nums">RM {markupAmt.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-sm font-bold text-slate-900">Quote price</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-slate-500">RM</span>
                          <input
                            type="number"
                            min="0"
                            step="0.50"
                            value={quotePrice}
                            onChange={(e) => handleQuotePriceChange(e.target.value)}
                            className="w-24 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-right text-sm font-bold text-orange-600 focus:border-orange-500 focus:outline-none"
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
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-blue-800">🚚 Delivery order</p>
                      {request.delivery_address && (
                        <p className="text-xs text-blue-600 mt-0.5 line-clamp-1">{request.delivery_address}</p>
                      )}
                    </div>
                    {printer.delivery_rate_per_km && (
                      <span className="shrink-0 text-xs text-blue-500">RM {Number(printer.delivery_rate_per_km).toFixed(2)}/km</span>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-blue-700">Delivery cost (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">RM</span>
                      <input
                        type="number" min="0" step="0.50"
                        value={deliveryCost}
                        onChange={(e) => setDeliveryCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-blue-200 bg-white pl-8 pr-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-blue-500">Customer will see a print + delivery breakdown on their tracking page.</p>
                  </div>
                </div>
              )}

              {/* ── Model file (when customer only gave a link) ── */}
              {(request.stl_urls?.length ?? 0) === 0 && !request.stl_url && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Attach 3D model preview (optional)</label>
                  <p className="mb-2 text-[11px] text-slate-400">
                    Customer gave a link, not a file. Attach the prepared model so they can preview it in 3D on their tracking page.
                  </p>
                  {quoteStlUrls.length > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                      <span className="flex-1 truncate text-xs text-slate-600">Model attached ✓</span>
                      <button type="button" onClick={() => setQuoteStlUrls([])} className="text-slate-300 hover:text-red-400 transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input ref={quoteStlInputRef} type="file" accept=".stl,.3mf" className="hidden" onChange={handleStlUpload} />
                      <button type="button" disabled={stlUploading} onClick={() => quoteStlInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-500 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 transition">
                        <Upload className="h-3.5 w-3.5" />
                        {stlUploading ? 'Uploading…' : 'Attach .stl / .3mf file'}
                      </button>
                    </>
                  )}
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
              {request.status === 'new' && (
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
                <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                  Awaiting customer acceptance
                </p>
              )}
              {request.status === 'accepted' && (
                <button onClick={() => handleStatusUpdate('printing')} disabled={isPending}
                  className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-600 disabled:opacity-50">
                  {isPending ? '...' : 'Mark as Printing'}
                </button>
              )}
              {request.status === 'printing' && (
                <button onClick={() => handleStatusUpdate('done')} disabled={isPending}
                  className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50">
                  {isPending ? '...' : 'Mark as Done'}
                </button>
              )}
              {request.status === 'done' && (
                <button onClick={() => handleStatusUpdate('collected')} disabled={isPending}
                  className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50">
                  {isPending ? '...' : 'Mark as Collected'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
