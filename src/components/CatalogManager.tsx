'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Plus, Pencil, Trash2, Package, Upload, FileBox, X, FileCode2, Loader2, ChevronUp, Image as ImageIcon, Video, ArrowLeft } from 'lucide-react'

const STLViewer = dynamic(() => import('@/components/STLViewerWrapper'), { ssr: false })
import type { CatalogItem, FilamentMaterial, Filament, RequestPrinterView, PartAssembly } from '@/lib/types'
import { MATERIAL_LABELS, parseAssemblyMetadata, parseMeshMapping, parseTextMeshIndex, cleanDescription, serializeAssemblyMetadata, isPreviewFile, getDirectDownloadUrl, parseUrlRotation, parseUrlTranslation, COLOR_PRESETS, parseGcodeStats, serializeGcodeStats, parseDesignerMetadata } from '@/lib/types'
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
  'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

function updateUrlParameter(url: string, key: string, value: string | number): string {
  const [base, hash] = url.split('#')
  const isPart = hash?.includes('part')
  const isPreview = hash?.includes('preview')
  
  let cleanHash = hash || ''
  cleanHash = cleanHash.replace(/preview/g, '').replace(/part/g, '').replace(/^&+|&+$/g, '').replace(/&&+/g, '&')
  
  const params = new URLSearchParams(cleanHash)
  params.set(key, String(value))
  
  const parts: string[] = []
  if (isPreview) parts.push('preview')
  else if (isPart) parts.push('part')
  
  const paramsStr = params.toString()
  if (paramsStr) parts.push(paramsStr)
  
  return `${base}#${parts.join('&')}`
}

function updateUrlRotation(url: string, axis: 'rx' | 'ry' | 'rz', angle: number): string {
  return updateUrlParameter(url, axis, angle)
}

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
  // G-code baseline stats (serialized to description comments)
  weight_g: number | null
  print_hours: number | null
  // Designer & Licensing
  designer_name: string
  designer_tip_url: string
  license_type: string
  commercial_allowed: boolean
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
  weight_g: null,
  print_hours: null,
  designer_name: '',
  designer_tip_url: '',
  license_type: 'CC BY 4.0 (Default)',
  commercial_allowed: true,
}

function itemToForm(item: CatalogItem): FormState {
  const prices: Record<string, string> = {}
  for (const [mat, price] of Object.entries(item.material_prices ?? {})) {
    prices[mat] = String(price)
  }
  const stats = parseGcodeStats(item.description)
  const designer = parseDesignerMetadata(item.description)
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
    weight_g: stats?.weight_g ?? null,
    print_hours: stats?.hours ?? null,
    designer_name: designer?.name ?? '',
    designer_tip_url: designer?.tipUrl ?? '',
    license_type: designer?.license ?? 'CC BY 4.0 (Default)',
    commercial_allowed: designer?.commercialAllowed ?? true,
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
  const [editingMeshMapping, setEditingMeshMapping] = useState<Record<number, number>>({})
  const [editingTextMeshIndex, setEditingTextMeshIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [checkingLicense, setCheckingLicense] = useState(false)
  const [licenseCheckError, setLicenseCheckError] = useState('')

  const handleVerifyLicense = async () => {
    if (!form.model_url) return
    setCheckingLicense(true)
    setLicenseCheckError('')
    try {
      const res = await fetch(`/api/parse-license?url=${encodeURIComponent(form.model_url)}`)
      if (!res.ok) {
        setLicenseCheckError('Anti-scraping protection active. Please enter details manually below.')
        return
      }
      const data = await res.json()
      if (data.fallback) {
        setLicenseCheckError(data.error || 'Website security block. Please fill in details manually.')
        setForm(prev => ({
          ...prev,
          designer_name: prev.designer_name || 'Original Creator',
          license_type: prev.license_type || 'CC BY (Attribution)',
        }))
        return
      }

      setForm(prev => ({
        ...prev,
        designer_name: data.designer || prev.designer_name || 'Original Creator',
        license_type: data.license || prev.license_type,
        commercial_allowed: data.commercialAllowed ?? true,
      }))
      if (data.title && !form.name) {
        setForm(prev => ({ ...prev, name: data.title }))
      }
    } catch (err: any) {
      console.error(err)
      setLicenseCheckError(err.message || 'Could not verify. Please enter details manually.')
    } finally {
      setCheckingLicense(false)
    }
  }

  function openNew() { setForm(BLANK); setEditing('new'); setEditingMeshMapping({}); setEditingTextMeshIndex(null); setError('') }
  function openEdit(item: CatalogItem) { setForm(itemToForm(item)); setEditing(item.id); setEditingMeshMapping(parseMeshMapping(item.description)); setEditingTextMeshIndex(parseTextMeshIndex(item.description)); setError('') }
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

    // Preserve original assembly metadata if editing, or default to empty
    const originalItem = editing !== 'new' ? items.find(i => i.id === editing) : null
    const assemblyOffsets = originalItem ? parseAssemblyMetadata(originalItem.description) : []

    let finalDescription = serializeAssemblyMetadata(
      form.description.trim(),
      assemblyOffsets,
      editingMeshMapping,
      undefined,
      editingTextMeshIndex
    )

    if (form.weight_g !== null && form.print_hours !== null) {
      finalDescription += `\n${serializeGcodeStats({ weight_g: form.weight_g, hours: form.print_hours })}`
    }

    const designerMeta = {
      name: form.designer_name.trim(),
      tipUrl: form.designer_tip_url.trim(),
      license: form.license_type,
      commercialAllowed: form.commercial_allowed,
    }
    if (designerMeta.name || designerMeta.tipUrl || designerMeta.license) {
      finalDescription += `\n\n<!-- DESIGNER_METADATA: ${JSON.stringify(designerMeta)} -->`
    }

    const data = {
      name: form.name.trim(),
      description: finalDescription,
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
              {item.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{cleanDescription(item.description)}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {item.allow_custom_text && <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-600">Custom text</span>}
                {item.allow_resize && <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-600">Resize</span>}
              </div>
            </div>
          </div>
        </div>
    )
  }

  if (editing !== null) {
    const isNew = editing === 'new'
    const title = isNew ? 'Add Product' : `Edit Product: ${form.name || 'Product Details'}`

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={closeForm}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Products
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 space-y-6 animate-slide-up">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-400 mt-1">Configure your product's pricing, 3D model orientation, text engraving, and color settings.</p>
          </div>
          
          <CatalogForm
            form={form} set={set}
            toggleAvailableMaterial={toggleAvailableMaterial}
            setMaterialPrice={setMaterialPrice}
            filaments={filaments}
            printer={printer}
            meshMapping={editingMeshMapping}
            setMeshMapping={setEditingMeshMapping}
            textMeshIndex={editingTextMeshIndex}
            setTextMeshIndex={setEditingTextMeshIndex}
            onSave={handleSave} onCancel={closeForm}
            isPending={isPending} error={error}
            checkingLicense={checkingLicense}
            licenseCheckError={licenseCheckError}
            handleVerifyLicense={handleVerifyLicense}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center animate-fade-in">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupItems.map((item) => renderItem(item))}
          </div>
        </div>
      ))}

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
  onUsePrice: (price: string, weight: number | null, hours: number | null) => void
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
              onClick={() => { onUsePrice(breakdown.total.toFixed(2), totalWeight, totalHours); reset(); setOpen(false) }}
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
  filaments, printer, meshMapping, setMeshMapping,
  textMeshIndex, setTextMeshIndex,
  onSave, onCancel, isPending, error,
  checkingLicense, licenseCheckError, handleVerifyLicense,
}: {
  form: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  toggleAvailableMaterial: (mat: string) => void
  setMaterialPrice: (mat: string, price: string) => void
  filaments: Filament[]
  printer: RequestPrinterView
  meshMapping: Record<number, number>
  setMeshMapping: React.Dispatch<React.SetStateAction<Record<number, number>>>
  textMeshIndex: number | null
  setTextMeshIndex: React.Dispatch<React.SetStateAction<number | null>>
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string
  checkingLicense: boolean
  licenseCheckError: string
  handleVerifyLicense: () => Promise<void>
}) {
  const previewUrl = form.stl_urls.find(url => isPreviewFile(url))
  const [previewMeshes, setPreviewMeshes] = useState<string[]>([])
  const [hoveredMeshIdx, setHoveredMeshIdx] = useState<number | undefined>(undefined)
  
  useEffect(() => {
    setPreviewMeshes([])
  }, [previewUrl])
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

  const render3DUpload = () => {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">3D model files for preview (optional)</label>
          <p className="mb-2 text-[11px] text-slate-400">Upload .stl or .3mf files — customers can spin and view the model before ordering.</p>
        </div>
        {form.stl_urls.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {form.stl_urls.map((url, i) => {
              const isPreview = isPreviewFile(url)
              const rot = parseUrlRotation(url)
              let filename = url.split('/').pop()?.split('?')[0].split('#')[0] ?? `File ${i + 1}`
              if (url.includes('drive.google.com')) {
                filename = `Google Drive File (${i + 1})`
              } else if (url.includes('dropbox.com')) {
                filename = `Dropbox File (${i + 1})`
              } else {
                filename = filename.replace(/^\d+-/, '') // clean date prefix
              }
              return (
                <div key={url} className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileBox className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                    <span className="flex-1 truncate text-xs text-slate-600 font-medium">{filename}</span>
                    {isPreview ? (
                      <button
                        type="button"
                        onClick={() => {
                          const nextUrls = [...form.stl_urls]
                          const cleanUrl = url.replace(/#part/g, '').replace(/#preview/g, '')
                          nextUrls[i] = cleanUrl + '#part'
                          set('stl_urls', nextUrls)
                        }}
                        className="rounded bg-orange-100 hover:bg-orange-200 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 transition"
                        title="Click to mark as Printable Part"
                      >
                        Preview
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const nextUrls = [...form.stl_urls]
                          const cleanUrl = url.replace(/#part/g, '').replace(/#preview/g, '')
                          nextUrls[i] = cleanUrl + '#preview'
                          set('stl_urls', nextUrls)
                        }}
                        className="rounded bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-655 transition"
                        title="Click to mark as Assembled Preview"
                      >
                        Printable Part
                      </button>
                    )}
                    <button type="button" onClick={() => set('stl_urls', form.stl_urls.filter((_, idx) => idx !== i))}
                      className="text-slate-300 hover:text-red-400 transition"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-1.5 text-[10px]">
                    <span className="font-semibold text-slate-400">Rotate preview:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextUrls = [...form.stl_urls]
                        const nextVal = (rot.rx + 90) % 360
                        nextUrls[i] = updateUrlRotation(url, 'rx', nextVal)
                        set('stl_urls', nextUrls)
                      }}
                      className="rounded bg-slate-50 border border-slate-200 px-2 py-0.5 font-mono font-medium text-slate-650 hover:border-orange-200 hover:bg-orange-50/20 transition active:scale-95"
                      title="Rotate 90 degrees around X-axis"
                    >
                      X: {rot.rx}°
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextUrls = [...form.stl_urls]
                        const nextVal = (rot.ry + 90) % 360
                        nextUrls[i] = updateUrlRotation(url, 'ry', nextVal)
                        set('stl_urls', nextUrls)
                      }}
                      className="rounded bg-slate-50 border border-slate-200 px-2 py-0.5 font-mono font-medium text-slate-650 hover:border-orange-200 hover:bg-orange-50/20 transition active:scale-95"
                      title="Rotate 90 degrees around Y-axis"
                    >
                      Y: {rot.ry}°
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextUrls = [...form.stl_urls]
                        const nextVal = (rot.rz + 90) % 360
                        nextUrls[i] = updateUrlRotation(url, 'rz', nextVal)
                        set('stl_urls', nextUrls)
                      }}
                      className="rounded bg-slate-50 border border-slate-200 px-2 py-0.5 font-mono font-medium text-slate-605 hover:border-orange-200 hover:bg-orange-50/20 transition active:scale-95"
                      title="Rotate 90 degrees around Z-axis"
                    >
                      Z: {rot.rz}°
                    </button>
                  </div>
                  
                  {/* Position offset controls */}
                  {(() => {
                    const trans = parseUrlTranslation(url)
                    return (
                      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-1.5 text-[10px]">
                        <span className="font-semibold text-slate-400">Position (mm):</span>
                        
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-medium">X:</span>
                          <input
                            type="number"
                            step="5"
                            value={trans.x}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              const nextUrls = [...form.stl_urls]
                              nextUrls[i] = updateUrlParameter(url, 'x', val)
                              set('stl_urls', nextUrls)
                            }}
                            className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center font-mono focus:border-orange-400 focus:outline-none"
                            title="X translation offset"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-medium">Y:</span>
                          <input
                            type="number"
                            step="5"
                            value={trans.y}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              const nextUrls = [...form.stl_urls]
                              nextUrls[i] = updateUrlParameter(url, 'y', val)
                              set('stl_urls', nextUrls)
                            }}
                            className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center font-mono focus:border-orange-400 focus:outline-none"
                            title="Y translation offset"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-medium">Z:</span>
                          <input
                            type="number"
                            step="5"
                            value={trans.z}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              const nextUrls = [...form.stl_urls]
                              nextUrls[i] = updateUrlParameter(url, 'z', val)
                              set('stl_urls', nextUrls)
                            }}
                            className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center font-mono focus:border-orange-400 focus:outline-none"
                            title="Z translation offset"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            let nextUrl = url
                            nextUrl = updateUrlParameter(nextUrl, 'x', 0)
                            nextUrl = updateUrlParameter(nextUrl, 'y', 0)
                            nextUrl = updateUrlParameter(nextUrl, 'z', 0)
                            const nextUrls = [...form.stl_urls]
                            nextUrls[i] = nextUrl
                            set('stl_urls', nextUrls)
                          }}
                          className="text-slate-400 hover:text-orange-500 hover:underline transition ml-auto font-medium"
                        >
                          Reset
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".stl,.3mf" multiple className="hidden" onChange={(e) => handleStlFiles(e.target.files)} />
        <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-500 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 transition w-full justify-center">
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

        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200/60 p-3.5 space-y-2">
          <p className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
            🧩 Configuring Multi-Part 3D Previews
          </p>
          <div className="space-y-2 text-[10px] text-slate-600 leading-relaxed text-left">
            <div className="flex gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 font-bold text-[9px]">1</span>
              <div>
                <strong className="text-slate-800 font-semibold">Upload individual printable parts:</strong> Upload separate <code>.stl</code> files for each part (e.g., <code>partA.slate</code>, <code>partB.stl</code>). This is required for printing, custom color selection, and auto-pricing.
              </div>
            </div>
            <div className="flex gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 font-bold text-[9px]">2</span>
              <div>
                <strong className="text-slate-800 font-semibold">Upload assembled preview model:</strong> Upload a single <code>.3mf</code> file showing how all parts fit together. Include <code>preview</code> or <code>assemble</code> in the name.
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderMeshMapping = () => {
    if (!previewUrl) return null
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm animate-fade-in">
        <div>
          <p className="text-xs font-semibold text-slate-700">🧩 Assembled Preview Mesh Mapping</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Link each mesh in the 3MF preview to the correct printable part.
          </p>
        </div>



        {previewMeshes.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
            <span>Scanning model parts inside 3D viewer…</span>
          </div>
        ) : (
          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
            {previewMeshes.map((meshName, meshIdx) => {
              const currentStlIdx = meshMapping[meshIdx] ?? ''
              const printableParts = form.stl_urls.filter(url => !isPreviewFile(url))
              const isHovered = hoveredMeshIdx === meshIdx
              return (
                <div key={meshIdx}
                  onMouseEnter={() => setHoveredMeshIdx(meshIdx)}
                  onMouseLeave={() => setHoveredMeshIdx(undefined)}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-2 transition-all duration-150 ${
                    isHovered 
                      ? 'border-orange-400 bg-orange-50/30 shadow-sm scale-[1.01]' 
                      : 'border-slate-100 bg-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-700 truncate">
                      {meshIdx + 1}. <span className="font-mono text-[10px] text-orange-600 bg-orange-50/50 px-1 py-0.5 rounded border border-orange-100/50 font-bold">{meshName}</span>
                    </p>
                  </div>
                  <select
                    value={currentStlIdx}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseInt(e.target.value)
                      setMeshMapping(prev => {
                        const next = { ...prev }
                        if (val === undefined) {
                          delete next[meshIdx]
                        } else {
                          next[meshIdx] = val
                        }
                        return next
                      })
                    }}
                    className="rounded bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-655 focus:border-orange-500 focus:outline-none transition min-w-[120px] max-w-[150px]"
                  >
                    <option value="">-- Match (Auto) --</option>
                    {printableParts.map((url, printableIdx) => {
                      const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${printableIdx + 1}`
                      return (
                        <option key={printableIdx} value={printableIdx}>
                          {filename}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div className="lg:col-span-7 space-y-5">
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
          onUsePrice={(price, weight, hours) => {
            set('base_price', price)
            set('weight_g', weight)
            set('print_hours', hours)
          }} />
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

      {/* ── Design link & Licensing ── */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Original design link (optional)</label>
        <div className="flex gap-2">
          <input
            value={form.model_url}
            onChange={(e) => set('model_url', e.target.value)}
            placeholder="https://www.makerworld.com/... or https://www.printables.com/..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-orange-500 focus:bg-white focus:outline-none transition"
          />
          <button
            type="button"
            onClick={handleVerifyLicense}
            disabled={checkingLicense || !form.model_url}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm active:scale-95 shrink-0"
          >
            {checkingLicense ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                <span>Checking...</span>
              </>
            ) : (
              <span>🔍 Check License</span>
            )}
          </button>
        </div>

        {/* License status card & inputs */}
        {form.model_url && (
          <div className={`mt-2 rounded-xl border p-3 space-y-3 text-xs ${
            form.commercial_allowed
              ? 'border-emerald-100 bg-emerald-50/10'
              : 'border-amber-100 bg-amber-50/10'
          }`}>
            <div className="flex justify-between items-center">
              <span className={`font-bold ${form.commercial_allowed ? 'text-emerald-700' : 'text-amber-800'}`}>
                {form.commercial_allowed ? '✅ Commercial Selling Allowed' : '⚠️ Non-Commercial License'}
              </span>
              <button
                type="button"
                onClick={() => set('commercial_allowed', !form.commercial_allowed)}
                className="text-[10px] text-slate-500 underline font-medium hover:text-slate-700"
              >
                Override: Toggle commercial permission
              </button>
            </div>
            <p className="text-slate-500 text-[10px] leading-relaxed">
              {form.commercial_allowed
                ? 'You can print and sell this model under its current license. crediting the designer is recommended.'
                : 'The designer has marked this model for Non-Commercial use. Ensure you have licensing permission or configure a Tip URL below to support them.'}
            </p>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/40">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Original Designer
                </label>
                <input
                  type="text"
                  value={form.designer_name}
                  onChange={(e) => set('designer_name', e.target.value)}
                  placeholder="Designer name"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 focus:border-orange-500 focus:outline-none transition text-xs"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  License Type
                </label>
                <select
                  value={form.license_type}
                  onChange={(e) => set('license_type', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:border-orange-500 focus:outline-none transition text-xs"
                >
                  <option value="CC BY (Attribution)">CC BY (Attribution)</option>
                  <option value="CC BY-SA (Attribution-ShareAlike)">CC BY-SA (ShareAlike)</option>
                  <option value="CC BY-ND (Attribution-NoDerivatives)">CC BY-ND (NoDerivs)</option>
                  <option value="CC BY-NC (Attribution-NonCommercial)">CC BY-NC (Non-Comm)</option>
                  <option value="CC BY-NC-SA (Attribution-NonCommercial-ShareAlike)">CC BY-NC-SA</option>
                  <option value="CC BY-NC-ND (Attribution-NonCommercial-NoDerivatives)">CC BY-NC-ND</option>
                  <option value="CC0 (Public Domain)">CC0 (Public Domain)</option>
                  <option value="Commercial License">Commercial License</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Designer Tip/Royalty Link (optional)
              </label>
              <input
                type="url"
                value={form.designer_tip_url}
                onChange={(e) => set('designer_tip_url', e.target.value)}
                placeholder="e.g. Patreon, Ko-fi, PayPal, MakerWorld URL"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 focus:border-orange-500 focus:outline-none transition text-xs"
              />
            </div>

            {licenseCheckError && (
              <p className="text-[10px] text-red-500 font-semibold mt-1">{licenseCheckError}</p>
            )}
          </div>
        )}
      </div>

      {/* 3D model upload section moved to right column */}

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
                        if (isPreviewFile(url)) return null
                        const printableIndex = form.stl_urls.filter((u, idx) => idx < i && !isPreviewFile(u)).length
                        const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${printableIndex + 1}`
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
                            <p className="text-[11px] font-semibold text-slate-650 truncate">{filename}</p>
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

                {/* Mesh mapping moved to right column */}
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
                <div className="mt-2 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Label shown to customer</label>
                    <input value={form.text_prompt} onChange={(e) => set('text_prompt', e.target.value)}
                      placeholder="e.g. Name to engrave, Custom message…" className={inputClass} />
                  </div>
                  {form.stl_urls.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">🎯 Text Engraving Target Part</label>
                      {(() => {
                        const previewUrls = form.stl_urls.filter(url => isPreviewFile(url))
                        const printableParts = form.stl_urls.filter(url => !isPreviewFile(url))
                        const hasPreview = previewUrls.length > 0
                        
                        if (hasPreview && previewMeshes.length > 0) {
                          return (
                            <select
                              value={textMeshIndex ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                                setTextMeshIndex(val)
                              }}
                              className={inputClass}
                            >
                              <option value="">Automatic (first mesh or matching name)</option>
                              {previewMeshes.map((meshName, idx) => (
                                <option key={idx} value={idx}>
                                  Assembled Mesh: {meshName}
                                </option>
                              ))}
                            </select>
                          )
                        } else if (printableParts.length > 1) {
                          return (
                            <select
                              value={textMeshIndex ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                                setTextMeshIndex(val)
                              }}
                              className={inputClass}
                            >
                              <option value="">Automatic (first part or matching name)</option>
                              {printableParts.map((url, idx) => {
                                const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${idx + 1}`
                                return (
                                  <option key={idx} value={idx}>
                                    Printable Part: {filename}
                                  </option>
                                )
                              })}
                            </select>
                          )
                        } else {
                          const partName = printableParts[0]?.split('/').pop()?.replace(/^\d+-/, '') || 'Single model part'
                          return (
                            <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 p-2 rounded-xl">
                              Automatically assigned to: <strong>{partName}</strong>
                            </p>
                          )
                        }
                      })()}
                    </div>
                  )}
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
      </div>

      {/* ── Right Column: 3D Preview, File list, Mesh Mapping ── */}
      <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6 h-fit">
        {form.stl_urls.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-700">Live 3D Preview</p>
            <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-900 shadow-inner flex items-center justify-center animate-fade-in" style={{ height: 280 }}>
              {(() => {
                const viewerColors = form.stl_urls.map(url => isPreviewFile(url) ? '#cccccc' : '#f97316')
                return (
                  <STLViewer
                    urls={form.stl_urls}
                    colors={viewerColors}
                    highlightMeshIndex={hoveredMeshIdx}
                    textMeshIndex={textMeshIndex}
                    customText={form.allow_custom_text ? (form.text_prompt.trim() || 'TEXT') : undefined}
                    onMeshNamesLoaded={setPreviewMeshes}
                    className="h-full w-full"
                  />
                )
              })()}
            </div>
            <p className="text-[10px] text-slate-400 text-center">Interactive preview: Drag to spin, scroll to zoom.</p>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
            <FileBox className="mx-auto mb-3 h-8 w-8 text-slate-350" />
            <p className="text-xs font-semibold text-slate-700">No 3D files uploaded</p>
            <p className="mt-1 text-[10px] text-slate-400 max-w-[240px] mx-auto">Upload .stl or .3mf files below or paste a Google Drive link to see the 3D preview here.</p>
          </div>
        )}

        {renderMeshMapping()}
        {render3DUpload()}
      </div>
    </div>
  )
}
