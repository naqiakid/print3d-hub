'use client'

import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { FileCode2, Upload, Plus, X, Loader2, ChevronDown, ChevronUp, Copy, Check, Info, Settings, DollarSign } from 'lucide-react'
import type { RequestPrinterView, Filament, FilamentMaterial, PrintSize, PrintQuality } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
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

function fmtHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

function rm(n: number) {
  return `RM ${n.toFixed(2)}`
}

// Parse binary STL bounding box entirely in-browser
async function stlBoundingBox(file: File): Promise<{ x: number; y: number; z: number } | null> {
  const buf = await file.arrayBuffer()
  const view = new DataView(buf)
  if (buf.byteLength < 84) return null
  const triCount = view.getUint32(80, true)
  if (84 + triCount * 50 !== buf.byteLength) return null // binary STL check
  
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

type CostSettings = {
  electricityRate: number
  machineRate: number
  wastePct: number
  markupPct: number
}

type BreakdownRow = { label: string; value: number; sub?: string }

type GcodeItem = {
  id: string
  file: File
  parsing: boolean
  error: string
  stats: { weight_g: number | null; print_hours: number | null; layer_count: number | null; slicer: string | null } | null
  material: FilamentMaterial
}

export default function PriceCalculator({ printer, filaments }: { printer: RequestPrinterView; filaments: Filament[] }) {
  const [tab, setTab] = useState<'gcode' | 'estimate'>('gcode')
  
  // Cost Settings State
  const [settings, setSettings] = useState<CostSettings>({
    electricityRate: printer.electricity_rate ?? DEFAULT_ELECTRICITY_RATE,
    machineRate: printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE,
    wastePct: printer.waste_percent ?? DEFAULT_WASTE_PERCENT,
    markupPct: printer.markup_percent ?? DEFAULT_MARKUP_PERCENT,
  })

  // Semicolon-protected state overrides
  const [gcodeItems, setGcodeItems] = useState<GcodeItem[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Gcode setup helpers
  const gcodeInputRef = useRef<HTMLInputElement>(null)
  const uniqueMaterials = [...new Set(filaments.map((f) => f.material))] as FilamentMaterial[]
  const defaultMaterial = (uniqueMaterials[0] ?? printer.materials?.[0] ?? 'pla') as FilamentMaterial
  const modelPowerWatts = getPresetById(printer.printer_model_id ?? '')?.power_watts ?? 200

  // Gcode calculation metrics
  const totalGcodeWeight = gcodeItems.reduce((s, i) => s + (i.stats?.weight_g ?? 0), 0)
  const totalGcodeHours = gcodeItems.reduce((s, i) => s + (i.stats?.print_hours ?? 0), 0)
  const allGcodeDone = gcodeItems.length > 0 && gcodeItems.every((i) => !i.parsing)
  const anyGcodeStats = gcodeItems.some((i) => i.stats?.weight_g != null)

  // Estimate Tab State
  const stlInputRef = useRef<HTMLInputElement>(null)
  const [stlFile, setStlFile] = useState<File | null>(null)
  const [stlUrl, setStlUrl] = useState<string | null>(null)
  const [bbox, setBbox] = useState<{ x: number; y: number; z: number } | null>(null)
  const [bboxLoading, setBboxLoading] = useState(false)
  const [size, setSize] = useState<PrintSize>('small')
  const [quality, setQuality] = useState<PrintQuality>('basic')
  const [material, setMaterial] = useState<FilamentMaterial>(() => {
    const mats = filaments.map((f) => f.material)
    return (mats[0] ?? printer.materials?.[0] ?? 'pla') as FilamentMaterial
  })

  const availableMaterials = uniqueMaterials.length > 0
    ? uniqueMaterials
    : (printer.materials ?? Object.keys(MATERIAL_LABELS) as FilamentMaterial[])

  const costPerKg = printer.filament_costs?.[material] ?? DEFAULT_FILAMENT_COST_PER_KG[material] ?? 55

  // Cost breakdown calculation
  const getBreakdown = (): { rows: BreakdownRow[]; total: number } | null => {
    if (tab === 'gcode') {
      if (!anyGcodeStats) return null

      const rows: BreakdownRow[] = []
      let filamentTotal = 0

      gcodeItems.filter((i) => (i.stats?.weight_g ?? 0) > 0).forEach((i, idx) => {
        const w = i.stats!.weight_g!
        const cpkg = printer.filament_costs?.[i.material] ?? DEFAULT_FILAMENT_COST_PER_KG[i.material] ?? 55
        const cost = (w / 1000) * cpkg
        filamentTotal += cost
        rows.push({
          label: `Filament — ${MATERIAL_LABELS[i.material]}`,
          value: cost,
          sub: gcodeItems.length > 1 ? `plate ${idx + 1}, ${w}g @ RM${cpkg}/kg` : `${w}g @ RM${cpkg}/kg`,
        })
      })

      const cpkg = totalGcodeWeight > 0 ? (filamentTotal / (totalGcodeWeight / 1000)) : 0
      const est = calculateEstimate({
        size: 'medium',
        quality: 'basic',
        material: defaultMaterial,
        power_watts: modelPowerWatts,
        cost_per_kg: cpkg,
        electricity_rate: settings.electricityRate,
        markup_percent: settings.markupPct,
        machine_rate_per_hour: settings.machineRate,
        waste_percent: settings.wastePct,
        known_weight_g: totalGcodeWeight,
        known_hours: totalGcodeHours,
      })

      if (totalGcodeHours > 0) {
        rows.push({ label: 'Electricity', value: est.electricity_cost, sub: `${(totalGcodeHours * modelPowerWatts / 1000).toFixed(2)} kWh × RM${settings.electricityRate}/kWh` })
        rows.push({ label: 'Machine wear', value: est.machine_cost, sub: `${fmtHours(totalGcodeHours)} × RM${settings.machineRate}/hr` })
      }
      rows.push({ label: 'Waste overhead', value: est.waste_cost, sub: `${settings.wastePct}%` })
      rows.push({ label: 'Base cost', value: est.base_cost })
      rows.push({ label: 'Markup markup', value: est.suggested_price - est.base_cost, sub: `${settings.markupPct}%` })

      return { rows, total: est.suggested_price }
    } else {
      // Rough estimate calculation
      const result = calculateEstimate({
        size,
        quality,
        material,
        power_watts: modelPowerWatts,
        cost_per_kg: costPerKg,
        electricity_rate: settings.electricityRate,
        markup_percent: settings.markupPct,
        machine_rate_per_hour: settings.machineRate,
        waste_percent: settings.wastePct,
      })

      const rows: BreakdownRow[] = [
        { label: `Filament — ${MATERIAL_LABELS[material]}`, value: result.filament_cost, sub: `~${result.weight_g}g @ RM${costPerKg}/kg` },
        { label: 'Electricity', value: result.electricity_cost, sub: `${(result.hours * modelPowerWatts / 1000).toFixed(2)} kWh × RM${settings.electricityRate}/kWh` },
        { label: 'Machine wear', value: result.machine_cost, sub: `~${fmtHours(result.hours)} × RM${settings.machineRate}/hr` },
        { label: 'Waste overhead', value: result.waste_cost, sub: `${settings.wastePct}%` },
        { label: 'Base cost', value: result.base_cost },
        { label: 'Markup markup', value: result.suggested_price - result.base_cost, sub: `${settings.markupPct}%` },
      ]

      return { rows, total: result.suggested_price }
    }
  }

  const activeBreakdown = getBreakdown()

  // Gcode actions
  async function parseLocally(item: GcodeItem) {
    try {
      const stats = await parseGcodeFile(item.file)
      setGcodeItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false, stats } : i))
    } catch {
      setGcodeItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false, error: 'Could not read file' } : i))
    }
  }

  function addGcodeFiles(files: FileList | null) {
    if (!files) return
    const newItems: GcodeItem[] = Array.from(files)
      .filter((f) => /\.(gcode|bgcode)$/i.test(f.name))
      .map((f) => ({ id: crypto.randomUUID(), file: f, parsing: true, error: '', stats: null, material: defaultMaterial }))
    if (!newItems.length) return
    setGcodeItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => parseLocally(item))
  }

  // STL actions
  async function handleStlFile(file: File) {
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== 'stl' && ext !== 'obj' && ext !== '3mf') {
      alert('Only .stl, .obj, and .3mf files are supported in this estimator.')
      return
    }

    if (stlUrl) URL.revokeObjectURL(stlUrl)
    setStlFile(file)
    setStlUrl(URL.createObjectURL(file))
    setBbox(null)
    setBboxLoading(true)

    if (ext === 'obj' || ext === '3mf') {
      // Mock dimensions for obj/3mf
      setBbox({ x: 80, y: 80, z: 80 })
      setSize('medium')
      setBboxLoading(false)
      return
    }

    const box = await stlBoundingBox(file)
    setBbox(box)
    if (box) setSize(sizeFromBbox(box))
    setBboxLoading(false)
  }

  // Copy Suggested Price
  const [copiedPrice, setCopiedPrice] = useState(false)
  const copyPriceValue = () => {
    if (!activeBreakdown) return
    navigator.clipboard.writeText(activeBreakdown.total.toFixed(2))
    setCopiedPrice(true)
    setTimeout(() => setCopiedPrice(false), 1500)
  }

  // Settings inputs
  const updateSetting = (key: keyof CostSettings, val: number) => {
    setSettings((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Estimators/File lists (7/12 width) */}
      <div className="lg:col-span-7 space-y-5">
        {/* Modern Tab Selector */}
        <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab('gcode')}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold tracking-wide transition duration-150 ${
              tab === 'gcode'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            G-code — Accurate
          </button>
          <button
            type="button"
            onClick={() => setTab('estimate')}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold tracking-wide transition duration-150 ${
              tab === 'estimate'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Estimate — Rough
          </button>
        </div>

        {tab === 'gcode' ? (
          /* G-CODE TAB VIEW */
          <div className="space-y-4">
            {gcodeItems.length === 0 ? (
              <label
                className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center hover:border-orange-400 hover:bg-orange-50/5 transition duration-200 group"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  addGcodeFiles(e.dataTransfer.files)
                }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 group-hover:scale-105 transition">
                  <FileCode2 className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition">Drop .gcode plate here</p>
                  <p className="mt-1 text-xs text-slate-450">Drag & drop or click to upload sliced prints (multiple plates OK)</p>
                  <p className="mt-3 text-[9px] font-bold text-slate-400 border-t border-slate-100 pt-2.5 max-w-[200px] mx-auto uppercase tracking-wider">
                    Supported formats: <strong>.GCODE</strong>
                  </p>
                </div>
                <input
                  ref={gcodeInputRef}
                  type="file"
                  accept=".gcode,.bgcode"
                  multiple
                  className="hidden"
                  onChange={(e) => addGcodeFiles(e.target.files)}
                />
              </label>
            ) : (
              <div className="space-y-3">
                {gcodeItems.map((item, idx) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5 transition duration-200 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-50 text-orange-500 shrink-0">
                        <FileCode2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.file.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGcodeItems((prev) => prev.filter((i) => i.id !== item.id))}
                        className="text-slate-300 hover:text-red-500 transition p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Stats & Slicer Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-lg p-2 text-xs">
                      {item.parsing ? (
                        <span className="flex items-center gap-1.5 text-slate-450 text-[11px] font-medium py-0.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" /> Analyzing slices...
                        </span>
                      ) : item.stats ? (
                        <>
                          <div className="flex items-center gap-3 text-slate-650 font-medium">
                            {item.stats.weight_g != null && (
                              <span>Weight: <strong className="text-slate-800 font-mono">{item.stats.weight_g}g</strong></span>
                            )}
                            {item.stats.print_hours != null && (
                              <span>Print Time: <strong className="text-slate-800 font-mono">{fmtHours(item.stats.print_hours)}</strong></span>
                            )}
                          </div>
                          {item.stats.slicer && (
                            <span className="rounded bg-slate-250/50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              {item.stats.slicer}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 py-0.5 font-bold">No stats parsed</span>
                      )}
                    </div>

                    {/* Material Selector Option Override */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Material Override</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.material}
                          onChange={(e) =>
                            setGcodeItems((prev) =>
                              prev.map((i) => (i.id === item.id ? { ...i, material: e.target.value as FilamentMaterial } : i))
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 font-semibold focus:border-orange-500 focus:outline-none"
                        >
                          {(uniqueMaterials.length > 0 ? uniqueMaterials : (Object.keys(MATERIAL_LABELS) as FilamentMaterial[])).map((m) => (
                            <option key={m} value={m}>
                              {MATERIAL_LABELS[m]}
                            </option>
                          ))}
                        </select>
                        {printer.filament_costs?.[item.material] && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            (RM {printer.filament_costs[item.material]}/kg)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Slices total sum alert badge */}
                {allGcodeDone && anyGcodeStats && gcodeItems.length > 1 && (
                  <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 text-xs text-teal-700 flex items-center justify-between font-medium">
                    <span>Aggregated Plates ({gcodeItems.length})</span>
                    <span className="font-mono">
                      ~{Math.round(totalGcodeWeight)}g weight · {fmtHours(totalGcodeHours)} time
                    </span>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => gcodeInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600 transition"
                  >
                    <Plus className="h-4 w-4" /> Add another plate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGcodeItems([])
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
                  >
                    Clear All
                  </button>
                </div>
                <input
                  ref={gcodeInputRef}
                  type="file"
                  accept=".gcode,.bgcode"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addGcodeFiles(e.target.files)
                    if (gcodeInputRef.current) gcodeInputRef.current.value = ''
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          /* ESTIMATE TAB VIEW */
          <div className="space-y-5">
            {/* Info notice */}
            <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              <Info className="h-4 w-4 shrink-0 text-blue-400" />
              <p>Rough estimate based on typical print weights for each size. Upload an STL/OBJ/3MF to visualizer bounds.</p>
            </div>

            {/* Optional file upload */}
            <div>
              {!stlFile ? (
                <label
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-8 text-center hover:border-orange-300 hover:bg-orange-50/5 transition group"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files[0]
                    if (f) handleStlFile(f)
                  }}
                >
                  <Upload className="h-6 w-6 text-slate-400 group-hover:text-orange-500 transition mb-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-650 group-hover:text-slate-800 transition">Drop 3D file to auto-detect size (Optional)</p>
                    <p className="text-[10px] text-slate-400 mt-1">Supports STL, OBJ, and 3MF files up to 50MB</p>
                  </div>
                  <input
                    ref={stlInputRef}
                    type="file"
                    accept=".stl,.obj,.3mf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleStlFile(f)
                    }}
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2 className="h-4.5 w-4.5 text-orange-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{stlFile.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {bboxLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-450" />}
                      {bbox && (
                        <span className="text-[10px] font-bold text-teal-600 font-mono">
                          {bbox.x} × {bbox.y} × {bbox.z} mm
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setStlFile(null)
                          if (stlUrl) {
                            URL.revokeObjectURL(stlUrl)
                            setStlUrl(null)
                          }
                          setBbox(null)
                        }}
                        className="text-slate-300 hover:text-red-500 transition p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* 3D Visualizer Canvas (STL & 3MF files) */}
                  {stlUrl ? (
                    (stlFile.name.toLowerCase().endsWith('.stl') || stlFile.name.toLowerCase().endsWith('.3mf')) ? (
                      <Suspense fallback={<div className="h-44 animate-pulse bg-slate-50" />}>
                        <STLViewer urls={[stlUrl]} fileNames={[stlFile.name]} colors={['#f3f4f6']} className="h-48 w-full block" />
                      </Suspense>
                    ) : (
                      <div className="h-32 bg-slate-50 flex flex-col items-center justify-center text-center p-4">
                        <FileCode2 className="h-6 w-6 text-slate-350 mb-1" />
                        <p className="text-[11px] font-bold text-slate-650">3D Preview Unavailable</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">WebGL rendering is supported for STL and 3MF files.</p>
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </div>

            {/* Print Parameters selectors */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Size Select */}
              <div>
                <p className="mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Size</p>
                <div className="flex flex-col gap-1.5">
                  {(['small', 'medium', 'large'] as PrintSize[]).map((s) => {
                    const est = PRINT_ESTIMATES[s][quality]
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`rounded-xl border px-3 py-2 text-left text-xs transition duration-150 ${
                          size === s
                            ? 'border-orange-500 bg-orange-500/5 text-orange-600 font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-bold capitalize">{s}</p>
                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">~{est.weight_g}g / ~{fmtHours(est.hours)}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quality Select */}
              <div>
                <p className="mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality</p>
                <div className="flex flex-col gap-1.5">
                  {([
                    ['basic', 'Basic', '15% infill'],
                    ['advanced', 'Advanced', '40% infill'],
                  ] as const).map(([q, label, desc]) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition duration-150 ${
                        quality === q
                          ? 'border-orange-500 bg-orange-500/5 text-orange-600 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-bold">{label}</p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Material Select */}
              <div>
                <p className="mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material</p>
                <div className="flex flex-col gap-1.5">
                  {availableMaterials.map((m) => {
                    const cpkg = printer.filament_costs?.[m] ?? DEFAULT_FILAMENT_COST_PER_KG[m]
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMaterial(m)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-xs transition duration-155 ${
                          material === m
                            ? 'border-orange-500 bg-orange-500/5 text-orange-600 font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-bold">{MATERIAL_LABELS[m]}</p>
                        {cpkg && <p className="text-[9px] text-slate-400 font-semibold mt-0.5">RM {cpkg}/kg</p>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Cost Breakdown & Collapsible Settings (5/12 width) */}
      <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
        {/* Cost breakdown summary card */}
        {activeBreakdown ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm overflow-hidden animate-fade-in">
            <div className="px-4 py-3.5 bg-slate-100/60 border-b border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">Cost Breakdown</span>
              <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                RM {activeBreakdown.total.toFixed(2)}
              </span>
            </div>

            <div className="px-4 py-4 space-y-3.5 text-xs">
              {activeBreakdown.rows.map((row, i) => {
                const isBase = row.label === 'Base cost'
                const isMarkup = row.label.startsWith('Markup')
                return (
                  <div
                    key={i}
                    className={`flex justify-between items-start ${
                      isBase
                        ? 'border-t border-slate-200 pt-3 font-bold text-slate-800'
                        : isMarkup
                        ? 'text-emerald-600 font-semibold'
                        : 'text-slate-650'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700 truncate">{row.label.split('Markup')[0]}</p>
                      {row.sub && <p className="text-[10px] text-slate-400 mt-0.5 leading-tight font-medium">{row.sub}</p>}
                    </div>
                    <span className="font-mono text-slate-800 font-bold whitespace-nowrap">{rm(row.value)}</span>
                  </div>
                )
              })}

              {activeBreakdown.total === 15.00 && (
                <div className="text-[10px] text-amber-600 font-semibold mt-2 bg-amber-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1 border border-amber-100/70">
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" /> Note: RM 15.00 minimum order price applied.
                </div>
              )}
            </div>

            {/* Suggested price footer card */}
            <div className="flex items-center justify-between bg-white border-t border-slate-200 px-4 py-4.5">
              <div>
                <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider leading-none mb-1">Suggested Price</p>
                <p className="text-2xl font-black text-orange-600 font-mono leading-none">
                  {rm(activeBreakdown.total)}
                </p>
              </div>
              <button
                type="button"
                onClick={copyPriceValue}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
                title="Copy suggested price"
              >
                {copiedPrice ? (
                  <Check className="h-4.5 w-4.5 text-emerald-500 animate-pulse" />
                ) : (
                  <Copy className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-450">
            <DollarSign className="mx-auto h-7 w-7 text-slate-300 mb-2" />
            <p className="font-bold">No Estimate Generated</p>
            <p className="mt-1 max-w-[200px] mx-auto text-[10px]">Upload a file or choose parameters to see the pricing breakdown.</p>
          </div>
        )}

        {/* Collapsible cost settings settings panel */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-xs font-bold text-slate-700 tracking-wide uppercase hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-slate-400" /> Cost Settings
            </span>
            {settingsOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {settingsOpen && (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3.5 grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
              {[
                { key: 'electricityRate', label: 'Electricity Rate', unit: 'RM/kWh', step: '0.01' },
                { key: 'machineRate', label: 'Machine Wear', unit: 'RM/hr', step: '0.1' },
                { key: 'wastePct', label: 'Waste Overhead', unit: '%', step: '1' },
                { key: 'markupPct', label: 'Profit Markup', unit: '%', step: '1' },
              ].map((s) => (
                <div key={s.key}>
                  <label className="mb-1 block text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    {s.label} ({s.unit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={s.step}
                    value={settings[s.key as keyof CostSettings]}
                    onChange={(e) => updateSetting(s.key as keyof CostSettings, parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition"
                  />
                </div>
              ))}
              <p className="col-span-2 text-[10px] text-slate-400 mt-1 leading-normal font-medium border-t border-slate-100 pt-2.5">
                Changes apply only to this active session. Go to your **Equipment** dashboard settings to update defaults persistently.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

