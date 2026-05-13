'use client'

import { useState, useCallback, lazy, Suspense } from 'react'
import { CheckCircle, Upload, X, Loader2 } from 'lucide-react'
import type { Printer, PrintProfile, Filament, PrintType, FilamentMaterial, PrintSize, PrintQuality } from '@/lib/types'
import {
  PRINT_TYPE_LABELS,
  PRINT_TYPE_DESCRIPTIONS,
  MATERIAL_LABELS,
  SIZE_LABELS,
  QUALITY_LABELS,
} from '@/lib/types'
import { submitRequest, sliceSTL } from '@/lib/actions'
import { calculateEstimate, formatRM, DEFAULT_INFILL } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'

const STLViewer = lazy(() => import('./STLViewer'))

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

type SliceResult = { weight_g: number; print_hours: number }

export default function RequestForm({
  printer,
  profiles,
  filaments,
}: {
  printer: Printer
  profiles: PrintProfile[]
  filaments: Filament[]
}) {
  const [requestId, setRequestId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const [printType, setPrintType] = useState<PrintType | ''>('')
  const [material, setMaterial] = useState<FilamentMaterial | ''>('')
  const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null)
  const [size, setSize] = useState<PrintSize | ''>('')
  const [quality, setQuality] = useState<PrintQuality | ''>('')
  const [supports, setSupports] = useState(false)

  // STL upload state
  const [stlFile, setStlFile] = useState<File | null>(null)
  const [stlUrl, setStlUrl] = useState<string | null>(null)
  const [slicing, setSlicing] = useState(false)
  const [sliceResult, setSliceResult] = useState<SliceResult | null>(null)
  const [sliceError, setSliceError] = useState('')

  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0] ?? null

  // Group in-stock filaments by material
  const filamentsByMaterial = filaments.reduce<Record<string, Filament[]>>((acc, f) => {
    if (!acc[f.material]) acc[f.material] = []
    acc[f.material].push(f)
    return acc
  }, {})

  const availableMaterials = Object.keys(filamentsByMaterial) as FilamentMaterial[]

  // Fall back to printer.materials if no filaments added yet
  const materialOptions: FilamentMaterial[] =
    availableMaterials.length > 0 ? availableMaterials : (printer.materials as FilamentMaterial[])

  function handleMaterialSelect(m: FilamentMaterial) {
    setMaterial(m)
    const colors = filamentsByMaterial[m] ?? []
    setSelectedFilament(colors.length === 1 ? colors[0] : null)
  }

  const getInfill = useCallback(
    (q: PrintQuality) => {
      if (!defaultProfile) return DEFAULT_INFILL[q]
      return q === 'draft'
        ? defaultProfile.infill_draft
        : q === 'standard'
        ? defaultProfile.infill_standard
        : defaultProfile.infill_premium
    },
    [defaultProfile],
  )

  const handleStlSelect = useCallback(
    async (file: File) => {
      setStlFile(file)
      setSliceResult(null)
      setSliceError('')
      setSlicing(true)

      const supabase = createClient()
      const path = `anonymous/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('stl-files')
        .upload(path, file)

      if (uploadError || !uploadData) {
        setSliceError('Upload failed: ' + (uploadError?.message ?? 'unknown'))
        setSlicing(false)
        return
      }

      const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
      const publicUrl = urlData.publicUrl
      setStlUrl(publicUrl)

      const mat = material || 'pla'
      const nozzle = defaultProfile?.nozzle_mm ?? 0.4
      const infill = quality ? getInfill(quality as PrintQuality) : getInfill('standard')

      const result = await sliceSTL(publicUrl, mat, nozzle, infill)
      setSlicing(false)

      if ('error' in result) {
        setSliceError(
          result.error === 'Slicer service not configured'
            ? 'Live analysis unavailable — using size estimate.'
            : result.error,
        )
      } else {
        setSliceResult(result)
      }
    },
    [material, quality, defaultProfile, getInfill],
  )

  function clearStl() {
    setStlFile(null)
    setStlUrl(null)
    setSliceResult(null)
    setSliceError('')
  }

  // ── Price calculation ──────────────────────────────────────────
  const costPerKg =
    selectedFilament?.cost_per_kg ??
    (material && printer.filament_costs ? printer.filament_costs[material as FilamentMaterial] : undefined)

  const effectiveWeight = sliceResult
    ? sliceResult.weight_g * (supports ? 1.25 : 1)
    : null

  const effectiveHours = sliceResult
    ? sliceResult.print_hours * (supports ? 1.2 : 1)
    : null

  const slicerPrice =
    effectiveWeight && effectiveHours && costPerKg
      ? (() => {
          const filament_cost = (effectiveWeight / 1000) * costPerKg
          const electricity_cost =
            effectiveHours * ((printer.power_watts ?? 150) / 1000) * (printer.electricity_rate ?? 0.57)
          const base_cost = filament_cost + electricity_cost
          const suggested_price = Math.ceil(base_cost * (1 + (printer.markup_percent ?? 30) / 100))
          return { filament_cost, electricity_cost, base_cost, suggested_price, weight_g: effectiveWeight, hours: effectiveHours }
        })()
      : null

  const fallbackEstimate =
    !slicerPrice && material && size && quality && costPerKg
      ? calculateEstimate({
          size: size as PrintSize,
          quality: quality as PrintQuality,
          material: material as FilamentMaterial,
          power_watts: printer.power_watts ?? 150,
          cost_per_kg: costPerKg,
          electricity_rate: printer.electricity_rate ?? 0.57,
          markup_percent: printer.markup_percent ?? 30,
          nozzle_mm: defaultProfile?.nozzle_mm,
          custom_infill: quality ? getInfill(quality as PrintQuality) : undefined,
        })
      : null

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!printType || !material || !size || !quality) return
    setError('')
    setPending(true)

    const form = e.currentTarget
    const result = await submitRequest({
      printer_id: printer.id,
      customer_name: (form.elements.namedItem('name') as HTMLInputElement).value,
      customer_email: (form.elements.namedItem('email') as HTMLInputElement).value,
      customer_phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      print_type: printType,
      material,
      color: selectedFilament?.color ?? '',
      color_hex: selectedFilament?.color_hex ?? '#888888',
      supports,
      size,
      quality,
      deadline: (form.elements.namedItem('deadline') as HTMLInputElement).value,
      notes: (form.elements.namedItem('notes') as HTMLInputElement).value ?? '',
      stl_url: stlUrl,
      weight_g: slicerPrice?.weight_g ?? fallbackEstimate?.weight_g ?? null,
      print_hours: slicerPrice?.hours ?? fallbackEstimate?.hours ?? null,
    })

    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setRequestId(result.id)
  }

  // ── Success screen ─────────────────────────────────────────────
  if (requestId) {
    const trackingUrl = `/track/${requestId}`
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-900">Request sent!</h2>
        <p className="max-w-sm text-sm text-slate-600">
          <strong>{printer.name}</strong> will review your request and email you a quote
          within {printer.turnaround}.
        </p>
        <div className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
          <p className="text-xs font-medium text-slate-500 mb-1">Your tracking link — save this!</p>
          <a
            href={trackingUrl}
            className="text-sm font-medium text-orange-500 hover:text-orange-600 break-all"
          >
            {typeof window !== 'undefined' ? window.location.origin : ''}{trackingUrl}
          </a>
        </div>
        <a
          href={trackingUrl}
          className="mt-4 w-full rounded-xl bg-orange-500 py-3 text-center text-sm font-semibold text-white hover:bg-orange-600 transition"
        >
          Track your order →
        </a>
        <a href="/printers" className="mt-3 text-sm text-slate-400 hover:text-slate-600">
          Browse more printers
        </a>
      </div>
    )
  }

  const allSelected = printType && material && size && quality

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Contact info */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Your contact details</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-slate-600">
              Name <span className="text-red-500">*</span>
            </label>
            <input id="name" name="name" type="text" required placeholder="Ahmad Farid" className={inputClass} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-xs font-medium text-slate-600">
              WhatsApp / Phone <span className="text-red-500">*</span>
            </label>
            <input id="phone" name="phone" type="tel" required placeholder="+601X-XXXXXXX" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">
              Email <span className="text-red-500">*</span>
            </label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Description + STL */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">What do you want printed?</h3>
        <textarea
          name="description"
          required
          rows={3}
          placeholder="Describe what you need. e.g. A small phone stand for my desk, roughly 10cm tall..."
          className={`${inputClass} resize-none`}
        />
        {!stlFile ? (
          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50 transition">
            <Upload className="h-4 w-4 shrink-0" />
            <span>Upload STL for 3D preview &amp; auto-pricing <span className="text-slate-400">(optional)</span></span>
            <input type="file" accept=".stl" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStlSelect(f) }} />
          </label>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <Suspense fallback={<div className="flex h-48 items-center justify-center bg-slate-50 text-sm text-slate-400">Loading 3D viewer...</div>}>
                <STLViewer file={stlFile} />
              </Suspense>
              <button type="button" onClick={clearStl} className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-slate-500 hover:text-slate-900 shadow-sm">
                <X className="h-4 w-4" />
              </button>
            </div>
            {slicing && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing model...
              </div>
            )}
            {sliceResult && (
              <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-xs text-green-700">
                <span>~{sliceResult.weight_g}g filament</span>
                <span>·</span>
                <span>~{sliceResult.print_hours}h print time</span>
                {defaultProfile && <span className="text-green-500">({defaultProfile.nozzle_mm}mm nozzle)</span>}
              </div>
            )}
            {sliceError && <p className="text-xs text-slate-400">{sliceError}</p>}
          </div>
        )}
      </div>

      {/* Print type */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Print type <span className="text-red-500">*</span></h3>
        <p className="mb-3 text-xs text-slate-400">What kind of print do you need?</p>
        <div className="flex flex-wrap gap-2">
          {printer.print_types.map((type) => (
            <button key={type} type="button" onClick={() => setPrintType(type)}
              className={`rounded-xl border px-4 py-2.5 text-left transition ${printType === type ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
              <p className="text-sm font-medium">{PRINT_TYPE_LABELS[type]}</p>
              <p className="text-xs text-slate-500">{PRINT_TYPE_DESCRIPTIONS[type]}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Material */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Material <span className="text-red-500">*</span></h3>
        <p className="mb-3 text-xs text-slate-400">What material should it be printed in?</p>
        <div className="flex flex-wrap gap-2">
          {materialOptions.map((m) => {
            const colors = filamentsByMaterial[m] ?? []
            return (
              <button key={m} type="button" onClick={() => handleMaterialSelect(m)}
                className={`rounded-xl border px-4 py-2.5 text-left transition ${material === m ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
                <p className="text-sm font-medium">{MATERIAL_LABELS[m]}</p>
                {colors.length > 0 && (
                  <div className="mt-1 flex items-center gap-1">
                    {colors.slice(0, 5).map((f) => (
                      <span key={f.id} className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ background: f.color_hex }} title={f.color} />
                    ))}
                    {colors.length > 5 && <span className="text-xs text-slate-400">+{colors.length - 5}</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Color picker */}
      {material && (filamentsByMaterial[material]?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            Color <span className="text-red-500">*</span>
          </h3>
          <p className="mb-3 text-xs text-slate-400">Choose an available color</p>
          <div className="flex flex-wrap gap-2">
            {filamentsByMaterial[material].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFilament(f)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                  selectedFilament?.id === f.id
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                }`}
              >
                <span className="h-4 w-4 shrink-0 rounded-full border border-slate-200 shadow-sm" style={{ background: f.color_hex }} />
                <span>{f.color}</span>
                {f.brand && <span className="text-xs text-slate-400">{f.brand}</span>}
              </button>
            ))}
          </div>
          {!selectedFilament && (
            <p className="mt-1 text-xs text-red-400">Please select a color</p>
          )}
        </div>
      )}

      {/* Size + Quality */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Size <span className="text-red-500">*</span></h3>
          <p className="text-xs text-slate-400 mb-2">{sliceResult ? 'Inferred from your STL' : 'Approximate size'}</p>
          <div className="flex flex-col gap-2">
            {(['small', 'medium', 'large'] as PrintSize[]).map((s) => {
              const allowed = s === 'small' || (s === 'medium' && printer.max_size !== 'small') || (s === 'large' && printer.max_size === 'large')
              return (
                <button key={s} type="button" disabled={!allowed} onClick={() => setSize(s)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${size === s ? 'border-orange-500 bg-orange-50 text-orange-700' : allowed ? 'border-slate-200 bg-white text-slate-700 hover:border-orange-200' : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'}`}>
                  {SIZE_LABELS[s]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Quality <span className="text-red-500">*</span></h3>
          <p className="text-xs text-slate-400 mb-2">Surface finish &amp; infill density</p>
          <div className="flex flex-col gap-2">
            {(['draft', 'standard', 'premium'] as PrintQuality[]).map((q) => (
              <button key={q} type="button" onClick={() => setQuality(q)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${quality === q ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
                {QUALITY_LABELS[q]}
                <span className="ml-2 text-xs text-slate-400">{getInfill(q)}% infill</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Supports toggle */}
      {defaultProfile?.supports_available && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Support structures</p>
            <p className="text-xs text-slate-400">Required for overhangs &gt;45°. Adds ~25% filament &amp; 20% print time.</p>
          </div>
          <button
            type="button"
            onClick={() => setSupports((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${supports ? 'bg-orange-500' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${supports ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}

      {/* Price estimate */}
      {slicerPrice && allSelected && (
        <div className="rounded-xl border border-green-100 bg-green-50/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-medium text-slate-500">Estimated price (from your STL)</p>
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">accurate</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatRM(slicerPrice.suggested_price)}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500">
            <p>Filament: ~{slicerPrice.weight_g.toFixed(1)}g</p>
            <p>Cost: {formatRM(slicerPrice.filament_cost)}</p>
            <p>Print time: ~{slicerPrice.hours.toFixed(2)}h</p>
            <p>Power: {formatRM(slicerPrice.electricity_cost)}</p>
            {supports && <p className="col-span-2 text-amber-600">Includes support material</p>}
          </div>
          <p className="mt-2 text-xs text-slate-400">Final price set by the owner in their quote.</p>
        </div>
      )}

      {!slicerPrice && fallbackEstimate && (
        <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Estimated price</p>
          <p className="text-2xl font-bold text-orange-600">{formatRM(fallbackEstimate.suggested_price)}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500">
            <p>Filament: ~{fallbackEstimate.weight_g}g</p>
            <p>Cost: {formatRM(fallbackEstimate.filament_cost)}</p>
            <p>Print time: ~{fallbackEstimate.hours}h</p>
            <p>Power: {formatRM(fallbackEstimate.electricity_cost)}</p>
          </div>
          <p className="mt-2 text-xs text-slate-400">Upload an STL for a more accurate estimate.</p>
        </div>
      )}

      {/* Deadline + Notes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="deadline" className="mb-1 block text-xs font-medium text-slate-600">
            When do you need it? <span className="text-red-500">*</span>
          </label>
          <input id="deadline" name="deadline" type="date" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="notes" className="mb-1 block text-xs font-medium text-slate-600">
            Any other notes?
          </label>
          <input id="notes" name="notes" type="text" placeholder="Quantity, special requirements..." className={inputClass} />
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !allSelected || (material && (filamentsByMaterial[material]?.length ?? 0) > 0 && !selectedFilament) ? true : false}
        className="w-full rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Sending request...' : 'Send Request'}
      </button>
    </form>
  )
}
