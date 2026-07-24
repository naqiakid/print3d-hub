'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2, Plus, X, Check, Package, ChevronDown, ClipboardPaste, PackagePlus, Pipette } from 'lucide-react'
import type { Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS, MATERIAL_DESCRIPTIONS } from '@/lib/types'
import { createFilament, updateFilament, deleteFilament, restockFilament } from '@/lib/actions'
import SwatchColorPicker from '@/components/SwatchColorPicker'

const ALL_MATERIALS: FilamentMaterial[] = ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc']

const SWATCHES = [
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#F5F0E8', name: 'Natural' },
  { hex: '#D4D4D4', name: 'Light Gray' },
  { hex: '#737373', name: 'Gray' },
  { hex: '#1A1A1A', name: 'Black' },
  { hex: '#DC2626', name: 'Red' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#FACC15', name: 'Yellow' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#38BDF8', name: 'Sky Blue' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#F43F5E', name: 'Rose' },
  { hex: '#92400E', name: 'Brown' },
  { hex: '#D4A574', name: 'Beige' },
  { hex: '#C0C0C0', name: 'Silver' },
]

// ─── Product title parser ────────────────────────────────────
const KNOWN_BRANDS = [
  ['bambu lab', 'Bambu Lab'], ['bambu', 'Bambu Lab'],
  ['esun', 'eSUN'], ['creality', 'Creality'], ['sunlu', 'SUNLU'],
  ['polymaker', 'Polymaker'], ['hatchbox', 'Hatchbox'], ['prusament', 'Prusament'],
  ['elegoo', 'Elegoo'], ['overture', 'Overture'], ['anycubic', 'Anycubic'],
  ['flashforge', 'Flashforge'], ['tinmorry', 'Tinmorry'], ['jayo', 'Jayo'],
  ['kingroon', 'Kingroon'],
] as const

const COLOR_RULES: Array<{ keywords: string[]; name: string; hex: string }> = [
  { keywords: ['galaxy black', 'matte black', 'jet black'], name: 'Galaxy Black',   hex: '#1A1A2E' },
  { keywords: ['galaxy blue', 'space blue'],                name: 'Galaxy Blue',    hex: '#1E3A5F' },
  { keywords: ['marble'],                                   name: 'Marble White',   hex: '#E8E8E8' },
  { keywords: ['glow', 'luminous', 'fluorescent'],          name: 'Glow in Dark',   hex: '#C8F08F' },
  { keywords: ['transparent', 'clear', 'translucent'],      name: 'Natural',        hex: '#F5F0E8' },
  { keywords: ['natural', 'neutral'],                       name: 'Natural',        hex: '#F5F0E8' },
  { keywords: ['white'],                                    name: 'White',          hex: '#FFFFFF' },
  { keywords: ['black'],                                    name: 'Black',          hex: '#1A1A1A' },
  { keywords: ['red', 'crimson', 'scarlet'],                name: 'Red',            hex: '#DC2626' },
  { keywords: ['orange'],                                   name: 'Orange',         hex: '#F97316' },
  { keywords: ['yellow'],                                   name: 'Yellow',         hex: '#FACC15' },
  { keywords: ['lime', 'neon green'],                       name: 'Lime',           hex: '#84CC16' },
  { keywords: ['teal', 'cyan', 'aqua', 'turquoise'],        name: 'Teal',           hex: '#14B8A6' },
  { keywords: ['sky blue', 'light blue', 'baby blue'],      name: 'Sky Blue',       hex: '#38BDF8' },
  { keywords: ['navy'],                                     name: 'Blue',           hex: '#1E3A8A' },
  { keywords: ['green', 'olive'],                           name: 'Green',          hex: '#22C55E' },
  { keywords: ['blue', 'cobalt'],                           name: 'Blue',           hex: '#3B82F6' },
  { keywords: ['indigo'],                                   name: 'Indigo',         hex: '#6366F1' },
  { keywords: ['purple', 'violet', 'lavender'],             name: 'Purple',         hex: '#A855F7' },
  { keywords: ['pink', 'magenta', 'rose'],                  name: 'Pink',           hex: '#EC4899' },
  { keywords: ['brown', 'chocolate', 'coffee'],             name: 'Brown',          hex: '#92400E' },
  { keywords: ['beige', 'cream', 'skin'],                   name: 'Beige',          hex: '#D4A574' },
  { keywords: ['gold'],                                     name: 'Gold',           hex: '#FFD700' },
  { keywords: ['silver', 'metallic'],                       name: 'Silver',         hex: '#C0C0C0' },
  { keywords: ['grey', 'gray'],                             name: 'Gray',           hex: '#737373' },
]

type ParsedFilament = Pick<FormState, 'material' | 'brand' | 'color' | 'color_hex' | 'cost_per_kg'>

function parseProductTitle(title: string, priceRM: number): ParsedFilament {
  const t = title.toLowerCase()

  // Material (longest match first to avoid "pc" inside "petg-cf")
  let material: FilamentMaterial = 'pla'
  if (/\bpetg\b/.test(t))                         material = 'petg'
  else if (/\babs\b/.test(t))                      material = 'abs'
  else if (/\btpu\b|\btpe\b/.test(t))              material = 'tpu'
  else if (/\bnylon\b|\bpa[-\s]?\d+\b/.test(t))   material = 'nylon'
  else if (/\bpolycarbonate\b|\bpc\b/.test(t))     material = 'pc'

  // Weight → cost per kg
  let weightG = 1000
  const kgMatch = t.match(/(\d+(?:\.\d+)?)\s*kg/)
  const gMatch  = t.match(/(\d+)\s*g(?:ram)?\b/)
  if (kgMatch) weightG = parseFloat(kgMatch[1]) * 1000
  else if (gMatch) weightG = parseInt(gMatch[1])
  const cost_per_kg = priceRM > 0 ? String(Math.round((priceRM / weightG) * 1000)) : ''

  // Brand
  let brand = ''
  for (const [key, display] of KNOWN_BRANDS) {
    if (t.includes(key)) { brand = display; break }
  }

  // Color
  let color = ''
  let color_hex = '#888888'
  for (const rule of COLOR_RULES) {
    if (rule.keywords.some((k) => t.includes(k))) { color = rule.name; color_hex = rule.hex; break }
  }

  return { material, brand, color, color_hex, cost_per_kg }
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const BLANK_FORM = {
  material: 'pla' as FilamentMaterial,
  brand: '',
  color: '',
  color_hex: '#888888',
  cost_per_kg: '',
  in_stock: true,
  track_quantity: false,
  grams_total: '1000',
  grams_remaining: '1000',
  low_stock_threshold_g: '100',
}

type FormState = typeof BLANK_FORM

export default function FilamentManager({
  filaments: initial,
  ownerId: _ownerId,
}: {
  filaments: Filament[]
  ownerId: string
}) {
  const [filaments, setFilaments] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null) // filament id or 'new'
  const [form, setFormState] = useState<FormState>(BLANK_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [restocking, setRestocking] = useState<string | null>(null)
  const [restockAmount, setRestockAmount] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((f) => ({ ...f, [key]: value }))
  }

  function openNew() {
    setEditing('new')
    setFormState(BLANK_FORM)
    setError('')
  }

  function openEdit(f: Filament) {
    setEditing(f.id)
    setFormState({
      material: f.material,
      brand: f.brand,
      color: f.color,
      color_hex: f.color_hex,
      cost_per_kg: String(f.cost_per_kg),
      in_stock: f.in_stock,
      track_quantity: f.grams_remaining != null,
      grams_total: String(f.grams_total ?? 1000),
      grams_remaining: f.grams_remaining != null ? String(f.grams_remaining) : '1000',
      low_stock_threshold_g: String(f.low_stock_threshold_g ?? 100),
    })
    setError('')
  }

  function closeForm() {
    setEditing(null)
    setError('')
  }

  function handleSave() {
    if (!form.color.trim()) { setError('Color name is required.'); return }
    if (!form.cost_per_kg || Number(form.cost_per_kg) <= 0) { setError('Enter a valid cost per kg.'); return }
    setError('')

    const payload = {
      material: form.material,
      brand: form.brand,
      color: form.color,
      color_hex: form.color_hex,
      cost_per_kg: Number(form.cost_per_kg),
      in_stock: form.in_stock,
      grams_total: form.track_quantity ? Number(form.grams_total) || 1000 : null,
      grams_remaining: form.track_quantity ? Number(form.grams_remaining) || 0 : null,
      low_stock_threshold_g: Number(form.low_stock_threshold_g) || 100,
    }

    startTransition(async () => {
      const result =
        editing === 'new'
          ? await createFilament(payload)
          : await updateFilament(editing!, payload)

      if (result && 'error' in result) { setError(result.error); return }

      if (editing === 'new' && result) {
        // Use the real server-assigned id — a client-guessed id would break any
        // follow-up action (edit/delete) on this row before the next full page load.
        const newFilament: Filament = {
          ...payload,
          id: result.id,
          owner_id: _ownerId,
          created_at: new Date().toISOString(),
        }
        setFilaments((prev) => [...prev, newFilament])
      } else {
        setFilaments((prev) =>
          prev.map((f) => (f.id === editing ? { ...f, ...payload } : f)),
        )
      }
      closeForm()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteFilament(id)
      if (result?.error) { setError(result.error); return }
      setFilaments((prev) => prev.filter((f) => f.id !== id))
      setConfirmDelete(null)
    })
  }

  function handleRestock(f: Filament, grams: number) {
    if (!grams || grams <= 0) return
    startTransition(async () => {
      const result = await restockFilament(f.id, grams)
      if (result?.error) { setError(result.error); return }
      setFilaments((prev) =>
        prev.map((item) =>
          item.id === f.id
            ? {
                ...item,
                grams_remaining: (item.grams_remaining ?? 0) + grams,
                grams_total: item.grams_total ?? grams,
                in_stock: true,
              }
            : item,
        ),
      )
      setRestocking(null)
      setRestockAmount('')
    })
  }

  // Group by material
  const grouped = ALL_MATERIALS.reduce<Record<FilamentMaterial, Filament[]>>(
    (acc, m) => {
      acc[m] = filaments.filter((f) => f.material === m)
      return acc
    },
    {} as Record<FilamentMaterial, Filament[]>,
  )

  return (
    <div className="space-y-6">
      {filaments.length === 0 && editing !== 'new' && (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">No filaments added yet.</p>
          <p className="mt-1 text-xs text-slate-300">
            Add the filament rolls you have in stock — each entry defines material, colour, and cost for pricing.
          </p>
        </div>
      )}

      {/* Grouped list */}
      {ALL_MATERIALS.map((material) => {
        const items = grouped[material]
        if (items.length === 0) return null
        return (
          <div key={material}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {MATERIAL_LABELS[material]}
            </p>
            <div className="space-y-2">
              {items.map((f) => (
                <div key={f.id}>
                  {editing !== f.id ? (
                    <div className={`rounded-xl border bg-white p-4 shadow-sm ${f.in_stock ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        {/* Color swatch */}
                        <div
                          className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 shadow-sm"
                          style={{ backgroundColor: f.color_hex }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{f.color}</p>
                            {f.brand && (
                              <span className="text-xs text-slate-400">{f.brand}</span>
                            )}
                            {!f.in_stock && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                Out of stock
                              </span>
                            )}
                            {f.in_stock && f.grams_remaining != null && f.grams_remaining <= f.low_stock_threshold_g && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Low stock
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">RM {f.cost_per_kg}/kg</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {f.grams_remaining != null && (
                            <button
                              onClick={() => { setRestocking(restocking === f.id ? null : f.id); setRestockAmount('') }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition"
                              title="Restock"
                            >
                              <PackagePlus className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(f)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(f.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Quantity progress bar */}
                      {f.grams_remaining != null && (
                        <div className="mt-3 pl-11">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500">
                              {Math.round(f.grams_remaining)}g / {Math.round(f.grams_total ?? f.grams_remaining)}g left
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                f.grams_remaining <= f.low_stock_threshold_g
                                  ? 'bg-red-400'
                                  : f.grams_remaining <= (f.grams_total ?? f.grams_remaining) * 0.5
                                  ? 'bg-amber-400'
                                  : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.max(2, Math.min(100, (f.grams_remaining / ((f.grams_total ?? f.grams_remaining) || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Restock quick action */}
                      {restocking === f.id && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
                          {[250, 500, 1000].map((g) => (
                            <button
                              key={g}
                              onClick={() => handleRestock(f, g)}
                              disabled={isPending}
                              className="rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-100 transition disabled:opacity-50"
                            >
                              +{g}g
                            </button>
                          ))}
                          <input
                            type="number"
                            min="1"
                            value={restockAmount}
                            onChange={(e) => setRestockAmount(e.target.value)}
                            placeholder="Custom g"
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-orange-400 focus:outline-none"
                          />
                          <button
                            onClick={() => handleRestock(f, Number(restockAmount))}
                            disabled={isPending || !restockAmount}
                            className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600 transition disabled:opacity-50"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setRestocking(null)}
                            className="ml-auto text-slate-400 hover:text-slate-600 transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {confirmDelete === f.id && (
                        <div className="mt-3 flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm">
                          <span className="flex-1 text-red-700">Remove &quot;{f.color}&quot; {MATERIAL_LABELS[f.material]}?</span>
                          <button
                            onClick={() => handleDelete(f.id)}
                            disabled={isPending}
                            className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 transition disabled:opacity-50"
                          >
                            {isPending ? '...' : 'Remove'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white transition"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <FilamentForm
                      form={form}
                      set={set}
                      onSave={handleSave}
                      onCancel={closeForm}
                      isPending={isPending}
                      error={error}
                      title={`Edit ${MATERIAL_LABELS[f.material]}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* New form */}
      {editing === 'new' && (
        <FilamentForm
          form={form}
          set={set}
          onSave={handleSave}
          onCancel={closeForm}
          isPending={isPending}
          error={error}
          title="Add filament"
        />
      )}

      {/* Add button */}
      {editing === null && (
        <button
          onClick={openNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 py-3 text-sm font-medium text-orange-500 hover:bg-orange-50 transition"
        >
          <Plus className="h-4 w-4" /> Add filament
        </button>
      )}
    </div>
  )
}

// ─── Form ────────────────────────────────────────────────────

function FilamentForm({
  form, set, onSave, onCancel, isPending, error, title,
}: {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string
  title: string
}) {
  const [importOpen,  setImportOpen]  = useState(false)
  const [importTitle, setImportTitle] = useState('')
  const [importPrice, setImportPrice] = useState('')
  const [pickerOpen,  setPickerOpen]  = useState(false)

  function handleImport() {
    const parsed = parseProductTitle(importTitle, parseFloat(importPrice) || 0)
    for (const [k, v] of Object.entries(parsed)) {
      set(k as keyof FormState, v as FormState[keyof FormState])
    }
    setImportOpen(false)
    setImportTitle('')
    setImportPrice('')
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">{title}</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick import */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setImportOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm"
        >
          <span className="flex items-center gap-2 font-medium text-slate-600">
            <ClipboardPaste className="h-4 w-4 text-orange-400" />
            Import from product listing
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${importOpen ? 'rotate-180' : ''}`} />
        </button>

        {importOpen && (
          <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Paste product name (copy from Shopee or any store)
              </label>
              <textarea
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                rows={2}
                placeholder="e.g. Bambu Lab PLA Basic Filament 1.75mm 1kg White"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-500">Price you paid (RM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">RM</span>
                  <input
                    type="number"
                    value={importPrice}
                    onChange={(e) => setImportPrice(e.target.value)}
                    placeholder="55"
                    min="1"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleImport}
                disabled={!importTitle.trim()}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-40"
              >
                Fill form
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Extracts material, colour, brand, and cost per kg. Adjust anything afterwards.
            </p>
          </div>
        )}
      </div>

      {/* Material */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Material</label>
        <select
          value={form.material}
          onChange={(e) => set('material', e.target.value as FilamentMaterial)}
          className={inputClass}
        >
          {ALL_MATERIALS.map((m) => (
            <option key={m} value={m}>
              {MATERIAL_LABELS[m]} — {MATERIAL_DESCRIPTIONS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Color picker */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Colour</label>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((s) => {
            const selected = form.color_hex.toLowerCase() === s.hex.toLowerCase()
            const isLight = ['#FFFFFF', '#F5F0E8', '#D4D4D4', '#FACC15', '#84CC16', '#D4A574', '#C0C0C0'].includes(s.hex)
            return (
              <button
                key={s.hex}
                type="button"
                title={s.name}
                onClick={() => {
                  set('color_hex', s.hex)
                  if (!form.color.trim()) set('color', s.name)
                }}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  selected ? 'border-orange-500 scale-110 shadow-lg' : 'border-transparent hover:scale-105 hover:border-slate-300'
                }`}
                style={{ backgroundColor: s.hex }}
              >
                {selected && (
                  <svg className={`m-auto h-3.5 w-3.5 drop-shadow ${isLight ? 'text-slate-700' : 'text-white'}`} viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {/* Custom hex input */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-7 w-7 shrink-0 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: form.color_hex }} />
          <input
            type="text"
            value={form.color_hex}
            onChange={(e) => {
              const v = e.target.value
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set('color_hex', v)
            }}
            maxLength={7}
            placeholder="#888888"
            className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          <span className="text-xs text-slate-400">Custom hex</span>

          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-orange-600 transition"
          >
            <Pipette className="h-3.5 w-3.5" /> Pick from Swatch
          </button>
        </div>

        {pickerOpen && (
          <div className="mt-3">
            <SwatchColorPicker
              onPickColor={(hex, suggestedName) => {
                set('color_hex', hex)
                if (!form.color.trim()) {
                  set('color', suggestedName)
                }
                setPickerOpen(false)
              }}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Color name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Color name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.color}
          onChange={(e) => set('color', e.target.value)}
          placeholder="e.g. Matte Black, Galaxy Blue"
          className={inputClass}
        />
      </div>

      {/* Brand + Cost */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Brand</label>
          <input
            type="text"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            placeholder="e.g. Bambu, eSUN"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Cost per kg <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">RM</span>
            <input
              type="number"
              value={form.cost_per_kg}
              onChange={(e) => set('cost_per_kg', e.target.value)}
              placeholder="55"
              min="1"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      {/* In stock toggle */}
      <button
        type="button"
        onClick={() => set('in_stock', !form.in_stock)}
        className="flex items-center gap-3 text-sm"
      >
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
          form.in_stock ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
        }`}>
          {form.in_stock && <Check className="h-3 w-3 text-white" />}
        </div>
        <span className={form.in_stock ? 'text-slate-800 font-medium' : 'text-slate-500'}>
          Currently in stock
        </span>
      </button>

      {/* Quantity tracking */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.track_quantity}
            onChange={(e) => set('track_quantity', e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-orange-500"
          />
          <div>
            <span className="text-sm font-medium text-slate-800">Track remaining quantity</span>
            <p className="text-xs text-slate-400">
              Grams left are auto-deducted when a job using this filament is marked done, and this roll is flagged low/out of stock automatically.
            </p>
          </div>
        </label>

        {form.track_quantity && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Roll size (g)</label>
              <input
                type="number" min="1" value={form.grams_total}
                onChange={(e) => set('grams_total', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Remaining (g)</label>
              <input
                type="number" min="0" value={form.grams_remaining}
                onChange={(e) => set('grams_remaining', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Low stock below (g)</label>
              <input
                type="number" min="0" value={form.low_stock_threshold_g}
                onChange={(e) => set('low_stock_threshold_g', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isPending}
          className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save filament'}
        </button>
      </div>
    </div>
  )
}
