'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Package, ExternalLink, X } from 'lucide-react'
import type { CatalogItem, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import { createCatalogItem, updateCatalogItem, deleteCatalogItem } from '@/lib/actions'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

type FormState = {
  name: string
  description: string
  photo_url: string
  model_url: string
  allow_custom_text: boolean
  text_prompt: string
  allow_color_choice: boolean
  allow_resize: boolean
  resize_min_pct: number
  resize_max_pct: number
  allow_material_choice: boolean
  available_materials: string[]
  base_price: string
}

const BLANK: FormState = {
  name: '',
  description: '',
  photo_url: '',
  model_url: '',
  allow_custom_text: false,
  text_prompt: 'Text to add',
  allow_color_choice: true,
  allow_resize: false,
  resize_min_pct: 80,
  resize_max_pct: 150,
  allow_material_choice: false,
  available_materials: [],
  base_price: '',
}

function itemToForm(item: CatalogItem): FormState {
  return {
    name: item.name,
    description: item.description,
    photo_url: item.photo_url ?? '',
    model_url: item.model_url ?? '',
    allow_custom_text: item.allow_custom_text,
    text_prompt: item.text_prompt,
    allow_color_choice: item.allow_color_choice,
    allow_resize: item.allow_resize,
    resize_min_pct: item.resize_min_pct,
    resize_max_pct: item.resize_max_pct,
    allow_material_choice: item.allow_material_choice,
    available_materials: item.available_materials,
    base_price: item.base_price != null ? String(item.base_price) : '',
  }
}

export default function CatalogManager({
  initialItems,
  printerId,
  printerMaterials,
}: {
  initialItems: CatalogItem[]
  printerId: string
  printerMaterials: FilamentMaterial[]
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
      allow_custom_text: form.allow_custom_text,
      text_prompt: form.text_prompt.trim() || 'Text to add',
      allow_color_choice: form.allow_color_choice,
      allow_resize: form.allow_resize,
      resize_min_pct: form.resize_min_pct,
      resize_max_pct: form.resize_max_pct,
      allow_material_choice: form.allow_material_choice,
      available_materials: form.allow_material_choice ? form.available_materials : [],
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
          photo_url: data.photo_url,
          model_url: data.model_url,
          base_price: data.base_price,
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
                  {item.base_price && (
                    <p className="text-xs text-orange-600 font-medium">From RM {item.base_price.toFixed(2)}</p>
                  )}
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

// ── Shared form fields ────────────────────────────────────────────────────────

function CatalogForm({
  form,
  set,
  toggleMaterial,
  printerMaterials,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  form: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  toggleMaterial: (m: string) => void
  printerMaterials: FilamentMaterial[]
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string
}) {
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
