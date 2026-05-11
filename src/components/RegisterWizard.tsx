'use client'

import { useState } from 'react'
import type { PrintType, MaterialFeel, PrintSize } from '@/lib/types'
import { PRINT_TYPE_LABELS, PRINT_TYPE_DESCRIPTIONS, MATERIAL_LABELS, MATERIAL_DESCRIPTIONS, SIZE_LABELS } from '@/lib/types'
import { registerPrinter } from '@/lib/actions'

const PRINTER_MODELS = [
  'Bambu Lab X1C', 'Bambu Lab X1C AMS', 'Bambu Lab P1S', 'Bambu Lab P1S AMS',
  'Bambu Lab A1', 'Bambu Lab A1 Mini', 'Prusa MK4S', 'Prusa MK3S+', 'Prusa Mini+',
  'Creality Ender 3 V3', 'Creality K1C', 'Creality CR-10 Smart Pro',
  'AnkerMake M5C', 'Voron 2.4', 'Other',
]

const steps = ['Your Printer', 'Your Service', 'Review & Publish']

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

export default function RegisterWizard() {
  const [step, setStep] = useState(0)
  const [pending, setPending] = useState(false)
  const [publishError, setPublishError] = useState('')

  // Step 0 — Printer
  const [model, setModel] = useState('')
  const [printTypes, setPrintTypes] = useState<PrintType[]>([])
  const [materials, setMaterials] = useState<MaterialFeel[]>([])
  const [maxSize, setMaxSize] = useState<PrintSize | ''>('')

  // Step 1 — Service
  const [serviceName, setServiceName] = useState('')
  const [description, setDescription] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [turnaround, setTurnaround] = useState('')
  const [phone, setPhone] = useState('')

  function togglePrintType(t: PrintType) {
    setPrintTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  }
  function toggleMaterial(m: MaterialFeel) {
    setMaterials((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))
  }

  const step0Valid = model && printTypes.length > 0 && materials.length > 0 && maxSize
  const step1Valid = serviceName && priceMin && priceMax && turnaround && phone

  async function handlePublish() {
    if (!maxSize) return
    setPending(true)
    setPublishError('')
    const result = await registerPrinter({
      name: serviceName,
      description,
      printer_model: model,
      print_types: printTypes,
      materials,
      max_size: maxSize,
      price_min: Number(priceMin),
      price_max: Number(priceMax),
      turnaround,
      contact_phone: phone,
    })
    if (result?.error) {
      setPublishError(result.error)
      setPending(false)
    }
    // on success, registerPrinter redirects to /dashboard server-side
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                i < step
                  ? 'bg-green-500 text-white'
                  : i === step
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="h-px w-6 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Your Printer ── */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Printer model <span className="text-red-500">*</span>
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
            >
              <option value="">Select your printer...</option>
              {PRINTER_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              What can you print? <span className="text-red-500">*</span>
            </p>
            <p className="mb-3 text-xs text-slate-400">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {(['everyday', 'strong', 'colorful'] as PrintType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => togglePrintType(t)}
                  className={`rounded-xl border px-4 py-2.5 text-left transition ${
                    printTypes.includes(t)
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                  }`}
                >
                  <p className="text-sm font-medium">{PRINT_TYPE_LABELS[t]}</p>
                  <p className="text-xs text-slate-500">{PRINT_TYPE_DESCRIPTIONS[t]}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              Materials you have in stock <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {(['rigid', 'flexible', 'tough'] as MaterialFeel[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMaterial(m)}
                  className={`rounded-xl border px-4 py-2.5 text-left transition ${
                    materials.includes(m)
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                  }`}
                >
                  <p className="text-sm font-medium">{MATERIAL_LABELS[m]}</p>
                  <p className="text-xs text-slate-500">{MATERIAL_DESCRIPTIONS[m]}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              Largest thing you can print <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as PrintSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMaxSize(s)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                    maxSize === s
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                  }`}
                >
                  {SIZE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={!step0Valid}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      )}

      {/* ── Step 1: Your Service ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Service name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Dave's Print Station"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Short description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers what you specialise in..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Min price (RM) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="10"
                min="1"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Max price (RM) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="150"
                min="1"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Typical turnaround <span className="text-red-500">*</span>
            </label>
            <select
              value={turnaround}
              onChange={(e) => setTurnaround(e.target.value)}
              className={inputClass}
            >
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
              Review →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review & Publish ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Service name</span>
              <span className="font-medium text-slate-900">{serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Printer</span>
              <span className="font-medium text-slate-900">{model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Print types</span>
              <span className="font-medium text-slate-900">
                {printTypes.map((t) => PRINT_TYPE_LABELS[t]).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Max size</span>
              <span className="font-medium text-slate-900">{maxSize && SIZE_LABELS[maxSize]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Price range</span>
              <span className="font-medium text-slate-900">RM{priceMin}–RM{priceMax}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Turnaround</span>
              <span className="font-medium text-slate-900">{turnaround}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Your listing will go live immediately. You can edit it anytime from your dashboard.
          </p>

          {publishError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{publishError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
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
