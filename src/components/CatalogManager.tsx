'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, Package, Upload, FileBox, X, FileCode2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { CatalogItem, FilamentMaterial, Printer } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import { createCatalogItem, updateCatalogItem, deleteCatalogItem } from '@/lib/actions'
import { createClient } from '@/lib/supabase/client'
import { getPresetById } from '@/lib/printer-models'
import {
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_MARKUP_PERCENT,
  DEFAULT_MACHINE_RATE,
  DEFAULT_WASTE_PERCENT,
  DEFAULT_FILAMENT_COST_PER_KG,
} from '@/lib/pricing'

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
  stats: { weight_g: number | null; print_hours: number | null } | null
  material: FilamentMaterial
}

function fmtHours(h: number | null | undefined): string {
  if (!h) return '—'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

type FormState = {
  name: string
  description: string
  photo_url: string
  model_url: string
  stl_urls: string[]
  allow_custom_text: boolean
  text_prompt: string
  allow_color_choice: boolean
  allow_resize: boolean
  resize_min_pct: number
  resize_max_pct: number
  allow_material_choice: boolean
  available_materials: string[]
  material: string
  color: string
  color_hex: string
  base_price: string
}

const BLANK: FormState = {
  name: '',
  description: '',
  photo_url: '',
  model_url: '',
  stl_urls: [],
  allow_custom_text: false,
  text_prompt: 'Text to add',
  allow_color_choice: true,
  allow_resize: false,
  resize_min_pct: 80,
  resize_max_pct: 150,
  allow_material_choice: false,
  available_materials: [],
  material: '',
  color: '',
  color_hex: '#888888',
  base_price: '',
}

function itemToForm(item: CatalogItem): FormState {
  return {
    name: item.name,
    description: item.description,
    photo_url: item.photo_url ?? '',
    model_url: item.model_url ?? '',
    stl_urls: item.stl_urls ?? [],
    allow_custom_text: item.allow_custom_text,
    text_prompt: item.text_prompt,
    allow_color_choice: item.allow_color_choice,
    allow_resize: item.allow_resize,
    resize_min_pct: item.resize_min_pct,
    resize_max_pct: item.resize_max_pct,
    allow_material_choice: item.allow_material_choice,
    available_materials: item.available_materials,
    material: item.material ?? '',
    color: item.color ?? '',
    color_hex: item.color_hex ?? '#888888',
    base_price: item.base_price != null ? String(item.base_price) : '',
  }
}

export default function CatalogManager({
  initialItems,
  printerId,
  printerMaterials,
  printer,
}: {
  initialItems: CatalogItem[]
  printerId: string
  printerMaterials: FilamentMaterial[]
  printer: Printer
}) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems)
  const [editing, setEditing] = useState<string | null>(null)  // item id or 'new'
  const [form, setForm] = useState<FormState>(BLANK)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function openNew() {
    setForm(BLANK)
    setEditing('new')
    setError('')
  }

  function openEdit(item: CatalogItem) {
    setForm(itemToForm(item))
    setEditing(item.id)
    setError('')
  }

  function closeForm() {
    setEditing(null)
    setError('')
  }

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function toggleMaterial(mat: string) {
    setForm((prev) => ({
      ...prev,
      available_materials: prev.available_materials.includes(mat)
        ? prev.available_materials.filter((m) => m !== mat)
        : [...prev.available_materials, mat],
    }))
  }

  function handleSave() {
    if (!form.name.trim()) { setError('Product name is required.'); return }
    setError('')

    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      photo_url: form.photo_url.trim() || null,
      model_url: form.model_url.trim() || null,
      stl_urls: form.stl_urls,
      allow_custom_text: form.allow_custom_text,
      text_prompt: form.text_prompt.trim() || 'Text to add',
      allow_color_choice: form.allow_color_choice,
      allow_resize: form.allow_resize,
      resize_min_pct: form.resize_min_pct,
      resize_max_pct: form.resize_max_pct,
      allow_material_choice: form.allow_material_choice,
      available_materials: form.allow_material_choice ? form.available_materials : [],
      material: form.material || null,
      color: !form.allow_color_choice && form.color.trim() ? form.color.trim() : null,
      color_hex: !form.allow_color_choice && form.color.trim() ? form.color_hex : null,
      base_price: form.base_price ? parseFloat(form.base_price) : null,
    }

    startTransition(async () => {
      if (editing === 'new') {
        const res = await createCatalogItem(printerId, data)
        if ('error' in res) { setError(res.error); return }
        const newItem: CatalogItem = {
          id: res.id,
          printer_id: printerId,
          sort_order: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          ...data,
          photo_url: data.photo_url ?? null,
          model_url: data.model_url ?? null,
          stl_urls: data.stl_urls ?? [],
          material: data.material ?? null,
          color: data.color ?? null,
          color_hex: data.color_hex ?? null,
          base_price: data.base_price ?? null,
        }
        setItems((prev) => [newItem, ...prev])
      } else if (editing) {
        const res = await updateCatalogItem(editing, data)
        if ('error' in res) { setError(res.error); return }
        setItems((prev) => prev.map((i) => i.id === editing ? { ...i, ...data } : i))
      }
      closeForm()
    })
  }

  function handleDelete(item: CatalogItem) {
    if (!confirm(`Remove "${item.name}" from your catalog?`)) return
    startTransition(async () => {
      const res = await deleteCatalogItem(item.id, printerId)
      if ('error' in res) { setError(res.error); return }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    })
  }

  const CUSTOMISATION_BADGES: Record<string, string> = {
    allow_custom_text: 'Custom text',
    allow_color_choice: 'Color choice',
    allow_resize: 'Resize',
    allow_material_choice: 'Material choice',
  }

  return (
    <div className="space-y-4">
      {/* Item list */}
      {items.length === 0 && editing !== 'new' && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No products yet</p>
          <p className="mt-1 text-xs text-slate-400">Add your best prints so customers can order them directly.</p>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex gap-4 p-4">
            {/* Photo */}
            <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
              {item.photo_url
                ? <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
                : <Package className="h-8 w-8 text-slate-300" />}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {item.material && (
                      <span className="text-xs text-slate-500">{MATERIAL_LABELS[item.material as FilamentMaterial] ?? item.material}</span>
                    )}
                    {item.color && item.color_hex && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <span className="h-2.5 w-2.5 rounded-full border border-slate-300" style={{ background: item.color_hex }} />
                        {item.color}
                      </span>
                    )}
                    {item.allow_color_choice && (
                      <span className="text-xs text-slate-400 italic">color by customer</span>
                    )}
                    {item.base_price && (
                      <span className="text-xs text-orange-600 font-medium">· From RM {item.base_price.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => openEdit(item)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDelete(item)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {item.description && (
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {(Object.keys(CUSTOMISATION_BADGES) as (keyof CatalogItem)[]).map((key) =>
                  item[key] ? (
                    <span key={key} className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-600">
                      {CUSTOMISATION_BADGES[key]}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          </div>

          {/* Inline edit form */}
          {editing === item.id && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-5 space-y-4">
              <CatalogForm
                form={form}
                set={set}
                toggleMaterial={toggleMaterial}
                printerMaterials={printerMaterials}
                printer={printer}
                onSave={handleSave}
                onCancel={closeForm}
                isPending={isPending}
                error={error}
              />
            </div>
          )}
        </div>
      ))}

      {/* Add new form */}
      {editing === 'new' && (
        <div className="rounded-2xl border border-orange-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">New product</p>
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <CatalogForm
            form={form}
            set={set}
            toggleMaterial={toggleMaterial}
            printerMaterials={printerMaterials}
            printer={printer}
            onSave={handleSave}
            onCancel={closeForm}
            isPending={isPending}
            error={error}
          />
        </div>
      )}

      {editing === null && (
        <button type="button" onClick={openNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-500 hover:border-orange-300 hover:text-orange-600 transition">
          <Plus className="h-4 w-4" /> Add product
        </button>
      )}
    </div>
  )
}

// ── G-code price calculator ───────────────────────────────────────────────────

function GcodeCalculator({
  printer,
  defaultMaterial,
  onUsePrice,
}: {
  printer: Printer
  defaultMaterial: FilamentMaterial
  onUsePrice: (price: string) => void
}) {
  const gcodeInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<GcodeItem[]>([])
  const [markup, setMarkup] = useState(printer.markup_percent ?? DEFAULT_MARKUP_PERCENT)

  const modelPowerWatts = getPresetById(printer.printer_model_id ?? '')?.power_watts ?? 200
  const totalWeight = items.reduce((s, i) => s + (i.stats?.weight_g ?? 0), 0)
  const totalHours  = items.reduce((s, i) => s + (i.stats?.print_hours ?? 0), 0)
  const allDone     = items.length > 0 && items.every((i) => !i.uploading && !i.parsing)
  const anyStats    = items.some((i) => i.stats?.weight_g != null)

  type Breakdown = {
    perPlate: { label: string; cost: number }[]
    electricityCost: number
    machineCost: number
    wasteCost: number
    baseCost: number
    markup: number
    total: number
  }
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)

  useEffect(() => {
    if (!anyStats) { setBreakdown(null); return }
    const elecRate  = printer.electricity_rate ?? DEFAULT_ELECTRICITY_RATE
    const machRate  = printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE
    const wastePct  = printer.waste_percent ?? DEFAULT_WASTE_PERCENT

    const perPlate = items
      .filter((i) => (i.stats?.weight_g ?? 0) > 0)
      .map((i, idx) => {
        const w = i.stats!.weight_g!
        const costPerKg = printer.filament_costs?.[i.material] ?? DEFAULT_FILAMENT_COST_PER_KG[i.material] ?? 55
        return {
          label: `Plate ${idx + 1} — ${w}g ${MATERIAL_LABELS[i.material]} @ RM${costPerKg}/kg`,
          cost: (w / 1000) * costPerKg,
        }
      })

    const filamentCost    = perPlate.reduce((s, p) => s + p.cost, 0)
    const electricityCost = totalHours > 0 ? totalHours * (modelPowerWatts / 1000) * elecRate : 0
    const machineCost     = totalHours > 0 ? totalHours * machRate : 0
    const subtotal        = filamentCost + electricityCost + machineCost
    const wasteCost       = subtotal * (wastePct / 100)
    const baseCost        = subtotal + wasteCost
    const markupAmt       = baseCost * (markup / 100)
    const total           = baseCost + markupAmt
    setBreakdown({ perPlate, electricityCost, machineCost, wasteCost, baseCost, markup: markupAmt, total })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, markup, anyStats, totalHours])

  async function uploadAndParse(item: GcodeItem) {
    const supabase = createClient()
    const path = `gcode/catalog/${Date.now()}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { data: uploadData, error } = await supabase.storage.from('stl-files').upload(path, item.file)
    if (error || !uploadData) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, uploading: false, error: error?.message ?? 'Upload failed' } : i))
      return
    }
    const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
    const publicUrl = urlData.publicUrl
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, uploading: false, url: publicUrl, parsing: true } : i))
    try {
      const res  = await fetch(`/api/parse-gcode?url=${encodeURIComponent(publicUrl)}`)
      const data = await res.json()
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false, stats: data.error ? null : data } : i))
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false } : i))
    }
  }

  function addFiles(files: FileList | File[]) {
    const newItems: GcodeItem[] = Array.from(files)
      .filter((f) => /\.(gcode|bgcode)$/i.test(f.name))
      .map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        url: null,
        uploading: true,
        parsing: false,
        error: '',
        stats: null,
        material: defaultMaterial,
      }))
    if (!newItems.length) return
    setItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => uploadAndParse(item))
  }

  function reset() {
    setItems([])
    setBreakdown(null)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition">
        <FileCode2 className="h-3.5 w-3.5" /> Calculate from G-code
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">Price calculator</p>
        <button type="button" onClick={() => { reset(); setOpen(false) }}
          className="text-slate-400 hover:text-slate-600 transition">
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      {/* G-code upload */}
      {items.length === 0 ? (
        <label
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-orange-200 bg-white px-4 py-5 text-center hover:border-orange-400 hover:bg-orange-50/50 transition"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100">
            <Upload className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Drop .gcode files here</p>
            <p className="text-xs text-slate-400 mt-0.5">or click to browse · multiple plates supported</p>
          </div>
          <input ref={gcodeInputRef} type="file" accept=".gcode,.bgcode" multiple className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files) }} />
        </label>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <FileCode2 className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 truncate text-xs text-slate-700">{item.file.name}</span>
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
                  </span>
                )}
                {item.error && <span className="shrink-0 text-xs text-red-500">{item.error}</span>}
                <button type="button" onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  className="shrink-0 text-slate-300 hover:text-slate-600 transition">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Per-plate material selector */}
              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-1.5">
                <span className="text-xs text-slate-500 shrink-0">Plate {idx + 1}:</span>
                <select value={item.material}
                  onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, material: e.target.value as FilamentMaterial } : i))}
                  className={selectClass}>
                  {(Object.entries(MATERIAL_LABELS) as [FilamentMaterial, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {/* Totals */}
          {allDone && anyStats && (
            <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs">
              <span className="font-medium text-teal-800">
                {items.length > 1 && `${items.length} plates · `}Total:
              </span>
              <span className="ml-1 text-teal-700">
                {totalWeight > 0 && `~${Math.round(totalWeight * 10) / 10}g filament`}
                {totalWeight > 0 && totalHours > 0 && ' · '}
                {totalHours > 0 && `~${fmtHours(totalHours)} print time`}
              </span>
            </div>
          )}

          <button type="button" onClick={() => gcodeInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition">
            <Plus className="h-3.5 w-3.5" /> Add another plate
          </button>
          <input ref={gcodeInputRef} type="file" accept=".gcode,.bgcode" multiple className="hidden"
            onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />
        </div>
      )}

      {/* Price breakdown */}
      {breakdown && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Cost breakdown</span>
          </div>
          <div className="px-3 py-2.5 space-y-1 text-xs">
            {breakdown.perPlate.map((p, i) => (
              <div key={i} className="flex justify-between text-slate-600">
                <span className="text-slate-500">{p.label}</span>
                <span className="font-medium tabular-nums">RM {p.cost.toFixed(2)}</span>
              </div>
            ))}
            {breakdown.electricityCost > 0 && (
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-500">Electricity ({fmtHours(totalHours)} × {modelPowerWatts}W)</span>
                <span className="font-medium tabular-nums">RM {breakdown.electricityCost.toFixed(2)}</span>
              </div>
            )}
            {breakdown.machineCost > 0 && (
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-500">Machine wear</span>
                <span className="font-medium tabular-nums">RM {breakdown.machineCost.toFixed(2)}</span>
              </div>
            )}
            {breakdown.wasteCost > 0 && (
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-500">Waste & maintenance</span>
                <span className="font-medium tabular-nums">RM {breakdown.wasteCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Base cost</span>
              <span className="tabular-nums">RM {breakdown.baseCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1.5">
                Markup
                <input type="number" min="0" max="500" step="5" value={markup}
                  onChange={(e) => setMarkup(Math.max(0, Number(e.target.value)))}
                  className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-xs font-medium text-slate-700 focus:border-orange-400 focus:outline-none" />
                <span className="text-xs text-slate-400">%</span>
              </span>
              <span className="tabular-nums">RM {breakdown.markup.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span className="font-bold text-slate-900">Suggested price</span>
              <span className="text-base font-bold text-orange-600">RM {breakdown.total.toFixed(2)}</span>
            </div>
          </div>
          <div className="px-3 pb-3">
            <button type="button"
              onClick={() => { onUsePrice(breakdown.total.toFixed(2)); reset(); setOpen(false) }}
              className="w-full rounded-xl bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">
              Use this price
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared form fields ────────────────────────────────────────────────────────

function CatalogForm({
  form,
  set,
  toggleMaterial,
  printerMaterials,
  printer,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  form: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  toggleMaterial: (m: string) => void
  printerMaterials: FilamentMaterial[]
  printer: Printer
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const defaultMaterial = (printerMaterials[0] ?? 'pla') as FilamentMaterial

  async function handleStlFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const allowed = Array.from(files).filter((f) =>
      ['.stl', '.3mf'].some((ext) => f.name.toLowerCase().endsWith(ext))
    )
    if (allowed.length === 0) {
      setUploadError('Only .stl and .3mf files are accepted.')
      return
    }
    setUploading(true)
    setUploadError('')
    const supabase = createClient()
    const newUrls: string[] = []
    for (const file of allowed) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `catalog/${Date.now()}-${safeName}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('stl-files')
        .upload(path, file)
      if (uploadErr || !uploadData) {
        setUploadError(uploadErr?.message ?? 'Upload failed')
        setUploading(false)
        return
      }
      const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
      newUrls.push(urlData.publicUrl)
    }
    set('stl_urls', [...form.stl_urls, ...newUrls])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      {/* Name + description */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Product name <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Custom Name Keychain" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Starting price (RM, optional)</label>
          <input type="number" min="0" step="0.50" value={form.base_price}
            onChange={(e) => set('base_price', e.target.value)}
            placeholder="e.g. 15.00" className={inputClass} />
          <div className="mt-1">
            <GcodeCalculator
              printer={printer}
              defaultMaterial={defaultMaterial}
              onUsePrice={(price) => set('base_price', price)}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
          placeholder="What is this print? What makes it special? Any size info?"
          rows={2} className={`${inputClass} resize-none`} />
      </div>

      {/* Photo + design link */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Photo URL</label>
          <input value={form.photo_url} onChange={(e) => set('photo_url', e.target.value)}
            placeholder="https://... (imgur, google photos, etc.)" className={inputClass} />
          <p className="mt-1 text-[11px] text-slate-400">Upload to Imgur or Google Photos and paste the link.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Original design link (optional)</label>
          <input value={form.model_url} onChange={(e) => set('model_url', e.target.value)}
            placeholder="https://www.makerworld.com/..." className={inputClass} />
        </div>
      </div>

      {/* 3D model upload */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">3D model files for preview (optional)</label>
        <p className="mb-2 text-[11px] text-slate-400">Upload .stl or .3mf files — customers can spin and view the model before ordering.</p>

        {form.stl_urls.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {form.stl_urls.map((url, i) => {
              const filename = url.split('/').pop()?.split('?')[0] ?? `File ${i + 1}`
              return (
                <div key={url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <FileBox className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <span className="flex-1 truncate text-xs text-slate-600">{filename}</span>
                  <button type="button"
                    onClick={() => set('stl_urls', form.stl_urls.filter((_, idx) => idx !== i))}
                    className="text-slate-300 hover:text-red-400 transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.3mf"
          multiple
          className="hidden"
          onChange={(e) => handleStlFiles(e.target.files)}
        />
        <button type="button" disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-500 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 transition">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : 'Choose .stl / .3mf files'}
        </button>
        {uploadError && <p className="mt-1 text-[11px] text-red-500">{uploadError}</p>}
      </div>

      {/* Material + Color */}
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Material</p>
          <div className="flex flex-wrap gap-2">
            {printerMaterials.map((mat) => (
              <button key={mat} type="button"
                onClick={() => set('material', mat)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  form.material === mat
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                }`}>
                {MATERIAL_LABELS[mat]}
              </button>
            ))}
            {printerMaterials.length === 0 && (
              <p className="text-xs text-slate-400">Add materials to your printer listing first.</p>
            )}
          </div>
        </div>

        {form.allow_color_choice ? (
          <p className="text-xs text-slate-400 italic">Color will be chosen by the customer from your filament stock.</p>
        ) : (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Color</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Color name (e.g. Black, Galaxy Blue)"
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                className={inputClass}
              />
              <input
                type="color"
                value={form.color_hex || '#888888'}
                onChange={(e) => set('color_hex', e.target.value)}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 p-1"
                title="Pick color"
              />
            </div>
          </div>
        )}
      </div>

      {/* Customisation options */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">What can customers customise?</p>
        <div className="space-y-3">

          {/* Custom text */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.allow_custom_text}
              onChange={(e) => set('allow_custom_text', e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-orange-500" />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-800">Text engraving / embossing</span>
              <p className="text-xs text-slate-400">Customer types a name, word, or message to be added to the surface.</p>
              {form.allow_custom_text && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Label shown to customer</label>
                  <input value={form.text_prompt} onChange={(e) => set('text_prompt', e.target.value)}
                    placeholder="e.g. Name to engrave, Company name, Custom message…"
                    className={inputClass} />
                </div>
              )}
            </div>
          </label>

          {/* Color choice */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.allow_color_choice}
              onChange={(e) => set('allow_color_choice', e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-orange-500" />
            <div>
              <span className="text-sm font-medium text-slate-800">Color selection</span>
              <p className="text-xs text-slate-400">Customer picks a filament color from your stock.</p>
            </div>
          </label>

          {/* Resize */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.allow_resize}
              onChange={(e) => set('allow_resize', e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-orange-500" />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-800">Scale / resize</span>
              <p className="text-xs text-slate-400">Customer chooses a print size as a percentage of the original.</p>
              {form.allow_resize && (
                <div className="mt-2 flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Min %</label>
                    <input type="number" min="10" max="100" value={form.resize_min_pct}
                      onChange={(e) => set('resize_min_pct', Number(e.target.value))}
                      className={inputClass} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Max %</label>
                    <input type="number" min="100" max="500" value={form.resize_max_pct}
                      onChange={(e) => set('resize_max_pct', Number(e.target.value))}
                      className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          </label>

          {/* Material choice */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.allow_material_choice}
              onChange={(e) => set('allow_material_choice', e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-orange-500" />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-800">Material selection</span>
              <p className="text-xs text-slate-400">Customer chooses which filament material to use.</p>
              {form.allow_material_choice && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {printerMaterials.map((mat) => (
                    <button key={mat} type="button"
                      onClick={() => toggleMaterial(mat)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        form.available_materials.includes(mat)
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                      }`}>
                      {MATERIAL_LABELS[mat]}
                    </button>
                  ))}
                  {printerMaterials.length === 0 && (
                    <p className="text-xs text-slate-400">Add materials to your printer listing first.</p>
                  )}
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 transition">
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={isPending}
          className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
          {isPending ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </>
  )
}
