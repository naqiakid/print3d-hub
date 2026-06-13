'use client'

import { useState, useTransition } from 'react'
import { Check, Star, Pencil, Trash2, Plus, X } from 'lucide-react'
import type { PrintProfile } from '@/lib/types'
import { NOZZLE_OPTIONS, DEFAULT_INFILL } from '@/lib/pricing'
import { createProfile, updateProfile, deleteProfile } from '@/lib/actions'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const BLANK_FORM = {
  name: '',
  nozzle_mm: 0.4,
  infill_draft: DEFAULT_INFILL.draft,
  infill_standard: DEFAULT_INFILL.standard,
  infill_premium: DEFAULT_INFILL.premium,
  supports_available: true,
  ironing_available: false,
  color_change_available: false,
  pause_insert_available: false,
  fuzzy_skin_available: false,
  text_on_surface_available: false,
  is_default: false,
}

type FormState = typeof BLANK_FORM

export default function ProfileManager({
  profiles: initial,
  printerId,
}: {
  profiles: PrintProfile[]
  printerId: string
}) {
  const [profiles, setProfiles] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null) // profile id or 'new'
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function openNew() {
    setEditing('new')
    setForm({ ...BLANK_FORM, is_default: profiles.length === 0 })
    setError('')
  }

  function openEdit(p: PrintProfile) {
    setEditing(p.id)
    setForm({
      name: p.name,
      nozzle_mm: p.nozzle_mm,
      infill_draft: p.infill_draft,
      infill_standard: p.infill_standard,
      infill_premium: p.infill_premium,
      supports_available: p.supports_available,
      ironing_available: p.ironing_available,
      color_change_available: p.color_change_available,
      pause_insert_available: p.pause_insert_available,
      fuzzy_skin_available: p.fuzzy_skin_available,
      text_on_surface_available: p.text_on_surface_available,
      is_default: p.is_default,
    })
    setError('')
  }

  function closeForm() {
    setEditing(null)
    setError('')
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSave() {
    if (!form.name.trim()) { setError('Profile name is required.'); return }
    setError('')
    startTransition(async () => {
      const payload = { ...form, printer_id: printerId }
      const result =
        editing === 'new'
          ? await createProfile(payload)
          : await updateProfile(editing!, printerId, form)

      if (result?.error) { setError(result.error); return }

      // Optimistic update
      if (editing === 'new') {
        const newProfile: PrintProfile = {
          ...form,
          id: crypto.randomUUID(),
          printer_id: printerId,
          is_active: true,
          created_at: new Date().toISOString(),
        }
        setProfiles((prev) => {
          const updated = form.is_default
            ? prev.map((p) => ({ ...p, is_default: false }))
            : prev
          return [...updated, newProfile]
        })
      } else {
        setProfiles((prev) =>
          prev.map((p) => {
            if (form.is_default && p.id !== editing) return { ...p, is_default: false }
            if (p.id === editing) return { ...p, ...form }
            return p
          })
        )
      }
      closeForm()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProfile(id)
      if (result?.error) { setError(result.error); return }
      setProfiles((prev) => prev.filter((p) => p.id !== id))
      setConfirmDelete(null)
    })
  }

  const nozzleLabel = (mm: number) =>
    NOZZLE_OPTIONS.find((n) => n.value === mm)?.label ?? `${mm}mm`

  return (
    <div className="space-y-4">
      {/* Profile cards */}
      {profiles.length === 0 && editing !== 'new' && (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-400">No profiles yet.</p>
          <p className="mt-1 text-xs text-slate-300">Add your first print profile to enable automatic pricing.</p>
        </div>
      )}

      {profiles.map((p) => (
        <div key={p.id}>
          {/* Card */}
          {editing !== p.id && (
            <div className={`rounded-xl border bg-white p-4 shadow-sm ${p.is_default ? 'border-orange-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {p.is_default && <Star className="h-4 w-4 fill-orange-400 text-orange-400 shrink-0" />}
                  <div>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {nozzleLabel(p.nozzle_mm)} nozzle
                      &nbsp;·&nbsp;
                      Infill {p.infill_draft}% / {p.infill_standard}% / {p.infill_premium}%
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {[
                        { flag: p.supports_available,         label: 'Supports' },
                        { flag: p.ironing_available,          label: 'Ironing' },
                        { flag: p.color_change_available,     label: 'Color change' },
                        { flag: p.pause_insert_available,     label: 'Insert pause' },
                        { flag: p.fuzzy_skin_available,       label: 'Fuzzy skin' },
                        { flag: p.text_on_surface_available,  label: 'Text on surface' },
                      ].map(({ flag, label }) => (
                        <span key={label} className={flag ? 'text-green-600' : 'text-slate-300'}>
                          {flag ? '✓' : '✗'} {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(p.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Delete confirm */}
              {confirmDelete === p.id && (
                <div className="mt-3 flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm">
                  <span className="flex-1 text-red-700">Delete &quot;{p.name}&quot;?</span>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={isPending}
                    className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {isPending ? '...' : 'Delete'}
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
          )}

          {/* Inline edit form */}
          {editing === p.id && (
            <ProfileForm
              form={form}
              set={set}
              onSave={handleSave}
              onCancel={closeForm}
              isPending={isPending}
              error={error}
              title={`Edit "${p.name}"`}
            />
          )}
        </div>
      ))}

      {/* New profile form */}
      {editing === 'new' && (
        <ProfileForm
          form={form}
          set={set}
          onSave={handleSave}
          onCancel={closeForm}
          isPending={isPending}
          error={error}
          title="New profile"
        />
      )}

      {/* Add button */}
      {editing === null && (
        <button
          onClick={openNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 py-3 text-sm font-medium text-orange-500 hover:bg-orange-50 transition"
        >
          <Plus className="h-4 w-4" /> Add profile
        </button>
      )}
    </div>
  )
}

// ─── Shared form ────────────────────────────────────────────

function ProfileForm({
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
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">{title}</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Profile name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Standard, Fast, Ultra Detail"
          className={inputClass}
        />
      </div>

      {/* Nozzle size */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Nozzle size</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NOZZLE_OPTIONS.map((n) => (
            <button
              key={n.value}
              type="button"
              onClick={() => set('nozzle_mm', n.value)}
              className={`rounded-xl border p-3 text-left transition ${
                form.nozzle_mm === n.value
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
              }`}
            >
              <p className="text-sm font-semibold">{n.label}</p>
              <p className={`text-xs ${form.nozzle_mm === n.value ? 'text-orange-100' : 'text-slate-400'}`}>
                {n.sublabel}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Infill per quality */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Infill % per quality level
        </label>
        <p className="mb-3 text-xs text-slate-400">
          More infill = stronger + heavier = higher cost. Defaults are 15 / 25 / 40.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'infill_draft' as const,    label: 'Draft',    hint: 'prototypes' },
            { key: 'infill_standard' as const, label: 'Standard', hint: 'most jobs' },
            { key: 'infill_premium' as const,  label: 'Premium',  hint: 'high strength' },
          ]).map(({ key, label, hint }) => (
            <div key={key}>
              <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>
              <p className="mb-1 text-xs text-slate-400">{hint}</p>
              <div className="relative">
                <input
                  type="number"
                  value={form[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                  min={5}
                  max={100}
                  className={`${inputClass} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Add-ons this profile supports
        </label>
        <div className="flex flex-wrap gap-3">
          {([
            { key: 'supports_available'        as const, label: 'Support structures', desc: 'For overhangs & bridges' },
            { key: 'ironing_available'         as const, label: 'Ironing',            desc: 'Smooth top surface (+15% time)' },
            { key: 'color_change_available'    as const, label: 'Color change',       desc: 'Pause to swap filament color' },
            { key: 'pause_insert_available'    as const, label: 'Embedded insert',    desc: 'Pause to press-fit nuts or magnets' },
            { key: 'fuzzy_skin_available'      as const, label: 'Fuzzy skin',         desc: 'Textured outer surface (+5% time)' },
            { key: 'text_on_surface_available' as const, label: 'Text on surface',    desc: 'Emboss/engrave text via slicer' },
          ]).map(({ key, label, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => set(key, !form[key])}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition ${
                form[key]
                  ? 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
              }`}
            >
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                form[key] ? 'border-orange-500 bg-orange-500' : 'border-slate-300'
              }`}>
                {form[key] && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs opacity-70">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Default toggle */}
      <button
        type="button"
        onClick={() => set('is_default', !form.is_default)}
        className="flex items-center gap-3 text-sm"
      >
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
          form.is_default ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
        }`}>
          {form.is_default && <Check className="h-3 w-3 text-white" />}
        </div>
        <span className={form.is_default ? 'text-slate-800 font-medium' : 'text-slate-500'}>
          Set as default profile
        </span>
        <span className="text-xs text-slate-400">(shown first to customers)</span>
      </button>

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
          {isPending ? 'Saving...' : 'Save profile'}
        </button>
      </div>
    </div>
  )
}
