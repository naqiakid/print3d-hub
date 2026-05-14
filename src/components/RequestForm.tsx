'use client'

import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { CheckCircle, Upload, X, Loader2 } from 'lucide-react'
import type { Printer, PrintProfile, Filament, PrintType, FilamentMaterial, PrintQuality } from '@/lib/types'
import { MATERIAL_LABELS, QUALITY_LABELS } from '@/lib/types'
import { submitRequest, sliceSTL } from '@/lib/actions'
import { formatRM } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'

const STLViewer = lazy(() => import('./STLViewer'))

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

type SliceResult = { weight_g: number; print_hours: number }

function inferPrintType(material: FilamentMaterial): PrintType {
  return ['abs', 'nylon', 'pc'].includes(material) ? 'strong' : 'everyday'
}

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
  const [submitError, setSubmitError] = useState('')

  // Step 1: STL upload
  const [stlFile, setStlFile] = useState<File | null>(null)
  const [stlUrl, setStlUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Step 2: Specs
  const [material, setMaterial] = useState<FilamentMaterial | ''>('')
  const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null)
  const [quality, setQuality] = useState<PrintQuality | ''>('')

  // Auto-slice state
  const [slicing, setSlicing] = useState(false)
  const [sliceResult, setSliceResult] = useState<SliceResult | null>(null)
  const [sliceError, setSliceError] = useState('')

  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0] ?? null

  // Group filaments by material
  const filamentsByMaterial = filaments.reduce<Record<string, Filament[]>>((acc, f) => {
    if (!acc[f.material]) acc[f.material] = []
    acc[f.material].push(f)
    return acc
  }, {})
  const materialOptions: FilamentMaterial[] =
    Object.keys(filamentsByMaterial).length > 0
      ? (Object.keys(filamentsByMaterial) as FilamentMaterial[])
      : (printer.materials as FilamentMaterial[])

  function handleMaterialSelect(m: FilamentMaterial) {
    setMaterial(m)
    const colors = filamentsByMaterial[m] ?? []
    setSelectedFilament(colors.length === 1 ? colors[0] : null)
    setSliceResult(null)
  }

  // Upload STL — only uploads, no slice yet
  const handleStlSelect = useCallback(async (file: File) => {
    setStlFile(file)
    setStlUrl(null)
    setSliceResult(null)
    setSliceError('')
    setUploadError('')
    setUploading(true)

    const supabase = createClient()
    const path = `anonymous/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { data: uploadData, error } = await supabase.storage
      .from('stl-files')
      .upload(path, file)

    setUploading(false)

    if (error || !uploadData) {
      setUploadError('Upload failed: ' + (error?.message ?? 'unknown'))
      return
    }

    const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
    setStlUrl(urlData.publicUrl)
  }, [])

  function clearStl() {
    setStlFile(null)
    setStlUrl(null)
    setSliceResult(null)
    setSliceError('')
    setUploadError('')
  }

  // Auto-trigger slice whenever stlUrl + material + quality are all set
  useEffect(() => {
    if (!stlUrl || !material || !quality) return

    setSlicing(true)
    setSliceResult(null)
    setSliceError('')

    const nozzle = defaultProfile?.nozzle_mm ?? 0.4
    const infill =
      quality === 'draft'
        ? (defaultProfile?.infill_draft ?? 15)
        : quality === 'standard'
        ? (defaultProfile?.infill_standard ?? 25)
        : (defaultProfile?.infill_premium ?? 40)

    sliceSTL(stlUrl, material, nozzle, infill).then((result) => {
      setSlicing(false)
      if ('error' in result) {
        setSliceError(result.error === 'Slicer service not configured'
          ? 'Price calculation unavailable — the owner will quote manually.'
          : `Could not calculate price: ${result.error}`)
      } else {
        setSliceResult(result)
      }
    })
  }, [stlUrl, material, quality, defaultProfile])

  // ── Price calculation ──────────────────────────────────────────
  const costPerKg =
    selectedFilament?.cost_per_kg ??
    (material && printer.filament_costs ? printer.filament_costs[material as FilamentMaterial] : undefined)

  const price = sliceResult && costPerKg
    ? (() => {
        const filament_cost = (sliceResult.weight_g / 1000) * costPerKg
        const electricity_cost =
          sliceResult.print_hours * ((printer.power_watts ?? 150) / 1000) * (printer.electricity_rate ?? 0.57)
        const base_cost = filament_cost + electricity_cost
        const suggested_price = Math.ceil(base_cost * (1 + (printer.markup_percent ?? 30) / 100))
        return { filament_cost, electricity_cost, base_cost, suggested_price }
      })()
    : null

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!stlUrl || !material || !quality) return
    setSubmitError('')
    setPending(true)

    const form = e.currentTarget
    const result = await submitRequest({
      printer_id: printer.id,
      customer_name: (form.elements.namedItem('name') as HTMLInputElement).value,
      customer_email: (form.elements.namedItem('email') as HTMLInputElement).value,
      customer_phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      print_type: inferPrintType(material as FilamentMaterial),
      material: material as FilamentMaterial,
      color: selectedFilament?.color ?? '',
      color_hex: selectedFilament?.color_hex ?? '#888888',
      supports: false,
      size: 'medium',
      quality: quality as PrintQuality,
      deadline: (form.elements.namedItem('deadline') as HTMLInputElement).value,
      notes: (form.elements.namedItem('notes') as HTMLInputElement)?.value ?? '',
      stl_url: stlUrl,
      weight_g: sliceResult?.weight_g ?? null,
      print_hours: sliceResult?.print_hours ?? null,
      profile_id: defaultProfile?.id ?? null,
      selected_addons: [],
    })

    setPending(false)
    if ('error' in result) {
      setSubmitError(result.error)
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
          <a href={trackingUrl} className="text-sm font-medium text-orange-500 hover:text-orange-600 break-all">
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

  const hasColorChoice = material && (filamentsByMaterial[material]?.length ?? 0) > 1
  const colorRequired = hasColorChoice && !selectedFilament
  const canSubmit = !!(stlUrl && material && !colorRequired && quality && !slicing && !pending)

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Step 1: Upload STL ─────────────────────────────────── */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">
          Upload your 3D model <span className="text-red-500">*</span>
        </h3>
        <p className="mb-3 text-xs text-slate-400">STL file required to calculate an accurate price</p>

        {!stlFile ? (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center hover:border-orange-300 hover:bg-orange-50 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Upload className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Drop your STL file here</p>
              <p className="text-xs text-slate-400 mt-0.5">or click to browse</p>
            </div>
            <input
              type="file"
              accept=".stl"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStlSelect(f) }}
            />
          </label>
        ) : (
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <Suspense fallback={
                <div className="flex h-48 items-center justify-center bg-slate-50 text-sm text-slate-400">
                  Loading 3D viewer...
                </div>
              }>
                <STLViewer file={stlFile} />
              </Suspense>
              <button
                type="button"
                onClick={clearStl}
                className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-slate-500 hover:text-slate-900 shadow transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
              </div>
            )}
            {stlUrl && !uploading && (
              <p className="text-xs text-green-600">✓ {stlFile.name} ready</p>
            )}
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          </div>
        )}
      </div>

      {/* ── Step 2: Material & Color (shown after STL uploaded) ─── */}
      {stlUrl && (
        <>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">
              Material <span className="text-red-500">*</span>
            </h3>
            <p className="mb-3 text-xs text-slate-400">What material should it be printed in?</p>
            <div className="flex flex-wrap gap-2">
              {materialOptions.map((m) => {
                const colors = filamentsByMaterial[m] ?? []
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMaterialSelect(m)}
                    className={`rounded-xl border px-4 py-2.5 text-left transition ${
                      material === m
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                    }`}
                  >
                    <p className="text-sm font-medium">{MATERIAL_LABELS[m]}</p>
                    {colors.length > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        {colors.slice(0, 5).map((f) => (
                          <span
                            key={f.id}
                            className="h-3 w-3 rounded-full border border-white shadow-sm"
                            style={{ background: f.color_hex }}
                            title={f.color}
                          />
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
          {hasColorChoice && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">
                Color <span className="text-red-500">*</span>
              </h3>
              <p className="mb-3 text-xs text-slate-400">Choose an available color</p>
              <div className="flex flex-wrap gap-2">
                {filamentsByMaterial[material as string].map((f) => (
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
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-slate-200 shadow-sm"
                      style={{ background: f.color_hex }}
                    />
                    <span>{f.color}</span>
                    {f.brand && <span className="text-xs text-slate-400">{f.brand}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Step 3: Quality (shown after material selected) ──────── */}
      {stlUrl && material && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            Quality <span className="text-red-500">*</span>
          </h3>
          <p className="mb-3 text-xs text-slate-400">Surface finish and infill strength</p>
          <div className="grid grid-cols-3 gap-2">
            {(['draft', 'standard', 'premium'] as PrintQuality[]).map((q) => {
              const infillPct =
                q === 'draft'
                  ? (defaultProfile?.infill_draft ?? 15)
                  : q === 'standard'
                  ? (defaultProfile?.infill_standard ?? 25)
                  : (defaultProfile?.infill_premium ?? 40)
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`rounded-xl border px-3 py-3 text-center transition ${
                    quality === q
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                  }`}
                >
                  <p className="text-sm font-medium capitalize">{q}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{infillPct}% infill</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Price (shown while slicing or after slice) ─────────── */}
      {stlUrl && material && quality && (
        <div>
          {slicing && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Calculating price from your file...</p>
                <p className="text-xs text-slate-400">This takes a few seconds</p>
              </div>
            </div>
          )}

          {sliceError && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {sliceError}
            </div>
          )}

          {price && sliceResult && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
              <p className="text-xs font-medium text-slate-500 mb-3">Price estimate from your file</p>
              <p className="text-3xl font-bold text-orange-600 mb-3">{formatRM(price.suggested_price)}</p>
              <div className="space-y-1 text-xs text-slate-500 border-t border-orange-100 pt-3">
                <div className="flex justify-between">
                  <span>Filament ~{sliceResult.weight_g}g</span>
                  <span>{formatRM(price.filament_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Electricity ~{sliceResult.print_hours}h</span>
                  <span>{formatRM(price.electricity_cost)}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-700 border-t border-orange-100 pt-1 mt-1">
                  <span>Base + {printer.markup_percent ?? 30}% margin</span>
                  <span>{formatRM(price.suggested_price)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">Final price confirmed in the owner's quote.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Details + contact (shown after STL ready) ────── */}
      {stlUrl && (
        <>
          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-medium text-slate-600">
              Describe what you need <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              placeholder="e.g. A phone stand for my desk, roughly 10 cm tall. Need 2 copies."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="deadline" className="mb-1 block text-xs font-medium text-slate-600">
                When do you need it? <span className="text-red-500">*</span>
              </label>
              <input
                id="deadline"
                name="deadline"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1 block text-xs font-medium text-slate-600">
                Any notes?
              </label>
              <input
                id="notes"
                name="notes"
                type="text"
                placeholder="Quantity, special requirements..."
                className={inputClass}
              />
            </div>
          </div>

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
                  WhatsApp <span className="text-red-500">*</span>
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

          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || !!colorRequired}
            className="w-full rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Sending request...' : slicing ? 'Calculating price...' : 'Send Request'}
          </button>
        </>
      )}
    </form>
  )
}
