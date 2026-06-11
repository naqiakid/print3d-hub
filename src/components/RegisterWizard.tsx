'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { PrintType } from '@/lib/types'
import { PRINT_TYPE_LABELS, SIZE_LABELS } from '@/lib/types'
import { PRINTER_MODELS, BRANDS, type PrinterModelPreset } from '@/lib/printer-models'
import {
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_MARKUP_PERCENT,
} from '@/lib/pricing'
import { registerPrinter } from '@/lib/actions'
import { NOZZLE_SIZES, NOZZLE_HINTS, BED_TYPES, bedLabel } from '@/lib/equipment'

const steps = ['Pick Printer', 'Costs', 'Your Service', 'Printer Setup', 'Review & Publish']

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

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
  const [pickupAddress, setPickupAddress] = useState('')

  // Step 3 — Printer Setup
  const [nozzleSizes, setNozzleSizes] = useState<number[]>([0.4])
  const [bedTypes, setBedTypes] = useState<string[]>([])

  function selectPreset(preset: PrinterModelPreset) {
    setSelectedPreset(preset)
    setPrintTypes([...preset.print_types])
  }

  function togglePrintType(t: PrintType) {
    setPrintTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  }

  function toggleNozzle(size: number) {
    setNozzleSizes((prev) =>
      prev.includes(size)
        ? prev.length > 1 ? prev.filter((s) => s !== size) : prev
        : [...prev, size]
    )
  }

  function toggleBedType(value: string) {
    setBedTypes((prev) =>
      prev.includes(value) ? prev.filter((b) => b !== value) : [...prev, value]
    )
  }

  // Validation
  const step0Valid = selectedPreset && printTypes.length > 0
  const step1Valid = Number(electricityRate) > 0
  const step2Valid = serviceName && turnaround && phone
  const step3Valid = nozzleSizes.length > 0 && bedTypes.length > 0

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
      materials: selectedPreset.materials,
      max_size: selectedPreset.max_size,
      turnaround,
      contact_phone: phone,
      power_watts: selectedPreset.power_watts,
      electricity_rate: Number(electricityRate),
      markup_percent: Number(markupPercent),
      nozzle_sizes: nozzleSizes,
      bed_type: bedTypes,
      pickup_address: pickupAddress.trim() || undefined,
    })
    if (result?.error) {
      setPublishError(result.error)
      setPending(false)
    }
  }

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

          {/* Electricity — pre-filled, confirm only */}
          <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">Electricity rate</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Pre-filled with the Malaysian TNB domestic tariff
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-800">RM 0.516</p>
                <p className="text-xs text-green-600">per kWh</p>
              </div>
            </div>
            <details className="mt-3 border-t border-green-200 pt-3">
              <summary className="cursor-pointer text-xs text-green-600 hover:text-green-800">
                On a different rate? Click to change
              </summary>
              <div className="mt-2 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">RM</span>
                <input
                  type="number"
                  value={electricityRate}
                  onChange={(e) => setElectricityRate(e.target.value)}
                  step="0.01"
                  min="0.01"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Commercial/industrial users may have a different rate from TNB.
              </p>
            </details>
          </div>

          {/* Profit margin — the real decision */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Your profit margin <span className="text-red-500">*</span>
            </label>
            <p className="mb-3 text-xs text-slate-500">
              Added on top of your material and electricity costs. For example, if a job costs
              you RM 10 in filament + electricity, a 30% margin means you charge RM 13.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[20, 30, 40, 50].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setMarkupPercent(String(pct))}
                  className={`rounded-xl border py-2.5 text-center text-sm font-medium transition ${
                    markupPercent === String(pct)
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
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
            <p className="mt-1.5 text-xs text-slate-400">
              You can change this at any time from your dashboard.
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

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pickup address</label>
            <textarea
              rows={2}
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="e.g. No. 12, Jalan Ampang, 50450 Kuala Lumpur"
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-xs text-slate-400">
              Shown to customers so they know where to collect. You can add or update this later.
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

      {/* ── Step 3: Printer Setup ── */}
      {step === 3 && (
        <div className="space-y-6">

          {/* Nozzle sizes */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Available nozzle sizes <span className="text-red-500">*</span>
            </label>
            <p className="mb-3 text-xs text-slate-500">
              Select all the nozzle sizes you have installed or available to swap in.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {NOZZLE_SIZES.map((size) => {
                const selected = nozzleSizes.includes(size)
                const hint = NOZZLE_HINTS[size]
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleNozzle(size)}
                    className={`rounded-xl border p-3 text-center transition ${
                      selected
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                    }`}
                  >
                    <p className="text-sm font-bold">{size}mm</p>
                    <p className={`text-xs mt-0.5 ${selected ? 'text-orange-500' : 'text-slate-400'}`}>{hint}</p>
                    {selected && <div className="mt-1.5 mx-auto h-1.5 w-1.5 rounded-full bg-orange-500" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bed types */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Bed surfaces available <span className="text-red-500">*</span>
            </label>
            <p className="mb-3 text-xs text-slate-500">
              Select all the bed surfaces you have. Many printers ship with multiple plates.
            </p>
            <div className="space-y-2">
              {BED_TYPES.map((bed) => {
                const selected = bedTypes.includes(bed.value)
                return (
                  <button
                    key={bed.value}
                    type="button"
                    onClick={() => toggleBedType(bed.value)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      selected
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${selected ? 'text-orange-700' : 'text-slate-800'}`}>
                        {bed.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{bed.desc}</p>
                    </div>
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                      selected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
                    }`}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

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
            <div className="flex justify-between">
              <span className="text-slate-500">Nozzle sizes</span>
              <span className="font-medium text-slate-900">
                {nozzleSizes.sort((a, b) => a - b).map((s) => `${s}mm`).join(', ')}
              </span>
            </div>
            <div className="flex justify-between items-start gap-4">
              <span className="text-slate-500 shrink-0">Bed surfaces</span>
              <span className="font-medium text-slate-900 text-right">
                {bedTypes.map(bedLabel).join(', ')}
              </span>
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
