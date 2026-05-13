'use client'

import { useState } from 'react'
import { Check, Star, Trash2, Plus, X } from 'lucide-react'
import type { PrintType } from '@/lib/types'
import { PRINT_TYPE_LABELS, SIZE_LABELS } from '@/lib/types'
import { PRINTER_MODELS, BRANDS, type PrinterModelPreset } from '@/lib/printer-models'
import {
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_MARKUP_PERCENT,
  DEFAULT_INFILL,
  NOZZLE_OPTIONS,
} from '@/lib/pricing'
import { registerPrinter } from '@/lib/actions'

const steps = ['Pick Printer', 'Costs', 'Your Service', 'Print Profiles', 'Review & Publish']

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

// ─── Profile types ──────────────────────────────────────────

type WizardProfile = {
  _id: string
  name: string
  nozzle_mm: number
  infill_draft: number
  infill_standard: number
  infill_premium: number
  supports_available: boolean
  ironing_available: boolean
  is_default: boolean
}

const BLANK_PROFILE: Omit<WizardProfile, '_id'> = {
  name: '',
  nozzle_mm: 0.4,
  infill_draft: DEFAULT_INFILL.draft,
  infill_standard: DEFAULT_INFILL.standard,
  infill_premium: DEFAULT_INFILL.premium,
  supports_available: true,
  ironing_available: false,
  is_default: false,
}

// ─── Wizard ─────────────────────────────────────────────────

export default function RegisterWizard() {
  const [step, setStep] = useState(0)
  const [pending, setPending] = useState(false)
  const [publishError, setPublishError] = useState('')

  // Step 0 — Pick Printer
  const [selectedPreset, setSelectedPreset] = useState<PrinterModelPreset | null>(null)
  const [activeBrand, setActiveBrand] = useState(BRANDS[0])
  const [printTypes, setPrintTypes] = useState<PrintType[]>([])

  // Step 1 — Costs
  const [electricityRate, setElectricityRate] = useState(String(DEFAULT_ELECTRICITY_RATE))
  const [markupPercent, setMarkupPercent] = useState(String(DEFAULT_MARKUP_PERCENT))

  // Step 2 — Service
  const [serviceName, setServiceName] = useState('')
  const [description, setDescription] = useState('')
  const [turnaround, setTurnaround] = useState('')
  const [phone, setPhone] = useState('')

  // Step 3 — Print Profiles
  const [profiles, setProfiles] = useState<WizardProfile[]>([])
  const [addingProfile, setAddingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<Omit<WizardProfile, '_id'>>(BLANK_PROFILE)
  const [profileError, setProfileError] = useState('')

  function selectPreset(preset: PrinterModelPreset) {
    setSelectedPreset(preset)
    setPrintTypes([...preset.print_types])
  }

  function togglePrintType(t: PrintType) {
    setPrintTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  }

  function setProfileField<K extends keyof Omit<WizardProfile, '_id'>>(
    key: K,
    value: Omit<WizardProfile, '_id'>[K],
  ) {
    setProfileForm((f) => ({ ...f, [key]: value }))
  }

  function openAddProfile() {
    setProfileForm({
      ...BLANK_PROFILE,
      is_default: profiles.length === 0,
    })
    setProfileError('')
    setAddingProfile(true)
  }

  function saveProfile() {
    if (!profileForm.name.trim()) {
      setProfileError('Profile name is required.')
      return
    }
    const newProfile: WizardProfile = {
      ...profileForm,
      _id: crypto.randomUUID(),
    }
    setProfiles((prev) => {
      const updated = profileForm.is_default
        ? prev.map((p) => ({ ...p, is_default: false }))
        : prev
      return [...updated, newProfile]
    })
    setAddingProfile(false)
    setProfileError('')
  }

  function removeProfile(id: string) {
    setProfiles((prev) => {
      const next = prev.filter((p) => p._id !== id)
      // if we removed the default, promote the first remaining
      const hadDefault = prev.find((p) => p._id === id)?.is_default
      if (hadDefault && next.length > 0) next[0].is_default = true
      return next
    })
  }

  // Validation
  const step0Valid = selectedPreset && printTypes.length > 0
  const step1Valid = Number(electricityRate) > 0
  const step2Valid = serviceName && turnaround && phone
  const step3Valid = profiles.length > 0 && !addingProfile

  async function handlePublish() {
    if (!selectedPreset) return
    setPending(true)
    setPublishError('')
    const result = await registerPrinter({
      name: serviceName,
      description,
      printer_model: `${selectedPreset.brand} ${selectedPreset.name}`,
      printer_model_id: selectedPreset.id,
      print_types: printTypes,
      max_size: selectedPreset.max_size,
      turnaround,
      contact_phone: phone,
      power_watts: selectedPreset.power_watts,
      electricity_rate: Number(electricityRate),
      markup_percent: Number(markupPercent),
      profiles: profiles.map((p) => ({
        name: p.name,
        nozzle_mm: p.nozzle_mm,
        infill_draft: p.infill_draft,
        infill_standard: p.infill_standard,
        infill_premium: p.infill_premium,
        supports_available: p.supports_available,
        ironing_available: p.ironing_available,
        is_default: p.is_default,
      })),
    })
    if (result?.error) {
      setPublishError(result.error)
      setPending(false)
    }
  }

  const nozzleLabel = (mm: number) =>
    NOZZLE_OPTIONS.find((n) => n.value === mm)?.label ?? `${mm}mm`

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-1.5 flex-wrap">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                i < step
                  ? 'bg-green-500 text-white'
                  : i === step
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="h-px w-4 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Pick Printer ── */}
      {step === 0 && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {BRANDS.map((brand) => (
              <button
                key={brand}
                onClick={() => setActiveBrand(brand)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeBrand === brand
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PRINTER_MODELS.filter((p) => p.brand === activeBrand).map((preset) => {
              const isSelected = selectedPreset?.id === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset)}
                  className={`rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                      : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{preset.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{preset.build_volume}</p>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {preset.print_types.map((t) => (
                      <span key={t} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                        {PRINT_TYPE_LABELS[t]}
                      </span>
                    ))}
                    {preset.note && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {preset.note}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedPreset && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedPreset.brand} {selectedPreset.name} — confirm print types
                </p>
                <span className="text-xs text-slate-400">
                  Max {SIZE_LABELS[selectedPreset.max_size]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['everyday', 'strong', 'colorful'] as PrintType[]).map((t) => {
                  const included = selectedPreset.print_types.includes(t)
                  const active = printTypes.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!included}
                      onClick={() => included && togglePrintType(t)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        active && included
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : included
                          ? 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                          : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {PRINT_TYPE_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => setStep(1)}
            disabled={!step0Valid}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      )}

      {/* ── Step 1: Costs ── */}
      {step === 1 && selectedPreset && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            Set your electricity cost and profit margin. You&apos;ll add your specific filaments
            and their costs from the Filaments section after publishing.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Electricity rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">RM</span>
                <input
                  type="number"
                  value={electricityRate}
                  onChange={(e) => setElectricityRate(e.target.value)}
                  placeholder="0.57"
                  step="0.01"
                  min="0.01"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">Per kWh (TNB default: 0.57)</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Overhead & profit %</label>
              <div className="relative">
                <input
                  type="number"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(e.target.value)}
                  placeholder="30"
                  min="0"
                  className={`${inputClass} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">On top of filament + electricity</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(0)}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Your Service ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Service name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Naqi's Print Station"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Short description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers what you specialise in..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Typical turnaround <span className="text-red-500">*</span>
            </label>
            <select value={turnaround} onChange={(e) => setTurnaround(e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              <option>Same day</option>
              <option>1–2 days</option>
              <option>2–3 days</option>
              <option>3–5 days</option>
              <option>1 week</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              WhatsApp number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+601X-XXXXXXX"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              Shared with customers when their print is ready for pickup
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!step2Valid}
              className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Print Profiles ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">
              Add at least one print profile. A profile defines nozzle size, infill settings,
              and available add-ons. You can add more from your dashboard later.
            </p>
          </div>

          {/* Added profiles */}
          {profiles.length === 0 && !addingProfile && (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
              <p className="text-sm text-slate-400">No profiles yet.</p>
              <p className="mt-1 text-xs text-slate-300">At least one profile is required to publish.</p>
            </div>
          )}

          {profiles.map((p) => (
            <div
              key={p._id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${p.is_default ? 'border-orange-200' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {p.is_default && <Star className="h-4 w-4 fill-orange-400 text-orange-400 shrink-0" />}
                  <div>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {nozzleLabel(p.nozzle_mm)} nozzle &nbsp;·&nbsp;
                      Infill {p.infill_draft}% / {p.infill_standard}% / {p.infill_premium}%
                    </p>
                    <div className="mt-1.5 flex gap-3 text-xs">
                      <span className={p.supports_available ? 'text-green-600' : 'text-slate-300'}>
                        {p.supports_available ? '✓' : '✗'} Supports
                      </span>
                      <span className={p.ironing_available ? 'text-green-600' : 'text-slate-300'}>
                        {p.ironing_available ? '✓' : '✗'} Ironing
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeProfile(p._id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Inline add form */}
          {addingProfile && (
            <WizardProfileForm
              form={profileForm}
              set={setProfileField}
              onSave={saveProfile}
              onCancel={() => { setAddingProfile(false); setProfileError('') }}
              error={profileError}
            />
          )}

          {!addingProfile && (
            <button
              onClick={openAddProfile}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 py-3 text-sm font-medium text-orange-500 hover:bg-orange-50 transition"
            >
              <Plus className="h-4 w-4" /> Add profile
            </button>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!step3Valid}
              className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Review & Publish ── */}
      {step === 4 && selectedPreset && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Service name</span>
              <span className="font-medium text-slate-900">{serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Printer</span>
              <span className="font-medium text-slate-900">{selectedPreset.brand} {selectedPreset.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Build volume</span>
              <span className="font-medium text-slate-900">{selectedPreset.build_volume}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Print types</span>
              <span className="font-medium text-slate-900">
                {printTypes.map((t) => PRINT_TYPE_LABELS[t]).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Max size</span>
              <span className="font-medium text-slate-900">{SIZE_LABELS[selectedPreset.max_size]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Turnaround</span>
              <span className="font-medium text-slate-900">{turnaround}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">WhatsApp</span>
              <span className="font-medium text-slate-900">{phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Markup</span>
              <span className="font-medium text-slate-900">{markupPercent}%</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-slate-500">Print profiles</span>
              <div className="text-right space-y-0.5">
                {profiles.map((p) => (
                  <p key={p._id} className="font-medium text-slate-900">
                    {p.name}{p.is_default ? ' ★' : ''}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Add your filament inventory from the <strong>Filaments</strong> section after publishing to enable live pricing.
          </p>

          {publishError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{publishError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ← Back
            </button>
            <button
              onClick={handlePublish}
              disabled={pending}
              className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
            >
              {pending ? 'Publishing...' : '🚀 Publish Listing'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inline profile form for wizard ─────────────────────────

function WizardProfileForm({
  form,
  set,
  onSave,
  onCancel,
  error,
}: {
  form: Omit<WizardProfile, '_id'>
  set: <K extends keyof Omit<WizardProfile, '_id'>>(key: K, value: Omit<WizardProfile, '_id'>[K]) => void
  onSave: () => void
  onCancel: () => void
  error: string
}) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">New profile</p>
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

      {/* Infill */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Infill % per quality level</label>
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
                  min={5} max={100}
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
        <label className="mb-2 block text-sm font-medium text-slate-700">Add-ons this profile supports</label>
        <div className="flex flex-wrap gap-3">
          {([
            { key: 'supports_available' as const, label: 'Support structures', desc: 'For overhangs & bridges' },
            { key: 'ironing_available' as const,  label: 'Ironing',            desc: 'Smooth top surface (+15% time)' },
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

      {/* Default */}
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
          className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
        >
          Add profile
        </button>
      </div>
    </div>
  )
}
