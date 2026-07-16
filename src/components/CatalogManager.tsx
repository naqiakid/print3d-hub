'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Plus, Pencil, Trash2, Package, Upload, FileBox, X, FileCode2, Loader2, ChevronUp, Image as ImageIcon, Video } from 'lucide-react'

const STLViewer = dynamic(() => import('@/components/STLViewerWrapper'), { ssr: false })
import type { CatalogItem, FilamentMaterial, Filament, RequestPrinterView, PartAssembly } from '@/lib/types'
import { MATERIAL_LABELS, parseAssemblyMetadata, cleanDescription, serializeAssemblyMetadata } from '@/lib/types'
import { createCatalogItem, updateCatalogItem, deleteCatalogItem } from '@/lib/actions'
import { createClient } from '@/lib/supabase/client'
import { getPresetById } from '@/lib/printer-models'
import { parseGcodeFile } from '@/lib/parse-gcode'
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

// ── G-code calculator types ───────────────────────────────────────────────────

type GcodeItem = {
  id: string
  file: File
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

// ── Form state ────────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { name: 'Black',   hex: '#1a1a1a' },
  { name: 'White',   hex: '#f5f5f5' },
  { name: 'Grey',    hex: '#6b7280' },
  { name: 'Natural', hex: '#d4b896' },
  { name: 'Red',     hex: '#dc2626' },
  { name: 'Blue',    hex: '#2563eb' },
  { name: 'Green',   hex: '#16a34a' },
  { name: 'Yellow',  hex: '#ca8a04' },
  { name: 'Orange',  hex: '#ea580c' },
  { name: 'Purple',  hex: '#7c3aed' },
]

const CATEGORY_PRESETS = ['Home Decor', 'Keychains', 'Figurines', 'Organizers', 'Gifts & Toys', 'Tools & Parts']

type FormState = {
  name: string
  description: string
  category: string
  photo_url: string           // legacy single URL (back-compat)
  photo_urls: string[]        // uploaded product photos
  video_url: string           // YouTube / direct video link
  model_url: string
  stl_urls: string[]
  allow_custom_text: boolean
  text_prompt: string
  // Material & color
  allow_material_choice: boolean
  available_materials: string[]     // materials customer can pick (when allow_material_choice ON)
  material_prices: Record<string, string>  // RM price per material (when allow_material_choice ON)
  material: string                  // fixed material (when allow_material_choice OFF)
  allow_color_choice: boolean
  color: string                     // fixed color name (when allow_color_choice OFF)
  color_hex: string
  // Other customisations
  allow_resize: boolean
  resize_min_pct: number
  resize_max_pct: number
  base_price: string
}

const BLANK: FormState = {
  name: '',
  description: '',
  category: '',
  photo_url: '',
  photo_urls: [],
  video_url: '',
  model_url: '',
  stl_urls: [],
  allow_custom_text: false,
  text_prompt: 'Text to add',
  allow_material_choice: false,
  available_materials: [],
  material_prices: {},
  material: '',
  allow_color_choice: true,
  color: '',
  color_hex: '#888888',
  allow_resize: false,
  resize_min_pct: 80,
  resize_max_pct: 150,
  base_price: '',
}

function itemToForm(item: CatalogItem): FormState {
  const prices: Record<string, string> = {}
  for (const [mat, price] of Object.entries(item.material_prices ?? {})) {
    prices[mat] = String(price)
  }
  return {
    name: item.name,
    description: cleanDescription(item.description),
    category: item.category ?? '',
    photo_url: item.photo_url ?? '',
    photo_urls: item.photo_urls ?? [],
    video_url: item.video_url ?? '',
    model_url: item.model_url ?? '',
    stl_urls: item.stl_urls ?? [],
    allow_custom_text: item.allow_custom_text,
    text_prompt: item.text_prompt,
    allow_material_choice: item.allow_material_choice,
    available_materials: item.available_materials ?? [],
    material_prices: prices,
    material: item.material ?? '',
    allow_color_choice: item.allow_color_choice,
    color: item.color ?? '',
    color_hex: item.color_hex ?? '#888888',
    allow_resize: item.allow_resize,
    resize_min_pct: item.resize_min_pct,
    resize_max_pct: item.resize_max_pct,
    base_price: item.base_price != null ? String(item.base_price) : '',
  }
}

// ── CatalogManager ────────────────────────────────────────────────────────────

export default function CatalogManager({
  initialItems,
  printer,
  filaments,
}: {
  initialItems: CatalogItem[]
  printer: RequestPrinterView
  filaments: Filament[]
}) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function openNew() { setForm(BLANK); setEditing('new'); setError('') }
  function openEdit(item: CatalogItem) { setForm(itemToForm(item)); setEditing(item.id); setError('') }
  function closeForm() { setEditing(null); setError('') }

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function toggleAvailableMaterial(mat: string) {
    setForm((prev) => {
      const has = prev.available_materials.includes(mat)
      const newMats = has ? prev.available_materials.filter((m) => m !== mat) : [...prev.available_materials, mat]
      const newPrices = { ...prev.material_prices }
      if (has) delete newPrices[mat]
      return { ...prev, available_materials: newMats, material_prices: newPrices }
    })
  }

  function setMaterialPrice(mat: string, price: string) {
    setForm((prev) => ({ ...prev, material_prices: { ...prev.material_prices, [mat]: price } }))
  }

  function handleSave() {
    if (!form.name.trim()) { setError('Product name is required.'); return }
    if (form.allow_material_choice) {
      const anyPrice = Object.values(form.material_prices).some((p) => parseFloat(p) > 0)
      if (!anyPrice) { setError('Set a price for at least one material.'); return }
    } else if (!form.base_price || parseFloat(form.base_price) <= 0) {
      setError('Set a price for this product.'); return
    }
    setError('')

    // Derive base_price from min material price when allow_material_choice is ON
    let basePriceNum: number | null = form.base_price ? parseFloat(form.base_price) : null
    if (form.allow_material_choice) {
      const prices = Object.values(form.material_prices).map(Number).filter((n) => !isNaN(n) && n > 0)
      basePriceNum = prices.length > 0 ? Math.min(...prices) : null
    }

    const materialPricesNum: Record<string, number> = {}
    for (const [mat, price] of Object.entries(form.material_prices)) {
      const n = parseFloat(price)
      if (!isNaN(n) && n > 0) materialPricesNum[mat] = n
    }

    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim() || null,
      photo_url: (form.photo_urls[0] ?? form.photo_url.trim()) || null,
      photo_urls: form.photo_urls,
      video_url: form.video_url.trim() || null,
      model_url: form.model_url.trim() || null,
      stl_urls: form.stl_urls,
      allow_custom_text: form.allow_custom_text,
      text_prompt: form.text_prompt.trim() || 'Text to add',
      allow_material_choice: form.allow_material_choice,
      available_materials: form.allow_material_choice ? form.available_materials : [],
      material_prices: materialPricesNum,
      material: !form.allow_material_choice && form.material ? form.material : null,
      allow_color_choice: form.allow_color_choice,
      color: form.color.trim() ? form.color.trim() : null,
      color_hex: form.color.trim() ? form.color_hex : null,
      allow_resize: form.allow_resize,
      resize_min_pct: form.resize_min_pct,
      resize_max_pct: form.resize_max_pct,
      base_price: basePriceNum,
    }

    startTransition(async () => {
      if (editing === 'new') {
        const res = await createCatalogItem(data)
        if ('error' in res) { setError(res.error); return }
        const newItem: CatalogItem = {
          id: res.id, owner_id: printer.id, sort_order: 0, is_active: true,
          created_at: new Date().toISOString(),
          ...data,
          photo_url: data.photo_url ?? null,
          photo_urls: data.photo_urls ?? [],
          video_url: data.video_url ?? null,
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
        setItems((prev) => prev.map((i) => i.id === editing ? { ...i, ...data, material: data.material ?? null, color: data.color ?? null, color_hex: data.color_hex ?? null, base_price: data.base_price ?? null } : i))
      }
      closeForm()
    })
  }

  function handleDelete(item: CatalogItem) {
    if (!confirm(`Remove "${item.name}" from your catalog?`)) return
    startTransition(async () => {
      const res = await deleteCatalogItem(item.id)
      if ('error' in res) { setError(res.error); return }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    })
  }

  // Group items by category — falls back to a flat list (no headers) when no item has a category set
  const categories = [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort()
  const showGroupHeaders = categories.length > 0
  const groups: [string | null, CatalogItem[]][] = showGroupHeaders
    ? [
        ...categories.map((c): [string, CatalogItem[]] => [c, items.filter((i) => i.category === c)]),
        ...(items.some((i) => !i.category) ? [['Uncategorized', items.filter((i) => !i.category)] as [string, CatalogItem[]]] : []),
      ]
    : [[null, items]]

  function renderItem(item: CatalogItem) {
    return (
        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex gap-4 p-4">
            <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
              {(item.photo_urls?.[0] ?? item.photo_url)
                ? <img src={(item.photo_urls?.[0] ?? item.photo_url) as string} alt={item.name} className="h-full w-full object-cover" />
                : <Package className="h-8 w-8 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {/* Material + color badges */}
                    {item.allow_material_choice ? (
                      <span className="text-xs text-slate-500">
                        {item.available_materials.map((m) => MATERIAL_LABELS[m as FilamentMaterial] ?? m).join(' / ')}
                        {item.base_price ? ` · from RM ${item.base_price.toFixed(2)}` : ''}
                      </span>
                    ) : (
                      <>
                        {item.material && <span className="text-xs text-slate-500">{MATERIAL_LABELS[item.material as FilamentMaterial] ?? item.material}</span>}
                        {item.color && item.color_hex && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <span className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0" style={{ background: item.color_hex }} />
                            {item.color}
                          </span>
                        )}
                        {item.allow_color_choice && <span className="text-xs text-slate-400 italic">color by customer</span>}
                        {item.base_price && <span className="text-xs text-orange-600 font-medium">RM {item.base_price.toFixed(2)}</span>}
                      </>
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
              {item.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {item.allow_custom_text && <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-600">Custom text</span>}
                {item.allow_resize && <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-600">Resize</span>}
              </div>
            </div>
          </div>

          {editing === item.id && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-5 space-y-4">
              <CatalogForm
                form={form} set={set}
                toggleAvailableMaterial={toggleAvailableMaterial}
                setMaterialPrice={setMaterialPrice}
                filaments={filaments}
                printer={printer}
                onSave={handleSave} onCancel={closeForm}
                isPending={isPending} error={error}
              />
            </div>
          )}
        </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.length === 0 && editing !== 'new' && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No products yet</p>
          <p className="mt-1 text-xs text-slate-400">Add your best prints so customers can order them directly.</p>
        </div>
      )}

      {groups.map(([category, groupItems]) => (
        <div key={category ?? '__flat__'} className="space-y-4">
          {showGroupHeaders && (
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {category}
            </p>
          )}
          {groupItems.map((item) => renderItem(item))}
        </div>
      ))}

      {editing === 'new' && (
        <div className="rounded-2xl border border-orange-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">New product</p>
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
          <CatalogForm
            form={form} set={set}
            toggleAvailableMaterial={toggleAvailableMaterial}
            setMaterialPrice={setMaterialPrice}
            filaments={filaments}
            printer={printer}
            onSave={handleSave} onCancel={closeForm}
            isPending={isPending} error={error}
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
  printer: RequestPrinterView
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
  const allDone     = items.length > 0 && items.every((i) => !i.parsing)
  const anyStats    = items.some((i) => i.stats?.weight_g != null)

  type Breakdown = { perPlate: { label: string; cost: number }[]; electricityCost: number; machineCost: number; wasteCost: number; baseCost: number; markup: number; total: number }
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)

  useEffect(() => {
    if (!anyStats) { setBreakdown(null); return }
    const elecRate = printer.electricity_rate ?? DEFAULT_ELECTRICITY_RATE
    const machRate = printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE
    const wastePct = printer.waste_percent ?? DEFAULT_WASTE_PERCENT
    const perPlate = items.filter((i) => (i.stats?.weight_g ?? 0) > 0).map((i, idx) => {
      const w = i.stats!.weight_g!
      const costPerKg = printer.filament_costs?.[i.material] ?? DEFAULT_FILAMENT_COST_PER_KG[i.material] ?? 55
      return { label: `Plate ${idx + 1} — ${w}g ${MATERIAL_LABELS[i.material]} @ RM${costPerKg}/kg`, cost: (w / 1000) * costPerKg }
    })
    const filamentCost    = perPlate.reduce((s, p) => s + p.cost, 0)
    const electricityCost = totalHours > 0 ? totalHours * (modelPowerWatts / 1000) * elecRate : 0
    const machineCost     = totalHours > 0 ? totalHours * machRate : 0
    const subtotal        = filamentCost + electricityCost + machineCost
    const wasteCost       = subtotal * (wastePct / 100)
    const baseCost        = subtotal + wasteCost
    const markupAmt       = baseCost * (markup / 100)
    setBreakdown({ perPlate, electricityCost, machineCost, wasteCost, baseCost, markup: markupAmt, total: baseCost + markupAmt })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, markup, anyStats, totalHours])

  async function parseLocally(item: GcodeItem) {
    try {
      const stats = await parseGcodeFile(item.file)
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false, stats } : i))
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, parsing: false } : i))
    }
  }

  function addFiles(files: FileList | File[]) {
    const newItems: GcodeItem[] = Array.from(files)
      .filter((f) => /\.(gcode|bgcode)$/i.test(f.name))
      .map((f) => ({ id: crypto.randomUUID(), file: f, parsing: true, error: '', stats: null, material: defaultMaterial }))
    if (!newItems.length) return
    setItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => parseLocally(item))
  }

  function reset() { setItems([]); setBreakdown(null) }

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
        <button type="button" onClick={() => { reset(); setOpen(false) }} className="text-slate-400 hover:text-slate-600 transition">
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

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
                {item.parsing && <span className="flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Reading</span>}
                {!item.parsing && item.stats && (
                  <span className="shrink-0 text-xs font-medium text-teal-600">
                    {item.stats.weight_g != null && `${item.stats.weight_g}g`}
                    {item.stats.weight_g != null && item.stats.print_hours != null && ' · '}
                    {item.stats.print_hours != null && fmtHours(item.stats.print_hours)}
                  </span>
                )}
                {item.error && <span className="shrink-0 text-xs text-red-500">{item.error}</span>}
                <button type="button" onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))} className="shrink-0 text-slate-300 hover:text-slate-600 transition">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
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

          {allDone && anyStats && (
            <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs">
              <span className="font-medium text-teal-800">{items.length > 1 && `${items.length} plates · `}Total: </span>
              <span className="text-teal-700">
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
              <span>Base cost</span><span className="tabular-nums">RM {breakdown.baseCost.toFixed(2)}</span>
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

// ── CatalogForm ───────────────────────────────────────────────────────────────

function CatalogForm({
  form, set, toggleAvailableMaterial, setMaterialPrice,
  filaments, printer, onSave, onCancel, isPending, error,
}: {
  form: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  toggleAvailableMaterial: (mat: string) => void
  setMaterialPrice: (mat: string, price: string) => void
  filaments: Filament[]
  printer: RequestPrinterView
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState('')
  const [linkInput, setLinkInput] = useState('')
  const [linkError, setLinkError] = useState('')

  const handleAddLink = () => {
    setLinkError('')
    const trimmed = linkInput.trim()
    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed)) {
      setLinkError('Please enter a valid URL starting with http:// or https://')
      return
    }
    set('stl_urls', [...form.stl_urls, trimmed])
    setLinkInput('')
  }
  async function handlePhotoFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    const allowed = Array.from(files).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name))
    if (allowed.length === 0) { setPhotoUploadError('Only JPG, PNG, WebP, or GIF images are accepted.'); return }
    setUploadingPhotos(true); setPhotoUploadError('')
    const supabase = createClient()
    const newUrls: string[] = []
    for (const file of allowed) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `catalog/photos/${Date.now()}-${safeName}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('stl-files')
        .upload(path, file, { contentType: file.type })
      if (uploadErr || !uploadData) { setPhotoUploadError(uploadErr?.message ?? 'Upload failed'); setUploadingPhotos(false); return }
      const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
      newUrls.push(urlData.publicUrl)
    }
    set('photo_urls', [...form.photo_urls, ...newUrls])
    setUploadingPhotos(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }
  // Auto-open Advanced options when editing a product that already uses them,
  // so the owner doesn't lose visibility of their existing configuration.
  const [showAdvanced, setShowAdvanced] = useState(() => !!(
    form.description || form.category || form.photo_urls.length > 0 || form.photo_url ||
    form.video_url || form.model_url || form.stl_urls.length > 0 ||
    form.allow_material_choice || form.allow_custom_text || form.allow_resize ||
    (!form.allow_color_choice && (form.material || form.color))
  ))

  // Unique materials the owner has in stock
  const uniqueMaterials = [...new Set(filaments.map((f) => f.material))] as FilamentMaterial[]

  // Colors for the currently selected (fixed) material
  const colorsForMaterial = filaments.filter((f) => f.material === form.material)

  // Default material for G-code calculator
  const defaultMaterial = (form.material || uniqueMaterials[0] || 'pla') as FilamentMaterial

  const defaultColorsList: { color: string; color_hex: string }[] = (() => {
    if (filaments.length > 0) {
      const seen = new Set<string>()
      const list: { color: string; color_hex: string }[] = []
      filaments.forEach((f) => {
        const key = `${f.color.trim().toLowerCase()}-${f.color_hex.trim().toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          list.push({ color: f.color, color_hex: f.color_hex })
        }
      })
      return list
    }
    return COLOR_PRESETS.map((c) => ({ color: c.name, color_hex: c.hex }))
  })()

  async function handleStlFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const allowed = Array.from(files).filter((f) => ['.stl', '.3mf'].some((ext) => f.name.toLowerCase().endsWith(ext)))
    if (allowed.length === 0) { setUploadError('Only .stl and .3mf files are accepted.'); return }
    setUploading(true); setUploadError('')
    const supabase = createClient()
    const newUrls: string[] = []
    for (const file of allowed) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `catalog/${Date.now()}-${safeName}`
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('stl-files').upload(path, file)
      if (uploadErr || !uploadData) { setUploadError(uploadErr?.message ?? 'Upload failed'); setUploading(false); return }
      const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
      newUrls.push(urlData.publicUrl)
    }
    set('stl_urls', [...form.stl_urls, ...newUrls])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      {/* Name + price — the only two fields required to list a product */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Product name <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Custom Name Keychain" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Price (RM) {!form.allow_material_choice && <span className="text-red-500">*</span>}
          </label>
          {form.allow_material_choice ? (
            <div className="flex h-[38px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400">
              Set per material in Advanced options
            </div>
          ) : (
            <input type="number" min="0" step="0.50" value={form.base_price}
              onChange={(e) => set('base_price', e.target.value)}
              placeholder="e.g. 15.00" className={inputClass} />
          )}
        </div>
      </div>
      {!form.allow_material_choice && (
        <GcodeCalculator printer={printer} defaultMaterial={defaultMaterial}
          onUsePrice={(price) => set('base_price', price)} />
      )}

      {/* ── Advanced options ── */}
      <button type="button" onClick={() => setShowAdvanced((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-orange-200 transition">
        <span>Advanced options</span>
        <ChevronUp className={`h-4 w-4 transition-transform ${showAdvanced ? '' : 'rotate-180'}`} />
      </button>

      {showAdvanced && (
      <>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
        <input value={form.description} onChange={(e) => set('description', e.target.value)}
          placeholder="What is this print?" className={inputClass} />
      </div>

      {/* Category */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Category (optional)</label>
        <p className="mb-2 text-[11px] text-slate-400">
          Categories help customers filter your catalog — pick a preset or type your own.
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {CATEGORY_PRESETS.map((c) => (
            <button key={c} type="button"
              onClick={() => set('category', form.category === c ? '' : c)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                form.category === c
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
              }`}>
              {c}
            </button>
          ))}
        </div>
        <input value={form.category} onChange={(e) => set('category', e.target.value)}
          placeholder="Or type your own category" className={inputClass} />
      </div>

      {/* ── Photos ── */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Product photos</label>
        <p className="mb-2 text-[11px] text-slate-400">
          Upload photos of your finished print — JPG, PNG, or WebP. First photo is the cover image.
        </p>

        {/* Preview grid */}
        {form.photo_urls.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {form.photo_urls.map((url, i) => (
              <div key={url} className="relative h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-slate-200">
                <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/40 text-center text-[9px] font-semibold text-white py-0.5">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => set('photo_urls', form.photo_urls.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone */}
        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden"
          onChange={(e) => handlePhotoFiles(e.target.files)} />
        <label
          className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 hover:border-orange-300 hover:bg-orange-50/30 transition"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handlePhotoFiles(e.dataTransfer.files) }}
          onClick={() => photoInputRef.current?.click()}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
            {uploadingPhotos
              ? <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
              : <ImageIcon className="h-4 w-4 text-slate-400" />}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-700">
              {uploadingPhotos ? 'Uploading…' : 'Drop photos here or click to browse'}
            </p>
            <p className="text-[11px] text-slate-400">JPG · PNG · WebP · GIF · multiple allowed</p>
          </div>
        </label>
        {photoUploadError && <p className="mt-1 text-[11px] text-red-500">{photoUploadError}</p>}
      </div>

      {/* ── Video ── */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Video link (optional)</span>
        </label>
        <input
          value={form.video_url}
          onChange={(e) => set('video_url', e.target.value)}
          placeholder="https://youtube.com/... or https://youtu.be/..."
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          YouTube or direct video URL — shown on your product page so customers can see it in action.
        </p>
      </div>

      {/* ── Design link ── */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Original design link (optional)</label>
        <input value={form.model_url} onChange={(e) => set('model_url', e.target.value)}
          placeholder="https://www.makerworld.com/..." className={inputClass} />
      </div>

      {/* 3D model upload */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">3D model files for preview (optional)</label>
        <p className="mb-2 text-[11px] text-slate-400">Upload .stl or .3mf files — customers can spin and view the model before ordering.</p>
        {form.stl_urls.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {form.stl_urls.map((url, i) => {
              let filename = url.split('/').pop()?.split('?')[0] ?? `File ${i + 1}`
              if (url.includes('drive.google.com')) {
                filename = `Google Drive File (${i + 1})`
              } else if (url.includes('dropbox.com')) {
                filename = `Dropbox File (${i + 1})`
              } else {
                filename = filename.replace(/^\d+-/, '') // clean date prefix
              }
              return (
                <div key={url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <FileBox className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <span className="flex-1 truncate text-xs text-slate-600">{filename}</span>
                  <button type="button" onClick={() => set('stl_urls', form.stl_urls.filter((_, idx) => idx !== i))}
                    className="text-slate-300 hover:text-red-400 transition"><X className="h-3.5 w-3.5" /></button>
                </div>
              )
            })}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".stl,.3mf" multiple className="hidden" onChange={(e) => handleStlFiles(e.target.files)} />
        <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-500 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 transition">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : 'Choose .stl / .3mf files'}
        </button>
        {uploadError && <p className="mt-1 text-[11px] text-red-500">{uploadError}</p>}
        
        {/* Paste link input */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Or paste Google Drive/Dropbox shared URL..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
          />
          <button
            type="button"
            onClick={handleAddLink}
            className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
          >
            Add Link
          </button>
        </div>
        {linkError && <p className="mt-1 text-[11px] text-red-500">{linkError}</p>}

        <div className="mt-3 rounded-xl bg-orange-50/50 border border-orange-100 p-3 space-y-1">
          <p className="text-[11px] font-bold text-orange-700 flex items-center gap-1">💡 Tip for Multi-Part Assemblies</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Assemble and align your parts in your slicer (e.g., OrcaSlicer, Bambu Studio) or CAD tool first. In the <b>Objects</b> tab, right-click each part and select <b>Export as STL</b>. When you upload those separate STL files here, the 3D viewer will automatically assemble them correctly!
          </p>
        </div>
      </div>

      {/* ── Material & Color ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <p className="text-xs font-semibold text-slate-700">Material &amp; Color</p>

        {uniqueMaterials.length === 0 && (
          <p className="text-xs text-slate-400">No filaments in stock yet — add filaments in Equipment settings to select materials here.</p>
        )}

        {uniqueMaterials.length > 0 && (
          <>
            {/* allow_material_choice toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.allow_material_choice}
                onChange={(e) => set('allow_material_choice', e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-orange-500" />
              <div>
                <span className="text-sm font-medium text-slate-800">Let customer choose material</span>
                <p className="text-xs text-slate-400">Customer picks from the materials you make available. Set a price per material.</p>
              </div>
            </label>

            {form.allow_material_choice ? (
              /* Multi-material: checkboxes + per-material prices */
              <div className="space-y-2">
                {uniqueMaterials.map((mat) => {
                  const checked = form.available_materials.includes(mat)
                  return (
                    <div key={mat} className="flex items-center gap-3">
                      <input type="checkbox" checked={checked} onChange={() => toggleAvailableMaterial(mat)}
                        className="h-4 w-4 cursor-pointer accent-orange-500 shrink-0" />
                      <span className={`text-sm min-w-[60px] ${checked ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                        {MATERIAL_LABELS[mat]}
                      </span>
                      {checked && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">RM</span>
                          <input
                            type="number" min="0" step="0.50"
                            value={form.material_prices[mat] ?? ''}
                            onChange={(e) => setMaterialPrice(mat, e.target.value)}
                            placeholder="Price"
                            className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-800 focus:border-orange-400 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
                <p className="text-[11px] text-slate-400">Lowest price will show as "From RM X" on your listing.</p>
              </div>
            ) : (
              /* Single material: pill buttons */
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-600">Material</p>
                  <div className="flex flex-wrap gap-2">
                    {uniqueMaterials.map((mat) => (
                      <button key={mat} type="button"
                        onClick={() => { set('material', mat); set('color', ''); set('color_hex', '#888888') }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          form.material === mat
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                        }`}>
                        {MATERIAL_LABELS[mat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* allow_color_choice toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.allow_color_choice}
                    onChange={(e) => { set('allow_color_choice', e.target.checked); if (e.target.checked && form.stl_urls.length <= 1) { set('color', ''); set('color_hex', '#888888') } }}
                    className="h-4 w-4 cursor-pointer accent-orange-500" />
                  <div>
                    <span className="text-sm font-medium text-slate-800">Let customer choose color</span>
                    <p className="text-xs text-slate-400">Customer picks from your in-stock filaments for the selected material.</p>
                  </div>
                </label>

                {/* Single part: Fixed color swatches (when color choice is OFF and material is selected) */}
                {form.stl_urls.length <= 1 && !form.allow_color_choice && form.material && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-600">Color</p>
                    {colorsForMaterial.length === 0 ? (
                      <p className="text-xs text-slate-400">No {MATERIAL_LABELS[form.material as FilamentMaterial]} filaments in stock.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {colorsForMaterial.map((f) => {
                          const selected = form.color === f.color && form.color_hex === f.color_hex
                          return (
                            <button key={f.id} type="button"
                              onClick={() => { set('color', f.color); set('color_hex', f.color_hex) }}
                              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                                selected
                                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                              }`}>
                              <span className="h-3 w-3 rounded-full border border-slate-300 shrink-0" style={{ background: f.color_hex }} />
                              {f.color}
                              {f.brand && <span className="text-slate-400">· {f.brand}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-part color selection (regardless of allow_color_choice, to set defaults) */}
                {form.stl_urls.length > 1 && (
                  <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Default Part Colors</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Assign default colors for each model file below.</p>
                    </div>
                    <div className="space-y-3">
                      {form.stl_urls.map((url, i) => {
                        const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${i + 1}`
                        const currentPartColor = (() => {
                          const parts = form.color.split('|')
                          return parts[i] || 'Any'
                        })()
                        const currentPartColorHex = (() => {
                          const parts = form.color_hex.split('|')
                          return parts[i] || '#888888'
                        })()
                        return (
                          <div key={url} className="space-y-1 border-b border-slate-100/50 pb-2 last:border-0 last:pb-0">
                            <p className="text-[11px] font-semibold text-slate-600 truncate">{filename}</p>
                            <div className="flex flex-wrap gap-1">
                              {/* Add 'Any' option first */}
                              {[{ color: 'Any', color_hex: '#888888' }, ...defaultColorsList].map((f, idx) => {
                                const selected = currentPartColor === f.color && currentPartColorHex === f.color_hex
                                return (
                                  <button key={`${f.color}-${idx}`} type="button"
                                    onClick={() => {
                                      const colors = form.color.split('|')
                                      const hexes = form.color_hex.split('|')
                                      while (colors.length < form.stl_urls.length) {
                                        colors.push('Any')
                                        hexes.push('#888888')
                                      }
                                      colors[i] = f.color
                                      hexes[i] = f.color_hex
                                      set('color', colors.slice(0, form.stl_urls.length).join('|'))
                                      set('color_hex', hexes.slice(0, form.stl_urls.length).join('|'))
                                    }}
                                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                                      selected
                                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
                                    }`}>
                                    {f.color !== 'Any' && (
                                      <span className="h-1.5 w-1.5 rounded-full border border-slate-350 shrink-0" style={{ background: f.color_hex }} />
                                    )}
                                    {f.color}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Other customisations ── */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">Other customisations</p>
        <div className="space-y-3">
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
                    placeholder="e.g. Name to engrave, Custom message…" className={inputClass} />
                </div>
              )}
            </div>
          </label>

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
                      onChange={(e) => set('resize_min_pct', Number(e.target.value))} className={inputClass} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Max %</label>
                    <input type="number" min="100" max="500" value={form.resize_max_pct}
                      onChange={(e) => set('resize_max_pct', Number(e.target.value))} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      </>
      )}

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
