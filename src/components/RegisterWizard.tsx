'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { PrintType, MaterialFeel, FilamentCosts } from '@/lib/types'
import { PRINT_TYPE_LABELS, MATERIAL_LABELS, MATERIAL_DESCRIPTIONS, SIZE_LABELS } from '@/lib/types'
import { PRINTER_MODELS, BRANDS, type PrinterModelPreset } from '@/lib/printer-models'
import {
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_GRAMS_PER_ROLL,
  DEFAULT_MARKUP_PERCENT,
  calculatePriceRange,
} from '@/lib/pricing'
import { registerPrinter } from '@/lib/actions'

const steps = ['Pick Printer', 'Cost Setup', 'Your Service', 'Review & Publish']

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

export default function RegisterWizard() {
  const [step, setStep] = useState(0)
  const [pending, setPending] = useState(false)
  const [publishError, setPublishError] = useState('')

  // Step 0 — Printer selection + spec confirmation
  const [selectedPreset, setSelectedPreset] = useState<PrinterModelPreset | null>(null)
  const [activeBrand, setActiveBrand] = useState(BRANDS[0])
  const [printTypes, setPrintTypes] = useState<PrintType[]>([])
  const [materials, setMaterials] = useState<MaterialFeel[]>([])

  // Step 1 — Cost Setup
  const [filamentCosts, setFilamentCosts] = useState<Record<MaterialFeel, string>>({
    rigid: '',
    flexible: '',
    tough: '',
  })
  const [gramsPerRoll, setGramsPerRoll] = useState(String(DEFAULT_GRAMS_PER_ROLL))
  const [electricityRate, setElectricityRate] = useState(String(DEFAULT_ELECTRICITY_RATE))
  const [markupPercent, setMarkupPercent] = useState(String(DEFAULT_MARKUP_PERCENT))

  // Step 2 — Service
  const [serviceName, setServiceName] = useState('')
  const [description, setDescription] = useState('')
  const [turnaround, setTurnaround] = useState('')
  const [phone, setPhone] = useState('')

  function selectPreset(preset: PrinterModelPreset) {
    setSelectedPreset(preset)
    setPrintTypes([...preset.print_types])
    setMaterials([...preset.materials])
  }

  function togglePrintType(t: PrintType) {
    setPrintTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  }

  function toggleMaterial(m: MaterialFeel) {
    setMaterials((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))
  }

  const step0Valid = selectedPreset && printTypes.length > 0 && materials.length > 0

  const step1Valid =
    materials.every((m) => Number(filamentCosts[m]) > 0) &&
    Number(gramsPerRoll) > 0 &&
    Number(electricityRate) > 0

  const step2Valid = serviceName && turnaround && phone

  function buildFilamentCosts(): FilamentCosts {
    const costs: FilamentCosts = {}
    for (const m of materials) {
      const v = Number(filamentCosts[m])
      if (v > 0) costs[m] = v
    }
    return costs
  }

  function liveRange() {
    if (!selectedPreset || !step1Valid) return null
    return calculatePriceRange({
      materials,
      filament_costs: buildFilamentCosts(),
      power_watts: selectedPreset.power_watts,
      grams_per_roll: Number(gramsPerRoll),
      electricity_rate: Number(electricityRate),
      markup_percent: Number(markupPercent),
    })
  }

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
      materials,
      max_size: selectedPreset.max_size,
      turnaround,
      contact_phone: phone,
      power_watts: selectedPreset.power_watts,
      filament_costs: buildFilamentCosts(),
      grams_per_roll: Number(gramsPerRoll),
      electricity_rate: Number(electricityRate),
      markup_percent: Number(markupPercent),
    })
    if (result?.error) {
      setPublishError(result.error)
      setPending(false)
    }
  }

  const range = liveRange()

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
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
            {i < steps.length - 1 && <div className="h-px w-6 bg-slate-200" />}
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
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedPreset.brand} {selectedPreset.name} — confirm what you offer
                </p>
                <span className="text-xs text-slate-400">
                  Max {SIZE_LABELS[selectedPreset.max_size]}
                </span>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">Print types</p>
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

              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">Materials you have in stock</p>
                <div className="flex flex-wrap gap-2">
                  {(['rigid', 'flexible', 'tough'] as MaterialFeel[]).map((m) => {
                    const included = selectedPreset.materials.includes(m)
                    const active = materials.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={!included}
                        onClick={() => included && toggleMaterial(m)}
                        className={`rounded-lg border px-3 py-1.5 text-left transition ${
                          active && included
                            ? 'border-orange-500 bg-orange-500 text-white'
                            : included
                            ? 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                        }`}
                      >
                        <p className="text-xs font-medium">{MATERIAL_LABELS[m]}</p>
                        <p className={`text-xs ${active && included ? 'text-orange-100' : 'text-slate-400'}`}>
                          {MATERIAL_DESCRIPTIONS[m]}
                        </p>
                      </button>
                    )
                  })}
                </div>
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

      {/* ── Step 1: Cost Setup ── */}
      {step === 1 && selectedPreset && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            Enter your filament costs so the platform can calculate fair, consistent prices for every job.
          </p>

          {/* Filament costs per material */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Filament cost per roll (RM)</p>
            {materials.map((m) => (
              <div key={m} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-slate-600">{MATERIAL_LABELS[m]}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">RM</span>
                  <input
                    type="number"
                    value={filamentCosts[m]}
                    onChange={(e) => setFilamentCosts((prev) => ({ ...prev, [m]: e.target.value }))}
                    placeholder="50"
                    min="1"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Grams per roll</label>
              <input
                type="number"
                value={gramsPerRoll}
                onChange={(e) => setGramsPerRoll(e.target.value)}
                placeholder="1000"
                min="1"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">Usually 1000g</p>
            </div>
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
              <p className="mt-1 text-xs text-slate-400">Per kWh</p>
            </div>
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
            <p className="mt-1 text-xs text-slate-400">Applied on top of filament + electricity costs</p>
          </div>

          {/* Live price preview */}
          <div className={`rounded-xl border p-4 ${range ? 'border-orange-100 bg-orange-50/50' : 'border-slate-100 bg-slate-50'}`}>
            <p className="text-xs font-medium text-slate-500 mb-1">Estimated price range for your listing</p>
            {range ? (
              <p className="text-2xl font-bold text-orange-600">
                RM {range.price_min} – RM {range.price_max}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Fill in costs above to see your price range</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Based on small draft → large premium print · {selectedPreset.power_watts}W · {gramsPerRoll}g roll
            </p>
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
              Review →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Publish ── */}
      {step === 3 && selectedPreset && (
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
              <span className="text-slate-500">Materials</span>
              <span className="font-medium text-slate-900">
                {materials.map((m) => MATERIAL_LABELS[m]).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Max size</span>
              <span className="font-medium text-slate-900">{SIZE_LABELS[selectedPreset.max_size]}</span>
            </div>
            {range && (
              <div className="flex justify-between">
                <span className="text-slate-500">Price range</span>
                <span className="font-medium text-orange-600">RM {range.price_min} – RM {range.price_max}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Turnaround</span>
              <span className="font-medium text-slate-900">{turnaround}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">WhatsApp</span>
              <span className="font-medium text-slate-900">{phone}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Your listing goes live immediately. Edit anytime from your dashboard.
          </p>

          {publishError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{publishError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
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
