'use client'

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import {
  CheckCircle, Upload, X, Loader2, FileBox, Plus, Ruler,
  Link2, FileUp, PenLine, ExternalLink, Download,
} from 'lucide-react'
import type { Printer, PrintProfile, PrintQuality, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import { submitRequest } from '@/lib/actions'
import { createClient } from '@/lib/supabase/client'

const STLViewer = lazy(() => import('./STLViewer'))

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

type ModelMode = 'link' | 'file' | 'describe' | null

export type FileItem = {
  id: string
  file: File
  url: string | null
  uploading: boolean
  error: string
  color: string
  colorHex: string
  filamentId?: string
}

const ACCEPTED_FORMATS = '.stl,.3mf,.obj'
const ACCEPTED_EXTS    = ['.stl', '.3mf', '.obj']

const MODEL_SITES = [
  { name: 'MakerWorld', url: 'makerworld.com' },
  { name: 'Printables', url: 'printables.com' },
  { name: 'Thingiverse', url: 'thingiverse.com' },
  { name: 'Cults3D', url: 'cults3d.com' },
  { name: 'MyMiniFactory', url: 'myminifactory.com' },
]

// ─────────────────────────────────────────────────────────────────────────────
// FileUploadSection — MUST be defined at module level so its identity is stable
// across RequestForm re-renders (hover state, etc.). Defining it inside
// RequestForm creates a new function reference on every render, causing React
// to unmount+remount it and destroying the Three.js scene.
// ─────────────────────────────────────────────────────────────────────────────
type FileUploadSectionProps = {
  compact?: boolean
  fileItems: FileItem[]
  stlItems: FileItem[]
  previewUrls: string[]
  hoveredFileId: string | null
  onHoverChange: (id: string | null) => void
  onRemove: (id: string) => void
  onUpdateColor: (id: string, color: string, hex: string, filamentId?: string) => void
  filaments: Filament[]
  addMoreRef: React.RefObject<HTMLInputElement | null>
  onDrop: (files: FileList | File[]) => void
  onAddMore: (files: FileList) => void
}

function FileUploadSection({
  compact,
  fileItems,
  stlItems,
  previewUrls,
  hoveredFileId,
  onHoverChange,
  onRemove,
  onUpdateColor,
  filaments,
  addMoreRef,
  onDrop,
  onAddMore,
}: FileUploadSectionProps) {
  if (fileItems.length === 0) {
    return (
      <label
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center hover:border-orange-300 hover:bg-orange-50 transition ${compact ? 'px-4 py-5' : 'px-6 py-10'}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files) }}
      >
        <div className={`flex items-center justify-center rounded-full bg-slate-100 ${compact ? 'h-9 w-9' : 'h-12 w-12'}`}>
          <Upload className={`text-slate-400 ${compact ? 'h-4 w-4' : 'h-6 w-6'}`} />
        </div>
        <div>
          <p className={`font-medium text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>Drop your model files here</p>
          <p className="text-xs text-slate-400 mt-0.5">or click to browse · STL, 3MF, OBJ accepted</p>
          {!compact && <p className="text-xs text-slate-400">Multi-part model? Upload all files together.</p>}
        </div>
        <input
          type="file"
          accept={ACCEPTED_FORMATS}
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) onDrop(e.target.files) }}
        />
      </label>
    )
  }

  const highlightIndex = hoveredFileId
    ? stlItems.findIndex((i) => i.id === hoveredFileId)
    : undefined

  const hasViewer = stlItems.length > 0 && previewUrls.length > 0

  return (
    <div className="space-y-0">
      {/* Viewer full-width */}
      {hasViewer && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 h-56 mb-3">
          <Suspense fallback={
            <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-400">
              Loading 3D viewer...
            </div>
          }>
            <STLViewer
              urls={previewUrls}
              fileNames={stlItems.map((i) => i.file.name)}
              colors={stlItems.map((i) => i.colorHex || '#e0e0e0')}
              highlightIndex={highlightIndex}
              className="h-full"
            />
          </Suspense>
          {stlItems.length > 1 && (
            <p className="absolute top-2 left-3 text-[10px] text-slate-500 select-none pointer-events-none bg-white/80 rounded px-1.5 py-0.5">
              {hoveredFileId && highlightIndex !== undefined && highlightIndex >= 0
                ? `Part ${highlightIndex + 1} highlighted`
                : 'Hover a part below to highlight it'}
            </p>
          )}
        </div>
      )}

      {/* Part list — compact rows, scrollable */}
      <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${hasViewer && fileItems.length > 4 ? 'max-h-48 overflow-y-auto' : ''}`}>
        {fileItems.map((item, idx) => {
          const stlIdx    = stlItems.findIndex((si) => si.id === item.id)
          const isStl     = stlIdx >= 0
          const isHovered = hoveredFileId === item.id
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 last:border-b-0 transition-colors cursor-default ${
                isHovered && isStl ? 'bg-orange-50' : 'hover:bg-slate-50'
              }`}
              onMouseEnter={() => isStl && onHoverChange(item.id)}
              onMouseLeave={() => onHoverChange(null)}
            >
              {/* Part label */}
              <span className={`shrink-0 text-sm font-semibold w-12 ${isHovered && isStl ? 'text-orange-600' : 'text-slate-700'}`}>
                {fileItems.length > 1 ? `Part ${idx + 1}` : 'Color'}
              </span>

              {filaments.length > 0 ? (
                /* Filament swatches from owner's inventory */
                <>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {filaments.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        title={`${MATERIAL_LABELS[f.material as FilamentMaterial] ?? f.material} — ${f.color}${f.brand ? ` (${f.brand})` : ''}`}
                        onClick={() => onUpdateColor(item.id, f.color, f.color_hex, f.id)}
                        className={`h-6 w-6 rounded-full border-2 transition-all shrink-0 ${
                          item.filamentId === f.id
                            ? 'border-orange-500 scale-110 shadow-md'
                            : 'border-slate-200 hover:border-slate-400 hover:scale-105'
                        }`}
                        style={{ backgroundColor: f.color_hex }}
                      />
                    ))}
                  </div>
                  <span className={`shrink-0 text-xs max-w-[110px] truncate ${item.filamentId ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                    {item.filamentId
                      ? (() => { const f = filaments.find((x) => x.id === item.filamentId); return f ? `${MATERIAL_LABELS[f.material as FilamentMaterial] ?? f.material} · ${f.color}` : '' })()
                      : 'pick a color'}
                  </span>
                </>
              ) : (
                /* Fallback: free-text color name + hex picker */
                <>
                  <input
                    type="color"
                    value={item.colorHex}
                    onChange={(e) => onUpdateColor(item.id, item.color, e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded-lg border border-slate-200 p-0.5 shrink-0"
                    title="Pick color"
                  />
                  <input
                    type="text"
                    placeholder="Color name (e.g. Red)"
                    value={item.color}
                    onChange={(e) => onUpdateColor(item.id, e.target.value, item.colorHex)}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:outline-none transition"
                  />
                </>
              )}

              {/* Status + remove */}
              {item.uploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400 shrink-0" />}
              {item.url && !item.uploading && <span className="shrink-0 text-xs text-green-500">✓</span>}
              {item.error && <span className="shrink-0 text-xs text-red-500">!</span>}
              <button type="button" onClick={() => onRemove(item.id)}
                className="shrink-0 rounded-full p-0.5 text-slate-300 hover:text-red-400 transition">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <button type="button" onClick={() => addMoreRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition mt-2">
        <Plus className="h-3.5 w-3.5" /> Add more files
      </button>
      <input ref={addMoreRef} type="file" accept={ACCEPTED_FORMATS} multiple className="hidden"
        onChange={(e) => { if (e.target.files) { onAddMore(e.target.files); e.target.value = '' } }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RequestForm({
  printer,
  profiles,
  buildVolume,
  filaments,
}: {
  printer: Printer
  profiles: PrintProfile[]
  buildVolume: string | null
  filaments: Filament[]
}) {
  const [requestId, setRequestId]     = useState<string | null>(null)
  const [customerEmail, setCustomerEmail] = useState('')
  const [pending, setPending]         = useState(false)
  const [submitError, setSubmitError] = useState('')
  const addInputRef    = useRef<HTMLInputElement>(null)
  const linkUploadRef  = useRef<HTMLInputElement>(null)

  const [modelMode, setModelMode]   = useState<ModelMode>(null)
  const [modelUrl, setModelUrl]     = useState('')
  const [ogPreview, setOgPreview]   = useState<{
    title: string | null; description: string | null
    image: string | null; siteName: string | null; fromSlug?: boolean
  } | null>(null)
  const [ogLoading, setOgLoading]   = useState(false)
  const [ogError, setOgError]       = useState('')
  const [fileItems, setFileItems]   = useState<FileItem[]>([])
  const allUploaded = fileItems.length > 0 && fileItems.every((i) => i.url !== null && !i.uploading)

  const [quality, setQuality]         = useState<PrintQuality | ''>('')
  const [quantity, setQuantity]       = useState(1)
  const [deadlineType, setDeadlineType] = useState<'asap' | 'anytime' | 'date'>('date')
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls]     = useState<string[]>([])

  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0] ?? null
  // All formats supported by the 3D viewer (STL, 3MF, OBJ)
  const stlItems = fileItems.filter((i) =>
    ['.stl', '.3mf', '.obj'].some((ext) => i.file.name.toLowerCase().endsWith(ext))
  )

  function pickMode(mode: ModelMode) {
    setModelMode(mode)
    setModelUrl('')
    setOgPreview(null)
    setOgError('')
    setFileItems([])
    setPreviewUrls([])
    setHoveredFileId(null)
  }

  useEffect(() => {
    if (modelMode !== 'link' || !modelUrl.trim()) { setOgPreview(null); setOgError(''); return }
    setOgLoading(true); setOgError('')
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/og-preview?url=${encodeURIComponent(modelUrl.trim())}`)
        const data = await res.json()
        if (data.error) { setOgPreview(null); setOgError('Could not load preview — your link is still saved.') }
        else { setOgPreview(data); setOgError('') }
      } catch {
        setOgPreview(null); setOgError('Could not load preview — your link is still saved.')
      } finally { setOgLoading(false) }
    }, 600)
    return () => { clearTimeout(timer); setOgLoading(false) }
  }, [modelUrl, modelMode])

  // Rebuild blob URLs whenever file list changes (all previewable formats)
  useEffect(() => {
    const items = fileItems.filter((i) =>
      ['.stl', '.3mf', '.obj'].some((ext) => i.file.name.toLowerCase().endsWith(ext))
    )
    const urls  = items.map((i) => URL.createObjectURL(i.file))
    setPreviewUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileItems.map((i) => i.id).join(',')])

  const uploadFile = useCallback(async (item: FileItem) => {
    const supabase = createClient()
    const path = `anonymous/${Date.now()}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { data: uploadData, error } = await supabase.storage.from('stl-files').upload(path, item.file)
    if (error || !uploadData) {
      setFileItems((prev) => prev.map((i) => i.id === item.id ? { ...i, uploading: false, error: error?.message ?? 'Upload failed' } : i))
      return
    }
    const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
    setFileItems((prev) => prev.map((i) => i.id === item.id ? { ...i, uploading: false, url: urlData.publicUrl } : i))
  }, [])

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: FileItem[] = Array.from(files)
      .filter((f) => ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)))
      .map((f) => ({ id: crypto.randomUUID(), file: f, url: null, uploading: true, error: '', color: '', colorHex: '#e0e0e0' }))
    if (!newItems.length) return
    setFileItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => uploadFile(item))
  }, [uploadFile])

  const removeFile     = useCallback((id: string) => setFileItems((prev) => prev.filter((i) => i.id !== id)), [])
  const updateFileColor = useCallback((id: string, color: string, hex: string, filamentId?: string) =>
    setFileItems((prev) => prev.map((i) => i.id === id ? { ...i, color, colorHex: hex, filamentId } : i)), [])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!quality) return
    setSubmitError('')
    setPending(true)

    const form  = e.currentTarget
    const notes = (form.elements.namedItem('notes') as HTMLInputElement)?.value ?? ''

    // Compute deadline date from type
    const todayStr = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const farFuture = new Date(); farFuture.setDate(farFuture.getDate() + 180)
    const deadlineValue =
      deadlineType === 'asap'    ? tomorrow.toISOString().split('T')[0] :
      deadlineType === 'anytime' ? farFuture.toISOString().split('T')[0] :
      (form.elements.namedItem('deadline') as HTMLInputElement)?.value || todayStr

    const urgencyPrefix =
      deadlineType === 'asap'    ? 'ASAP — rush order. ' :
      deadlineType === 'anytime' ? 'Anytime — no rush. ' : ''
    const notesWithQty = urgencyPrefix + (quantity > 1 ? `Quantity: ${quantity} copies.${notes ? ` ${notes}` : ''}` : notes)

    const stlUrls    = fileItems.map((i) => i.url).filter(Boolean) as string[]
    const colorPrefs = fileItems.filter((i) => i.url).map((item, idx) => ({
      part_number: idx + 1,
      file_name:   item.file.name,
      color:       item.color || 'Any',
      color_hex:   item.colorHex || '#e0e0e0',
    }))

    const hasColorPref   = colorPrefs.some((p) => p.color !== 'Any')
    const primaryColor   = colorPrefs.length > 1 ? 'Multi-color' : (colorPrefs[0]?.color || 'Any')
    const primaryHex     = colorPrefs[0]?.color_hex || '#888888'
    const isMultiColor   = colorPrefs.length > 1 && hasColorPref

    const result = await submitRequest({
      printer_id:     printer.id,
      customer_name:  (form.elements.namedItem('name') as HTMLInputElement).value,
      customer_email: (form.elements.namedItem('email') as HTMLInputElement).value,
      customer_phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      description:    (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      print_type:     'everyday',
      material:       'pla',
      color:          hasColorPref ? primaryColor : 'Any',
      color_hex:      hasColorPref ? primaryHex : '#888888',
      supports:       false,
      size:           'medium',
      quality:        quality as PrintQuality,
      deadline:       deadlineValue,
      notes:          notesWithQty,
      model_url:      modelMode === 'link' && modelUrl.trim() ? modelUrl.trim() : null,
      model_title:    ogPreview?.title ?? null,
      model_image:    ogPreview?.image ?? null,
      stl_url:        stlUrls[0] ?? null,
      stl_urls:       stlUrls,
      weight_g:       null,
      print_hours:    null,
      profile_id:     defaultProfile?.id ?? null,
      selected_addons: isMultiColor ? ['color_change'] : [],
      color_preferences: colorPrefs.length ? colorPrefs : undefined,
    })

    const submittedEmail = (form.elements.namedItem('email') as HTMLInputElement).value
    setPending(false)
    if ('error' in result) { setSubmitError(result.error); return }
    setCustomerEmail(submittedEmail)
    setRequestId(result.id)
  }

  // ── Success screen ───────────────────────────────────────────────
  if (requestId) {
    const trackingUrl = `/track/${requestId}`
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-900">Request sent!</h2>
        <p className="max-w-sm text-sm text-slate-600">
          <strong>{printer.name}</strong> will review your request and send you a quote within {printer.turnaround}.
          A confirmation email is on its way.
        </p>
        <div className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
          <p className="text-xs font-medium text-slate-500 mb-1">Your tracking link — save this!</p>
          <a href={trackingUrl} className="text-sm font-medium text-orange-500 hover:text-orange-600 break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}{trackingUrl}
          </a>
        </div>
        <a href={trackingUrl} className="mt-4 w-full rounded-xl bg-orange-500 py-3 text-center text-sm font-semibold text-white hover:bg-orange-600 transition">
          Track this order →
        </a>
        {customerEmail && (
          <a
            href={`/track?email=${encodeURIComponent(customerEmail)}`}
            className="mt-2 w-full rounded-xl border border-slate-200 py-3 text-center text-sm font-medium text-slate-600 hover:border-orange-300 hover:text-orange-600 transition"
          >
            View all your orders
          </a>
        )}
        <a href="/printers" className="mt-3 text-sm text-slate-400 hover:text-slate-600">Browse more printers</a>
      </div>
    )
  }

  const modelReady =
    modelMode === 'link'     ? modelUrl.trim().length > 0 :
    modelMode === 'file'     ? (fileItems.length === 0 || allUploaded) :
    true
  const formVisible = modelMode !== null
  const deadlineReady = deadlineType !== 'date'  // ASAP/Anytime are always ready; date needs input (enforced by required attr)
  const canSubmit   = !!(formVisible && modelReady && quality && !pending)

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Section A: Model source ──────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-700">Where is your 3D model?</h3>
          {modelMode !== null && (
            <button type="button" onClick={() => pickMode(null)} className="text-xs text-slate-400 hover:text-slate-600 transition">
              Change
            </button>
          )}
        </div>

        {buildVolume && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Ruler className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Max print size: <span className="font-medium text-slate-700">{buildVolume}</span> — make sure your model fits.
          </div>
        )}

        {modelMode === null && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { mode: 'link'     as const, icon: Link2,  title: 'Paste a link',    desc: 'Found it on MakerWorld, Printables, Thingiverse, etc.' },
              { mode: 'file'     as const, icon: FileUp, title: 'Upload a file',   desc: 'Have an STL, 3MF, or OBJ file ready to go.' },
              { mode: 'describe' as const, icon: PenLine,title: "I'll describe it",desc: "No file yet — you'll describe what you need below." },
            ].map(({ mode, icon: Icon, title, desc }) => (
              <button key={mode} type="button" onClick={() => pickMode(mode)}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center hover:border-orange-400 hover:bg-orange-50 transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <Icon className="h-5 w-5 text-slate-500" />
                </div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Link mode */}
        {modelMode === 'link' && (
          <div className="space-y-3">
            <div className="relative">
              <input type="url" value={modelUrl} onChange={(e) => setModelUrl(e.target.value)}
                placeholder="https://makerworld.com/models/..." className={`${inputClass} pr-9`} autoFocus />
              {ogLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-orange-400" />}
            </div>

            {ogPreview && !ogLoading && (
              <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                {ogPreview.image && (
                  <img src={ogPreview.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }} />
                )}
                <div className="min-w-0">
                  {ogPreview.siteName && <p className="mb-0.5 text-xs font-medium text-orange-500">{ogPreview.siteName}</p>}
                  {ogPreview.title    && <p className="text-sm font-semibold text-slate-900 leading-snug">{ogPreview.title}</p>}
                  {ogPreview.description && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{ogPreview.description}</p>}
                  {ogPreview.fromSlug && <p className="mt-0.5 text-xs text-slate-400">Preview blocked — link and title saved.</p>}
                  <a href={modelUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-orange-500 transition">
                    <ExternalLink className="h-3 w-3" /> View model
                  </a>
                </div>
              </div>
            )}
            {ogError && !ogLoading && <p className="text-xs text-slate-400">{ogError}</p>}
            {!ogPreview && !ogLoading && !ogError && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-400">Try:</span>
                {MODEL_SITES.map((site) => (
                  <span key={site.url} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{site.name}</span>
                ))}
              </div>
            )}

            {/* Upload panel — shown once URL is entered */}
            {modelUrl.trim() && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <Download className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Upload the model files for a 3D preview</p>
                    <p className="mt-0.5 text-xs text-blue-600">
                      Download the STL files from the link above, then drop them here.
                      You&apos;ll be able to see each part in 3D and pick a color for each one.
                    </p>
                  </div>
                </div>
                <FileUploadSection
                  compact
                  fileItems={fileItems}
                  stlItems={stlItems}
                  previewUrls={previewUrls}
                  hoveredFileId={hoveredFileId}
                  onHoverChange={setHoveredFileId}
                  onRemove={removeFile}
                  onUpdateColor={updateFileColor}
                  filaments={filaments}
                  addMoreRef={addInputRef}
                  onDrop={addFiles}
                  onAddMore={addFiles}
                />
                <input ref={linkUploadRef} type="file" accept={ACCEPTED_FORMATS} multiple className="hidden"
                  onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />
              </div>
            )}
          </div>
        )}

        {/* File mode */}
        {modelMode === 'file' && (
          <FileUploadSection
            fileItems={fileItems}
            stlItems={stlItems}
            previewUrls={previewUrls}
            hoveredFileId={hoveredFileId}
            onHoverChange={setHoveredFileId}
            onRemove={removeFile}
            onUpdateColor={updateFileColor}
            filaments={filaments}
            addMoreRef={addInputRef}
            onDrop={addFiles}
            onAddMore={addFiles}
          />
        )}

        {modelMode === 'describe' && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No problem — describe what you need in the field below. The owner will work with you on the design.
          </div>
        )}
      </div>

      {/* ── Sections B + C ───────────────────────────────────── */}
      {formVisible && (
        <>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Quality <span className="text-red-500">*</span></h3>
            <p className="mb-3 text-xs text-slate-400">Higher quality = slower print, smoother finish</p>
            <div className="grid grid-cols-3 gap-2">
              {(['draft', 'standard', 'premium'] as PrintQuality[]).map((q) => {
                const infill = q === 'draft' ? (defaultProfile?.infill_draft ?? 15) : q === 'standard' ? (defaultProfile?.infill_standard ?? 25) : (defaultProfile?.infill_premium ?? 40)
                const desc   = q === 'draft' ? 'Fast, rough finish' : q === 'standard' ? 'Balanced — most jobs' : 'Slow, smooth finish'
                return (
                  <button key={q} type="button" onClick={() => setQuality(q)}
                    className={`rounded-xl border px-3 py-3 text-center transition ${quality === q ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
                    <p className="text-sm font-medium capitalize">{q}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{infill}% infill</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">How many copies? <span className="text-red-500">*</span></label>
            <p className="mb-3 text-xs text-slate-400">Number of identical prints you need</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-medium text-slate-700 hover:bg-slate-50 transition">−</button>
              <span className="w-8 text-center text-lg font-semibold text-slate-900">{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-medium text-slate-700 hover:bg-slate-50 transition">+</button>
              {quantity > 1 && <span className="text-xs text-slate-400">× {quantity} prints</span>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            The owner will review your request and send a price quote within{' '}
            <span className="font-medium text-slate-700">{printer.turnaround}</span>.
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-medium text-slate-600">
              What is this for? <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-slate-400">A short description helps the owner understand your request and quote accurately.</p>
            <textarea id="description" name="description" required rows={3}
              placeholder="e.g. A desk phone stand, roughly 10 cm tall. Needs to hold a phone at 45°."
              className={`${inputClass} resize-none`} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">
                When do you need it? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {([
                  { key: 'asap',    label: '⚡ ASAP',     desc: 'Rush — as soon as possible', cls: 'border-red-300 bg-red-50 text-red-700', activeCls: 'border-red-500 bg-red-100 text-red-800 font-semibold' },
                  { key: 'anytime', label: '🕐 Anytime',  desc: 'No rush — whenever ready',   cls: 'border-green-200 bg-green-50 text-green-700', activeCls: 'border-green-500 bg-green-100 text-green-800 font-semibold' },
                  { key: 'date',    label: '📅 Pick date', desc: 'I have a specific deadline', cls: 'border-slate-200 bg-white text-slate-600', activeCls: 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' },
                ] as const).map(({ key, label, desc, cls, activeCls }) => (
                  <button key={key} type="button" onClick={() => setDeadlineType(key)}
                    title={desc}
                    className={`rounded-xl border px-2 py-2.5 text-center text-xs transition ${deadlineType === key ? activeCls : cls}`}>
                    {label}
                  </button>
                ))}
              </div>
              {deadlineType === 'asap' && (
                <p className="text-xs text-red-500 font-medium">The owner may charge a rush fee for urgent orders.</p>
              )}
              {deadlineType === 'anytime' && (
                <p className="text-xs text-green-600">Great — the owner will fit this in at their convenience.</p>
              )}
              {deadlineType === 'date' && (
                <input id="deadline" name="deadline" type="date" required
                  min={new Date().toISOString().split('T')[0]} className={inputClass} />
              )}
            </div>
            <div>
              <label htmlFor="notes" className="mb-1 block text-xs font-medium text-slate-600">Any notes?</label>
              <input id="notes" name="notes" type="text"
                placeholder="Special requirements, finish preference..." className={inputClass} />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Your contact details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1 block text-xs font-medium text-slate-600">Name <span className="text-red-500">*</span></label>
                <input id="name" name="name" type="text" required placeholder="Ahmad Farid" className={inputClass} />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-xs font-medium text-slate-600">WhatsApp <span className="text-red-500">*</span></label>
                <input id="phone" name="phone" type="tel" required placeholder="+601X-XXXXXXX" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">Email <span className="text-red-500">*</span></label>
                <input id="email" name="email" type="email" required placeholder="you@example.com" className={inputClass} />
              </div>
            </div>
          </div>

          {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</p>}

          <button type="submit" disabled={!canSubmit}
            className="w-full rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? 'Sending request...' : 'Send Request'}
          </button>
        </>
      )}
    </form>
  )
}
