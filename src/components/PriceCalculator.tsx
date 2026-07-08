'use client'

import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { FileCode2, Upload, Plus, X, Loader2, ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-react'
import type { RequestPrinterView, Filament, FilamentMaterial, PrintSize, PrintQuality } from '@/lib/types'
import { MATERIAL_LABELS, SIZE_LABELS } from '@/lib/types'
import { parseGcodeFile } from '@/lib/parse-gcode'
import { getPresetById } from '@/lib/printer-models'
import {
  calculateEstimate,
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_MARKUP_PERCENT,
  DEFAULT_MACHINE_RATE,
  DEFAULT_WASTE_PERCENT,
  DEFAULT_FILAMENT_COST_PER_KG,
  PRINT_ESTIMATES,
} from '@/lib/pricing'

const STLViewer = lazy(() => import('./STLViewer'))

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const selectClass =
  'rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-orange-400 focus:outline-none'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtHours(h: number): string {
  const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

function rm(n: number) { return `RM ${n.toFixed(2)}` }

// Parse binary STL bounding box entirely in-browser — no Three.js needed.
async function stlBoundingBox(file: File): Promise<{ x: number; y: number; z: number } | null> {
  const buf  = await file.arrayBuffer()
  const view = new DataView(buf)
  if (buf.byteLength < 84) return null
  const triCount = view.getUint32(80, true)
  if (84 + triCount * 50 !== buf.byteLength) return null  // not binary STL
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let t = 0; t < triCount; t++) {
    const base = 84 + t * 50 + 12
    for (let v = 0; v < 3; v++) {
      const off = base + v * 12
      const x = view.getFloat32(off, true)
      const y = view.getFloat32(off + 4, true)
      const z = view.getFloat32(off + 8, true)
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }
  }
  if (!isFinite(minX)) return null
  return {
    x: Math.round((maxX - minX) * 10) / 10,
    y: Math.round((maxY - minY) * 10) / 10,
    z: Math.round((maxZ - minZ) * 10) / 10,
  }
}

function sizeFromBbox(bbox: { x: number; y: number; z: number }): PrintSize {
  const max = Math.max(bbox.x, bbox.y, bbox.z)
  if (max <= 100) return 'small'
  if (max <= 250) return 'medium'
  return 'large'
}

// ── shared cost settings ──────────────────────────────────────────────────────

type CostSettings = {
  electricityRate: number
  machineRate: number
  wastePct: number
  markupPct: number
}

function SettingsPanel({
  settings, onChange,
}: {
  settings: CostSettings
  onChange: (s: CostSettings) => void
}) {
  const [open, setOpen] = useState(false)
  function set(k: keyof CostSettings, v: number) { onChange({ ...settings, [k]: v }) }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
        <span>Cost settings</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 grid grid-cols-2 gap-x-6 gap-y-3">
          {([
            ['electricityRate', 'Electricity rate', 'RM/kWh'],
            ['machineRate',     'Machine rate',     'RM/hr'],
            ['wastePct',        'Waste overhead',   '%'],
            ['markupPct',       'Markup',           '%'],
          ] as const).map(([key, label, unit]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-slate-500">{label} ({unit})</label>
              <input type="number" min="0" step="0.01" value={settings[key]}
                onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800 focus:border-orange-400 focus:outline-none" />
            </div>
          ))}
          <p className="col-span-2 text-[11px] text-slate-400 mt-1">
            Changes here are for this session only — edit your printer settings to update the defaults.
          </p>
        </div>
      )}
    </div>
  )
}

// ── breakdown table (shared) ──────────────────────────────────────────────────

type BreakdownRow = { label: string; value: number; sub?: string }

function BreakdownTable({ rows, baseLabel = 'Base cost', total }: {
  rows: BreakdownRow[]
  baseLabel?: string
  total: number
}) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(total.toFixed(2))
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Cost breakdown</span>
      </div>
      <div className="px-4 py-3 space-y-1.5 text-sm">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between text-slate-600">
            <span className="text-slate-500">{row.label}{row.sub && <span className="ml-1 text-[11px] text-slate-400">{row.sub}</span>}</span>
            <span className="tabular-nums font-medium">{rm(row.value)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t-2 border-slate-200 px-4 py-3">
        <span className="font-bold text-slate-900">Suggested price</span>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-orange-600">{rm(total)}</span>
          <button type="button" onClick={copy}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 transition"
            title="Copy price">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── G-code tab ────────────────────────────────────────────────────────────────

type GcodeItem = {
  id: string
  file: File
  parsing: boolean
  error: string
  stats: { weight_g: number | null; print_hours: number | null; layer_count: number | null; slicer: string | null } | null
  material: FilamentMaterial
}

function GcodeTab({ printer, filaments, settings }: {
  printer: RequestPrinterView
  filaments: Filament[]
  settings: CostSettings
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<GcodeItem[]>([])

  const uniqueMaterials = [...new Set(filaments.map((f) => f.material))] as FilamentMaterial[]
  const defaultMaterial = (uniqueMaterials[0] ?? printer.materials?.[0] ?? 'pla') as FilamentMaterial
  const modelPowerWatts = getPresetById(printer.printer_model_id ?? '')?.power_watts ?? 200

  const totalWeight = items.reduce((s, i) => s + (i.stats?.weight_g ?? 0), 0)
  const totalHours  = items.reduce((s, i) => s + (i.stats?.print_hours ?? 0), 0)
  const allDone     = items.length > 0 && items.every((i) => !i.parsing)
  const anyStats    = items.some((i) => i.stats?.weight_g != null)

  // Calculate breakdown
  type Breakdown = { rows: BreakdownRow[]; total: number } | null
  const [breakdown, setBreakdown] = useState<Breakdown>(null)

  useEffect(() => {
    if (!anyStats) { setBreakdown(null); return }
    const rows: BreakdownRow[] = []
    let filamentTotal = 0
    items.filter((i) => (i.stats?.weight_g ?? 0) > 0).forEach((i, idx) => {
      const w = i.stats!.weight_g!
      const costPerKg = printer.filament_costs?.[i.material] ?? DEFAULT_FILAMENT_COST_PER_KG[i.material] ?? 55
      const cost = (w / 1000) * costPerKg
      filamentTotal += cost
      rows.push({
        label: `Filament — ${MATERIAL_LABELS[i.material]}`,
        value: cost,
        sub: items.length > 1 ? `plate ${idx + 1}, ${w}g @ RM${costPerKg}/kg` : `${w}g @ RM${costPerKg}/kg`,
      })
    })
    const elecKwh  = totalHours * (modelPowerWatts / 1000)
    const elecCost = elecKwh * settings.electricityRate
    const machCost = totalHours * settings.machineRate
    const subtotal = filamentTotal + elecCost + machCost
    const wasteCost = subtotal * (settings.wastePct / 100)
    const baseCost  = subtotal + wasteCost
    const markupAmt = baseCost * (settings.markupPct / 100)
    const total     = baseCost + markupAmt
    if (totalHours > 0) {
      rows.push({ label: 'Electricity', value: elecCost, sub: `${elecKwh.toFixed(2)} kWh × RM${settings.electricityRate}/kWh` })
      rows.push({ label: 'Machine wear', value: machCost, sub: `${fmtHours(totalHours)} × RM${settings.machineRate}/hr` })
    }
    rows.push({ label: `Waste & consumables`, value: wasteCost, sub: `${settings.wastePct}%` })
    rows.push({ label: 'Base cost', value: baseCost })
    rows.push({ label: `Markup`, value: markupAmt, sub: `${settings.markupPct}%` })
    setBreakdown({ rows, total })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, settings, anyStats, totalHours])

  async function parseLocally(item: GcodeItem) {
    try {
      const stats = await parseGcodeFile(item.file)
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false, stats } : i))
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false, error: 'Could not read file' } : i))
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    const newItems: GcodeItem[] = Array.from(files)
      .filter((f) => /\.(gcode|bgcode)$/i.test(f.name))
      .map((f) => ({ id: crypto.randomUUID(), file: f, parsing: true, error: '', stats: null, material: defaultMaterial }))
    if (!newItems.length) return
    setItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => parseLocally(item))
  }

  function reset() { setItems([]); setBreakdown(null) }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <label
          className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-orange-200 bg-white px-4 py-10 text-center hover:border-orange-400 hover:bg-orange-50/30 transition"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <FileCode2 className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <p className="font-medium text-slate-700">Drop your .gcode file here</p>
            <p className="mt-0.5 text-sm text-slate-400">or click to browse · .gcode and .bgcode supported · multiple plates OK</p>
          </div>
          <input ref={inputRef} type="file" accept=".gcode,.bgcode" multiple className="hidden"
            onChange={(e) => addFiles(e.target.files)} />
        </label>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3">
                  <FileCode2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate text-sm font-medium text-slate-700">{item.file.name}</span>
                  {item.parsing && <span className="flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Reading…</span>}
                  {!item.parsing && item.stats && (
                    <span className="shrink-0 text-xs font-medium text-teal-600">
                      {item.stats.weight_g != null && `${item.stats.weight_g}g`}
                      {item.stats.weight_g != null && item.stats.print_hours != null && ' · '}
                      {item.stats.print_hours != null && fmtHours(item.stats.print_hours)}
                      {item.stats.slicer && <span className="ml-1.5 font-normal text-slate-400">{item.stats.slicer}</span>}
                    </span>
                  )}
                  {!item.parsing && !item.stats && !item.error && <span className="text-xs text-slate-400">No stats found</span>}
                  {item.error && <span className="text-xs text-red-500">{item.error}</span>}
                  <button type="button" onClick={() => setItems((p) => p.filter((i) => i.id !== item.id))}
                    className="text-slate-300 hover:text-red-400 transition"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2">
                  <span className="text-xs text-slate-500">
                    {items.length > 1 ? `Plate ${idx + 1} — ` : ''}Material:
                  </span>
                  <select value={item.material}
                    onChange={(e) => setItems((p) => p.map((i) => i.id === item.id ? { ...i, material: e.target.value as FilamentMaterial } : i))}
                    className={selectClass}>
                    {(uniqueMaterials.length > 0 ? uniqueMaterials : Object.keys(MATERIAL_LABELS) as FilamentMaterial[]).map((m) => (
                      <option key={m} value={m}>{MATERIAL_LABELS[m]}</option>
                    ))}
                  </select>
                  {printer.filament_costs?.[item.material] && (
                    <span className="text-xs text-slate-400">
                      RM {printer.filament_costs[item.material]}/kg
                    </span>
                  )}
                </div>
              </div>
            ))}

            {allDone && anyStats && items.length > 1 && (
              <div className="rounded-lg bg-teal-50 border border-teal-100 px-4 py-2 text-xs text-teal-700">
                <span className="font-medium">{items.length} plates total</span>
                {` · ~${Math.round(totalWeight * 10) / 10}g filament · ~${fmtHours(totalHours)} print time`}
              </div>
            )}
          </div>

          <button type="button" onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600 transition">
            <Plus className="h-4 w-4" /> Add another plate
          </button>
          <input ref={inputRef} type="file" accept=".gcode,.bgcode" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }} />
        </>
      )}

      {breakdown && <BreakdownTable rows={breakdown.rows} total={breakdown.total} />}

      {items.length > 0 && (
        <button type="button" onClick={reset}
          className="text-sm text-slate-400 hover:text-slate-600 transition">
          ← Start over
        </button>
      )}
    </div>
  )
}

// ── Estimate tab ──────────────────────────────────────────────────────────────

function EstimateTab({ printer, filaments, settings }: {
  printer: RequestPrinterView
  filaments: Filament[]
  settings: CostSettings
}) {
  const stlInputRef  = useRef<HTMLInputElement>(null)
  const [stlFile,   setStlFile]   = useState<File | null>(null)
  const [stlUrl,    setStlUrl]    = useState<string | null>(null)
  const [bbox,      setBbox]      = useState<{ x: number; y: number; z: number } | null>(null)
  const [bboxLoading, setBboxLoading] = useState(false)
  const [size,      setSize]      = useState<PrintSize>('small')
  const [quality,   setQuality]   = useState<PrintQuality>('basic')
  const [material,  setMaterial]  = useState<FilamentMaterial>(() => {
    const mats = filaments.map((f) => f.material)
    return (mats[0] ?? printer.materials?.[0] ?? 'pla') as FilamentMaterial
  })

  const uniqueMaterials = [...new Set(filaments.map((f) => f.material))] as FilamentMaterial[]
  const availableMaterials = uniqueMaterials.length > 0
    ? uniqueMaterials
    : (printer.materials ?? Object.keys(MATERIAL_LABELS) as FilamentMaterial[])

  const modelPowerWatts = getPresetById(printer.printer_model_id ?? '')?.power_watts ?? 200
  const costPerKg = printer.filament_costs?.[material] ?? DEFAULT_FILAMENT_COST_PER_KG[material] ?? 55
  const baseEst   = PRINT_ESTIMATES[size][quality]

  const result = calculateEstimate({
    size, quality, material,
    power_watts:          modelPowerWatts,
    cost_per_kg:          costPerKg,
    electricity_rate:     settings.electricityRate,
    markup_percent:       settings.markupPct,
    machine_rate_per_hour: settings.machineRate,
    waste_percent:        settings.wastePct,
  })

  const rows: BreakdownRow[] = [
    { label: `Filament — ${MATERIAL_LABELS[material]}`, value: result.filament_cost, sub: `~${result.weight_g}g @ RM${costPerKg}/kg` },
    { label: 'Electricity', value: result.electricity_cost, sub: `${(result.hours * modelPowerWatts / 1000).toFixed(2)} kWh × RM${settings.electricityRate}/kWh` },
    { label: 'Machine wear', value: result.machine_cost, sub: `~${fmtHours(result.hours)} × RM${settings.machineRate}/hr` },
    { label: `Waste & consumables`, value: result.waste_cost, sub: `${settings.wastePct}%` },
    { label: 'Base cost', value: result.base_cost },
    { label: `Markup`, value: result.suggested_price - result.base_cost, sub: `${settings.markupPct}%` },
  ]

  async function handleStlFile(file: File) {
    if (stlUrl) URL.revokeObjectURL(stlUrl)
    setStlFile(file)
    setStlUrl(URL.createObjectURL(file))
    setBbox(null)
    setBboxLoading(true)
    const box = await stlBoundingBox(file)
    setBbox(box)
    if (box) setSize(sizeFromBbox(box))
    setBboxLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
        <p>Rough estimate based on typical print weights for each size. Upload a G-code file for an accurate quote.</p>
      </div>

      {/* Optional STL upload */}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">3D file — optional (auto-detects size)</p>
        {!stlFile ? (
          <label
            className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-4 hover:border-orange-300 hover:bg-orange-50/20 transition"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleStlFile(f) }}
          >
            <Upload className="h-5 w-5 text-slate-400 shrink-0" />
            <div>
              <p className="text-sm text-slate-600">Drop .stl file to auto-detect size</p>
              <p className="text-xs text-slate-400">Works with binary STL only · optional</p>
            </div>
            <input ref={stlInputRef} type="file" accept=".stl" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStlFile(f) }} />
          </label>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 truncate text-sm font-medium text-slate-700">{stlFile.name}</span>
              {bboxLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              {bbox && (
                <span className="text-xs font-medium text-teal-600">
                  {bbox.x} × {bbox.y} × {bbox.z} mm → auto-set to <span className="capitalize">{size}</span>
                </span>
              )}
              {!bboxLoading && !bbox && <span className="text-xs text-slate-400">Could not read dimensions</span>}
              <button type="button" onClick={() => { setStlFile(null); if (stlUrl) { URL.revokeObjectURL(stlUrl); setStlUrl(null) }; setBbox(null) }}
                className="text-slate-300 hover:text-red-400 transition"><X className="h-4 w-4" /></button>
            </div>
            {stlUrl && (
              <Suspense fallback={<div className="h-44 animate-pulse bg-slate-100" />}>
                <STLViewer urls={[stlUrl]} colors={['#e0e0e0']} className="h-44 w-full" />
              </Suspense>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Size */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Size</p>
          <div className="flex flex-col gap-1.5">
            {(['small', 'medium', 'large'] as PrintSize[]).map((s) => {
              const est = PRINT_ESTIMATES[s][quality]
              return (
                <button key={s} type="button" onClick={() => setSize(s)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                    size === s ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                  }`}>
                  <span className="font-medium capitalize">{s}</span>
                  <span className="ml-1 text-[11px] opacity-70">~{est.weight_g}g / ~{fmtHours(est.hours)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quality */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Quality</p>
          <div className="flex flex-col gap-1.5">
            {([['basic', 'Basic', '15% infill, standard walls'], ['advanced', 'Advanced', '40% infill, more walls']] as const).map(([q, label, desc]) => (
              <button key={q} type="button" onClick={() => setQuality(q)}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  quality === q ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                }`}>
                <span className="font-medium">{label}</span>
                <span className="ml-1 text-[11px] opacity-70">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Material */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Material</p>
          <div className="flex flex-col gap-1.5">
            {availableMaterials.map((m) => {
              const cpkg = printer.filament_costs?.[m] ?? DEFAULT_FILAMENT_COST_PER_KG[m]
              return (
                <button key={m} type="button" onClick={() => setMaterial(m)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                    material === m ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                  }`}>
                  <span className="font-medium">{MATERIAL_LABELS[m]}</span>
                  {cpkg && <span className="ml-1 text-[11px] opacity-70">RM{cpkg}/kg</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <BreakdownTable rows={rows} total={result.suggested_price} />
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function PriceCalculator({ printer, filaments }: { printer: RequestPrinterView; filaments: Filament[] }) {
  const [tab, setTab] = useState<'gcode' | 'estimate'>('gcode')
  const [settings, setSettings] = useState<CostSettings>({
    electricityRate: printer.electricity_rate ?? DEFAULT_ELECTRICITY_RATE,
    machineRate:     printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE,
    wastePct:        printer.waste_percent ?? DEFAULT_WASTE_PERCENT,
    markupPct:       printer.markup_percent ?? DEFAULT_MARKUP_PERCENT,
  })

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button type="button" onClick={() => setTab('gcode')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'gcode' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          G-code — Accurate
        </button>
        <button type="button" onClick={() => setTab('estimate')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'estimate' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Estimate — Rough
        </button>
      </div>

      {tab === 'gcode'
        ? <GcodeTab printer={printer} filaments={filaments} settings={settings} />
        : <EstimateTab printer={printer} filaments={filaments} settings={settings} />
      }

      <SettingsPanel settings={settings} onChange={setSettings} />
    </div>
  )
}
