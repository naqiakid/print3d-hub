'use client'

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import {
  CheckCircle, Upload, X, Loader2, FileBox, Plus, Ruler,
  Link2, FileUp, ExternalLink, Download, HelpCircle,
} from 'lucide-react'
import type { Printer, PrintProfile, PrintQuality, PrintSize, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS, MATERIAL_DESCRIPTIONS } from '@/lib/types'
import { submitRequest } from '@/lib/actions'
import { createClient } from '@/lib/supabase/client'
import { SIZE_LABELS } from '@/lib/types'
import {
  calculateEstimate,
  DEFAULT_FILAMENT_COST_PER_KG,
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_MARKUP_PERCENT,
  DEFAULT_MACHINE_RATE,
  DEFAULT_WASTE_PERCENT,
} from '@/lib/pricing'

const STLViewer = lazy(() => import('./STLViewer'))

const COLOR_PRESETS = [
  { name: 'Black',    hex: '#1a1a1a' },
  { name: 'White',    hex: '#f5f5f5' },
  { name: 'Grey',     hex: '#6b7280' },
  { name: 'Natural',  hex: '#d4b896' },
  { name: 'Red',      hex: '#dc2626' },
  { name: 'Blue',     hex: '#2563eb' },
  { name: 'Green',    hex: '#16a34a' },
  { name: 'Yellow',   hex: '#ca8a04' },
  { name: 'Orange',   hex: '#ea580c' },
  { name: 'Purple',   hex: '#7c3aed' },
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

type ModelMode = 'link' | 'file' | null

export type ThreeMfPart = {
  name: string
  color: string
  colorHex: string
  filamentId?: string
}

export type FileItem = {
  id: string
  file: File
  url: string | null
  uploading: boolean
  error: string
  color: string
  colorHex: string
  filamentId?: string
  parts?: ThreeMfPart[]                          // set after parsing a multi-object 3MF
  dimensions?: { x: number; y: number; z: number } // computed from model geometry
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

// Parse a .3mf file and return the names of its mesh objects (returns [] if 0 or 1 object).
// Handles both standard 3MF and Bambu Lab's split-object format (3D/Objects/*.model).
async function parse3mfParts(file: File): Promise<string[]> {
  try {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(await file.arrayBuffer())

    // ── Strategy 1: Bambu Lab model_settings.config ──────────────────────────
    // Bambu Studio splits each object into a separate 3D/Objects/*.model file
    // and stores human-readable names in Metadata/model_settings.config
    const configEntry = zip.file('Metadata/model_settings.config')
    if (configEntry) {
      const xml = await configEntry.async('text')
      const doc = new DOMParser().parseFromString(xml, 'text/xml')
      const names = Array.from(doc.getElementsByTagName('object')).map((obj, i) => {
        const nameMeta = Array.from(obj.getElementsByTagName('metadata'))
          .find((m) => m.getAttribute('key') === 'name')
        const raw = nameMeta?.getAttribute('value') ?? ''
        // Strip file extension (.stl, .obj, etc.) and trim
        return raw.replace(/\.[a-z0-9]+$/i, '').trim() || `Part ${i + 1}`
      })
      if (names.length >= 2) return names
    }

    // ── Strategy 2: Scan all .model files for mesh objects ───────────────────
    // Standard 3MF packs all meshes in 3D/3dmodel.model; some slicers use
    // per-object files in 3D/Objects/*.model (without a config file)
    const modelPaths = Object.keys(zip.files).filter((f) => /\.model$/i.test(f))
    const names: string[] = []
    for (const modelPath of modelPaths) {
      const entry = zip.file(modelPath)
      if (!entry) continue
      const xml  = await entry.async('text')
      const doc  = new DOMParser().parseFromString(xml, 'text/xml')
      const mesh = Array.from(doc.getElementsByTagName('object')).filter(
        (o) =>
          o.getElementsByTagName('mesh').length > 0 &&
          o.getAttribute('type') !== 'support',
      )
      for (const obj of mesh) {
        const n = obj.getAttribute('name')?.trim()
        names.push(n || `Part ${names.length + 1}`)
      }
    }
    if (names.length >= 2) return names

    return []
  } catch {
    return []
  }
}

// Parse "256 × 256 × 256 mm" → { x, y, z }
function parseBuildVolume(s: string): { x: number; y: number; z: number } | null {
  const nums = s.match(/[\d.]+/g)?.map(Number)
  if (!nums || nums.length < 3) return null
  return { x: nums[0], y: nums[1], z: nums[2] }
}

// Check if a model bounding box fits inside the printer build volume.
// Sorts both sets of dimensions so the check is valid for any 90° rotation.
function fitsInVolume(
  model: { x: number; y: number; z: number },
  printer: { x: number; y: number; z: number },
): boolean {
  const m = [model.x, model.y, model.z].sort((a, b) => a - b)
  const p = [printer.x, printer.y, printer.z].sort((a, b) => a - b)
  return m[0] <= p[0] && m[1] <= p[1] && m[2] <= p[2]
}

// Compute bounding-box dimensions (mm) from uploaded model files without loading Three.js.
// Binary STL: parse float32 vertices directly from ArrayBuffer.
// 3MF: unzip and read <vertex> elements with DOMParser.
// Yield control back to the browser so the UI stays responsive during heavy loops.
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

async function computeModelDimensions(file: File): Promise<{ x: number; y: number; z: number } | null> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  try {
    if (ext === 'stl') {
      const buf = await file.arrayBuffer()
      if (buf.byteLength < 84) return null
      const view = new DataView(buf)
      const triCount = view.getUint32(80, true)
      if (triCount < 1 || triCount > 5_000_000) return null
      if (buf.byteLength < 84 + triCount * 50) return null
      let minX = Infinity, maxX = -Infinity
      let minY = Infinity, maxY = -Infinity
      let minZ = Infinity, maxZ = -Infinity
      // Yield every 50k triangles so the browser can repaint between chunks.
      for (let i = 0; i < triCount; i++) {
        if (i > 0 && i % 50_000 === 0) await yieldToMain()
        const b = 84 + i * 50
        for (let v = 0; v < 3; v++) {
          const vb = b + 12 + v * 12
          const x = view.getFloat32(vb,     true)
          const y = view.getFloat32(vb + 4, true)
          const z = view.getFloat32(vb + 8, true)
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
        }
      }
      if (!isFinite(minX)) return null
      return {
        x: Math.round((maxX - minX) * 10) / 10,
        y: Math.round((maxY - minY) * 10) / 10,
        z: Math.round((maxZ - minZ) * 10) / 10,
      }
    } else if (ext === '3mf') {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const modelPaths = Object.keys(zip.files).filter((f) => /\.model$/i.test(f))
      let minX = Infinity, maxX = -Infinity
      let minY = Infinity, maxY = -Infinity
      let minZ = Infinity, maxZ = -Infinity
      let found = false
      for (const path of modelPaths) {
        const entry = zip.file(path)
        if (!entry) continue
        const xml = await entry.async('text')
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        const verts = doc.getElementsByTagName('vertex')
        // Yield every 50k vertices for large 3MF files.
        for (let i = 0; i < verts.length; i++) {
          if (i > 0 && i % 50_000 === 0) await yieldToMain()
          const x = parseFloat(verts[i].getAttribute('x') ?? '0')
          const y = parseFloat(verts[i].getAttribute('y') ?? '0')
          const z = parseFloat(verts[i].getAttribute('z') ?? '0')
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
          found = true
        }
      }
      if (!found || !isFinite(minX)) return null
      return {
        x: Math.round((maxX - minX) * 10) / 10,
        y: Math.round((maxY - minY) * 10) / 10,
        z: Math.round((maxZ - minZ) * 10) / 10,
      }
    }
    return null
  } catch {
    return null
  }
}

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
  onUpdatePartColor: (id: string, partIdx: number, color: string, hex: string, filamentId?: string) => void
  filaments: Filament[]
  addMoreRef: React.RefObject<HTMLInputElement | null>
  onDrop: (files: FileList | File[]) => void
  onAddMore: (files: FileList) => void
  buildVolume?: string | null
}

// A single colour-picker row — one per file (no parts) or one per part (3MF)
type ColorRow = {
  item: FileItem
  partIdx: number        // -1 = whole file row, ≥0 = specific part
  label: string          // part name or "Part N" / "Color"
  color: string
  colorHex: string
  filamentId?: string
  isFirstForItem: boolean
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
  onUpdatePartColor,
  filaments,
  addMoreRef,
  onDrop,
  onAddMore,
  buildVolume,
}: FileUploadSectionProps) {
  const [tooltip, setTooltip] = useState<{ mat: FilamentMaterial; x: number; y: number } | null>(null)

  const MAT_ORDER: FilamentMaterial[] = ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc']
  const filamentGroups = MAT_ORDER
    .map((mat) => ({ mat, items: filaments.filter((f) => f.material === mat) }))
    .filter((g) => g.items.length > 0)

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
          {!compact && <p className="text-xs text-slate-400">3MF files will be split into parts automatically.</p>}
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

  // Flatten file items into colour-picker rows. For 3MF with parts, one row per part.
  const colorRows: ColorRow[] = []
  for (let fileIdx = 0; fileIdx < fileItems.length; fileIdx++) {
    const item = fileItems[fileIdx]
    if (item.parts && item.parts.length > 0) {
      item.parts.forEach((part, pi) => {
        colorRows.push({
          item, partIdx: pi,
          label: part.name,
          color: part.color, colorHex: part.colorHex, filamentId: part.filamentId,
          isFirstForItem: pi === 0,
        })
      })
    } else {
      const totalFiles = fileItems.length
      const totalRows  = fileItems.reduce((n, i) => n + (i.parts?.length ?? 1), 0)
      colorRows.push({
        item, partIdx: -1,
        label: totalRows > 1 ? `Part ${fileIdx + 1}` : 'Color',
        color: item.color, colorHex: item.colorHex, filamentId: item.filamentId,
        isFirstForItem: true,
      })
    }
  }

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
              partColors={stlItems.map((i) => i.parts?.map((p) => p.colorHex || '#e0e0e0') ?? [])}
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

      {/* Part list — compact rows */}
      <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${hasViewer && colorRows.length > 4 ? 'max-h-48 overflow-y-auto' : ''}`}>
        {colorRows.map((row, rowIdx) => {
          const stlIdx    = stlItems.findIndex((si) => si.id === row.item.id)
          const isStl     = stlIdx >= 0
          const isHovered = hoveredFileId === row.item.id
          const is3mfPart = row.partIdx >= 0

          function handleColorUpdate(color: string, hex: string, filamentId?: string) {
            if (is3mfPart) {
              onUpdatePartColor(row.item.id, row.partIdx, color, hex, filamentId)
            } else {
              onUpdateColor(row.item.id, color, hex, filamentId)
            }
          }

          return (
            <div
              key={`${row.item.id}-${row.partIdx}`}
              className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 last:border-b-0 transition-colors cursor-default ${
                isHovered && isStl ? 'bg-orange-50' : 'hover:bg-slate-50'
              } ${is3mfPart && !row.isFirstForItem ? 'pl-5' : ''}`}
              onMouseEnter={() => isStl && onHoverChange(row.item.id)}
              onMouseLeave={() => onHoverChange(null)}
            >
              {/* 3MF file badge — only on the first part row */}
              {is3mfPart && row.isFirstForItem && (
                <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">3MF</span>
              )}
              {is3mfPart && !row.isFirstForItem && (
                <span className="shrink-0 w-6" /> /* indent spacer */
              )}

              {/* Part label */}
              <span className={`shrink-0 ${
                is3mfPart
                  ? `text-xs font-medium leading-tight w-24 break-words ${isHovered ? 'text-orange-600' : 'text-slate-600'}`
                  : `text-sm font-semibold w-12 ${isHovered && isStl ? 'text-orange-600' : 'text-slate-700'}`
              }`}>
                {row.label}
              </span>

              {filaments.length > 0 ? (
                /* Filament swatches grouped by material type */
                <>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {filamentGroups.map(({ mat, items }) => (
                      <div key={mat} className="flex items-center gap-2">
                        <div className="shrink-0 flex items-center gap-1">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 w-9">
                            {MATERIAL_LABELS[mat]}
                          </span>
                          <button
                            type="button"
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect()
                              setTooltip({ mat, x: r.left + r.width / 2, y: r.top })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition cursor-help"
                          >
                            ?
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {items.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              title={`${f.color}${f.brand ? ` (${f.brand})` : ''}`}
                              onClick={() => handleColorUpdate(f.color, f.color_hex, f.id)}
                              className={`h-6 w-6 rounded-full border-2 transition-all shrink-0 ${
                                row.filamentId === f.id
                                  ? 'border-orange-500 scale-110 shadow-md'
                                  : 'border-slate-200 hover:border-slate-400 hover:scale-105'
                              }`}
                              style={{ backgroundColor: f.color_hex }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <span className={`shrink-0 text-xs max-w-[110px] truncate ${row.filamentId ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                    {row.filamentId
                      ? (() => { const f = filaments.find((x) => x.id === row.filamentId); return f ? `${MATERIAL_LABELS[f.material as FilamentMaterial] ?? f.material} · ${f.color}` : '' })()
                      : 'pick a color'}
                  </span>
                </>
              ) : (
                /* Fallback: free-text color name + hex picker */
                <>
                  <input
                    type="color"
                    value={row.colorHex}
                    onChange={(e) => handleColorUpdate(row.color, e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded-lg border border-slate-200 p-0.5 shrink-0"
                    title="Pick color"
                  />
                  <input
                    type="text"
                    placeholder="Color name (e.g. Red)"
                    value={row.color}
                    onChange={(e) => handleColorUpdate(e.target.value, row.colorHex)}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:outline-none transition"
                  />
                </>
              )}

              {/* Status indicators + remove — only on first row for this file */}
              {row.isFirstForItem && (
                <>
                  {row.item.uploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400 shrink-0" />}
                  {row.item.url && !row.item.uploading && <span className="shrink-0 text-xs text-green-500">✓</span>}
                  {row.item.error && <span className="shrink-0 text-xs text-red-500">!</span>}
                  <button type="button" onClick={() => onRemove(row.item.id)}
                    className="shrink-0 rounded-full p-0.5 text-slate-300 hover:text-red-400 transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button type="button" onClick={() => addMoreRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition">
          <Plus className="h-3.5 w-3.5" /> Add more files
        </button>
        {fileItems.filter((i) => i.dimensions).map((item, idx) => {
          const d = item.dimensions!
          const pv = buildVolume ? parseBuildVolume(buildVolume) : null
          const fits = pv ? fitsInVolume(d, pv) : null
          return (
            <span
              key={item.id}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                fits === null
                  ? 'bg-slate-100 text-slate-500'
                  : fits
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {fits === null
                ? <Ruler className="h-3 w-3 text-slate-400 shrink-0" />
                : fits
                ? <span className="font-bold">✓</span>
                : <span className="font-bold">✗</span>}
              {fileItems.filter((i) => i.dimensions).length > 1 ? `File ${idx + 1}: ` : ''}
              {d.x} × {d.y} × {d.z} mm
            </span>
          )
        })}
      </div>
      <input ref={addMoreRef} type="file" accept={ACCEPTED_FORMATS} multiple className="hidden"
        onChange={(e) => { if (e.target.files) { onAddMore(e.target.files); e.target.value = '' } }} />

      {/* Hover tooltip — fixed so overflow:hidden on the part list doesn't clip it */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, calc(-100% - 8px))',
            zIndex: 9999,
          }}
          className="pointer-events-none rounded-lg bg-slate-800 px-3 py-2 text-[11px] leading-snug text-white shadow-xl max-w-[200px] text-center"
        >
          <strong className="block mb-0.5">{MATERIAL_LABELS[tooltip.mat]}</strong>
          {MATERIAL_DESCRIPTIONS[tooltip.mat]}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #1e293b',
          }} />
        </div>
      )}
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
  const [fulfillment, setFulfillment]         = useState<'pickup' | 'delivery'>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryGeoLoading, setDeliveryGeoLoading] = useState(false)
  const [deliveryEstimate, setDeliveryEstimate]     = useState<{ km: number; fee: number } | null>(null)
  const [deliveryGeoError, setDeliveryGeoError]     = useState('')
  const [pending, setPending]         = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [selectedCaps, setSelectedCaps] = useState<Set<string>>(new Set())
  const [declinedCaps, setDeclinedCaps] = useState<Set<string>>(new Set())
  const [surfaceText, setSurfaceText]   = useState('')
  const [insertNotes, setInsertNotes]   = useState('')
  const [capTooltip, setCapTooltip]     = useState<{ key: string; x: number; y: number } | null>(null)
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
  const [material, setMaterial]       = useState<FilamentMaterial | ''>('')
  const [requestColor, setRequestColor]     = useState('Any')
  const [requestColorHex, setRequestColorHex] = useState('#888888')
  const [linkSize, setLinkSize] = useState<'small' | 'medium' | 'large'>('medium')
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

  // Geocode delivery address and estimate fee (debounced, Nominatim OSM)
  useEffect(() => {
    if (fulfillment !== 'delivery' || !deliveryAddress.trim() || !printer.lat || !printer.lng) {
      setDeliveryEstimate(null)
      setDeliveryGeoError('')
      return
    }
    setDeliveryGeoLoading(true)
    setDeliveryGeoError('')
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(deliveryAddress)}&format=json&limit=1&countrycodes=my`,
          { headers: { 'User-Agent': 'Print3DHubApp/1.0' } },
        )
        const data = await res.json()
        if (!data?.[0]) { setDeliveryGeoError('Address not found — try adding postcode or city'); setDeliveryGeoLoading(false); return }
        const cLat = parseFloat(data[0].lat)
        const cLng = parseFloat(data[0].lon)
        const R    = 6371
        const dLat = (cLat - printer.lat) * Math.PI / 180
        const dLng = (cLng - printer.lng) * Math.PI / 180
        const a    = Math.sin(dLat / 2) ** 2 + Math.cos(printer.lat * Math.PI / 180) * Math.cos(cLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
        const straight = R * 2 * Math.asin(Math.sqrt(a))
        const road  = straight * 1.3
        const rate  = printer.delivery_rate_per_km ?? 1.00
        const fee   = Math.ceil(road * rate * 10) / 10
        setDeliveryEstimate({ km: Math.round(road * 10) / 10, fee })
        setDeliveryGeoLoading(false)
      } catch {
        setDeliveryGeoError('Could not estimate distance')
        setDeliveryGeoLoading(false)
      }
    }, 800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryAddress, fulfillment])

  // Rebuild blob URLs whenever file list changes
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
    newItems.forEach((item) => {
      uploadFile(item)
      // For 3MF files, parse part names in parallel with upload
      if (item.file.name.toLowerCase().endsWith('.3mf')) {
        parse3mfParts(item.file).then((partNames) => {
          if (partNames.length >= 2) {
            setFileItems((prev) => prev.map((i) =>
              i.id === item.id
                ? { ...i, parts: partNames.map((name) => ({ name, color: '', colorHex: '#e0e0e0' })) }
                : i,
            ))
          }
        })
      }
      // Compute bounding-box dimensions for STL and 3MF
      if (/\.(stl|3mf)$/i.test(item.file.name)) {
        computeModelDimensions(item.file).then((dims) => {
          if (dims) {
            setFileItems((prev) => prev.map((i) => i.id === item.id ? { ...i, dimensions: dims } : i))
          }
        })
      }
    })
  }, [uploadFile])

  const removeFile      = useCallback((id: string) => setFileItems((prev) => prev.filter((i) => i.id !== id)), [])

  const updateFileColor = useCallback((id: string, color: string, hex: string, filamentId?: string) =>
    setFileItems((prev) => prev.map((i) => i.id === id ? { ...i, color, colorHex: hex, filamentId } : i)), [])

  const updatePartColor = useCallback((id: string, partIdx: number, color: string, hex: string, filamentId?: string) =>
    setFileItems((prev) => prev.map((i) => {
      if (i.id !== id || !i.parts) return i
      const parts = i.parts.map((p, idx) => idx === partIdx ? { ...p, color, colorHex: hex, filamentId } : p)
      return { ...i, parts }
    })), [])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!quality) return
    setSubmitError('')
    setPending(true)

    const form  = e.currentTarget
    const notes = (form.elements.namedItem('notes') as HTMLInputElement)?.value ?? ''

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

    // Derive size tier + store actual dimensions from computed bounding boxes
    const primaryDims = fileItems.find((i) => i.dimensions)?.dimensions ?? null
    const autoSize: 'small' | 'medium' | 'large' = primaryDims
      ? Math.max(primaryDims.x, primaryDims.y, primaryDims.z) <= 100 ? 'small'
      : Math.max(primaryDims.x, primaryDims.y, primaryDims.z) <= 250 ? 'medium'
      : 'large'
      : 'medium'
    const dimsPrefix = primaryDims ? `[${primaryDims.x}×${primaryDims.y}×${primaryDims.z}mm] ` : ''

    const stlUrls = fileItems.map((i) => i.url).filter(Boolean) as string[]

    // Build colour preferences — one entry per part for 3MF files, one per file otherwise
    const colorPrefs = fileItems.filter((i) => i.url).flatMap((item, fileIdx) => {
      if (item.parts && item.parts.length > 0) {
        return item.parts.map((p, pi) => ({
          part_number: fileIdx + 1,
          part_index:  pi + 1,
          part_name:   p.name,
          file_name:   item.file.name,
          color:       p.color || 'Any',
          color_hex:   p.colorHex || '#e0e0e0',
          filament_id: p.filamentId,
        }))
      }
      return [{
        part_number: fileIdx + 1,
        file_name:   item.file.name,
        color:       item.color || 'Any',
        color_hex:   item.colorHex || '#e0e0e0',
        filament_id: item.filamentId,
      }]
    })

    const hasColorPref = colorPrefs.some((p) => p.color !== 'Any')
    const primaryColor = colorPrefs.length > 1 ? 'Multi-color' : (colorPrefs[0]?.color || 'Any')
    const primaryHex   = colorPrefs[0]?.color_hex || '#888888'
    const isMultiColor = colorPrefs.length > 1 && hasColorPref

    const derivedPrintType =
      selectedCaps.has('color_change') ? 'colorful'
      : (material && ['abs', 'nylon', 'pc'].includes(material)) ? 'strong'
      : 'everyday'

    // For link mode: use the color picker. For file mode: use per-part colors if set.
    const effectiveColor    = modelMode === 'file' && hasColorPref ? primaryColor    : requestColor
    const effectiveColorHex = modelMode === 'file' && hasColorPref ? primaryHex      : requestColorHex
    const effectiveSize     = modelMode === 'link' && !primaryDims ? linkSize : autoSize

    const result = await submitRequest({
      printer_id:     printer.id,
      customer_name:  (form.elements.namedItem('name') as HTMLInputElement).value,
      customer_email: (form.elements.namedItem('email') as HTMLInputElement).value,
      customer_phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      description:    (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      print_type:     derivedPrintType,
      material:       material as FilamentMaterial,
      color:          effectiveColor,
      color_hex:      effectiveColorHex,
      supports:       selectedCaps.has('supports'),
      size:           effectiveSize,
      quality:        quality as PrintQuality,
      deadline:       deadlineValue,
      notes:          dimsPrefix + notesWithQty
                      + (selectedCaps.has('pause_insert') && insertNotes.trim() ? `\nEmbedded inserts: ${insertNotes.trim()}` : '')
                      + (selectedCaps.has('text_on_surface') && surfaceText.trim() ? `\nSurface text: "${surfaceText.trim()}"` : ''),
      model_url:      modelMode === 'link' && modelUrl.trim() ? modelUrl.trim() : null,
      model_title:    ogPreview?.title ?? null,
      model_image:    ogPreview?.image ?? null,
      stl_url:        stlUrls[0] ?? null,
      stl_urls:       stlUrls,
      weight_g:       null,
      print_hours:    null,
      profile_id:     defaultProfile?.id ?? null,
      selected_addons: [...new Set(Array.from(selectedCaps))],
      declined_addons: [...declinedCaps],
      color_preferences: colorPrefs.length ? colorPrefs : undefined,
      fulfillment,
      delivery_address: fulfillment === 'delivery' ? deliveryAddress.trim() || null : null,
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
    modelMode === 'link' ? modelUrl.trim().length > 0 :
    modelMode === 'file' ? (fileItems.length > 0 && allUploaded) :
    false
  const formVisible = modelMode !== null
  const canSubmit   = !!(formVisible && modelReady && quality && material && !pending)

  // Derive size for live estimate (mirrors submitRequest logic)
  const primaryDims   = fileItems.find((i) => i.dimensions)?.dimensions ?? null
  const autoSizeEst: PrintSize = primaryDims
    ? (Math.max(primaryDims.x, primaryDims.y, primaryDims.z) <= 100 ? 'small'
     : Math.max(primaryDims.x, primaryDims.y, primaryDims.z) <= 250 ? 'medium'
     : 'large')
    : 'medium'
  const estimateSize: PrintSize = modelMode === 'link' ? linkSize : autoSizeEst

  function getQualityEstimate(q: PrintQuality) {
    if (!material) return null
    const filamentCosts = printer.filament_costs as Record<string, number> | null
    const cost_per_kg = filamentCosts?.[material] ?? DEFAULT_FILAMENT_COST_PER_KG[material as FilamentMaterial]
    return calculateEstimate({
      size: estimateSize,
      quality: q,
      material: material as FilamentMaterial,
      power_watts: printer.power_watts ?? 200,
      cost_per_kg,
      electricity_rate:      printer.electricity_rate      ?? DEFAULT_ELECTRICITY_RATE,
      markup_percent:        printer.markup_percent        ?? DEFAULT_MARKUP_PERCENT,
      machine_rate_per_hour: printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE,
      waste_percent:         printer.waste_percent         ?? DEFAULT_WASTE_PERCENT,
    })
  }

  const availableCaps = {
    supports:        profiles.some((p) => p.supports_available),
    ironing:         profiles.some((p) => p.ironing_available),
    color_change:    profiles.some((p) => p.color_change_available),
    pause_insert:    profiles.some((p) => p.pause_insert_available),
    fuzzy_skin:      profiles.some((p) => p.fuzzy_skin_available),
    text_on_surface: profiles.some((p) => p.text_on_surface_available),
  }
  const hasAnyCap = Object.values(availableCaps).some(Boolean)

  // Options where the customer may not know what's best — show 3-state control
  const OWNER_DECIDE_CAPS: Record<string, { label: string; desc: string }> = {
    supports:   { label: 'Support structures',   desc: 'Temporary scaffold that holds up overhanging parts — removed after printing. Needed if your model has floating sections or steep overhangs.' },
    ironing:    { label: 'Ironing (smooth top)', desc: 'The nozzle makes a slow second pass over flat top surfaces for an ultra-smooth finish. Adds ~15% to print time.' },
    fuzzy_skin: { label: 'Fuzzy skin texture',   desc: 'Adds a rough, matte, grip-friendly texture to the outer walls. Great for aesthetic effect or ergonomic grip.' },
  }
  // Options that always require a customer decision
  const CUSTOMER_CAPS: Record<string, { label: string; desc: string }> = {
    color_change:    { label: 'Multi-color / AMS',    desc: 'Filament colors switch automatically during printing. Ideal for logos, text, and multi-color designs on a single print.' },
    pause_insert:    { label: 'Embedded inserts',     desc: 'The printer pauses so you can drop in brass heat-set nuts, magnets, or other metal parts before it continues.' },
    text_on_surface: { label: 'Text on surface',      desc: 'The slicer embosses or engraves custom text directly onto the model surface — raised or recessed lettering without editing the original file.' },
  }

  function capState(key: string): 'owner' | 'yes' | 'no' {
    if (selectedCaps.has(key)) return 'yes'
    if (declinedCaps.has(key)) return 'no'
    return 'owner'
  }

  function setCapState(key: string, state: 'owner' | 'yes' | 'no') {
    setSelectedCaps((prev) => {
      const next = new Set(prev)
      if (state === 'yes') {
        next.add(key)
        // ironing / fuzzy_skin conflict
        if (key === 'ironing') next.delete('fuzzy_skin')
        if (key === 'fuzzy_skin') next.delete('ironing')
      } else {
        next.delete(key)
      }
      return next
    })
    setDeclinedCaps((prev) => {
      const next = new Set(prev)
      if (state === 'no') {
        next.add(key)
        if (key === 'ironing') next.delete('fuzzy_skin')
        if (key === 'fuzzy_skin') next.delete('ironing')
      } else {
        next.delete(key)
      }
      return next
    })
  }

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

        {buildVolume && (() => {
          const pv = parseBuildVolume(buildVolume)
          const withDims = fileItems.filter((i) => i.dimensions)
          const oversized = pv ? withDims.filter((i) => !fitsInVolume(i.dimensions!, pv)) : []
          const allFit = pv && withDims.length > 0 && oversized.length === 0

          if (allFit) {
            return (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                <span className="font-bold text-green-500 text-sm">✓</span>
                <span>
                  <span className="font-semibold">Fits on this printer</span>
                  {' '}— build volume {buildVolume}
                </span>
              </div>
            )
          }

          if (oversized.length > 0) {
            return (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <p className="font-semibold mb-0.5">
                  ✗ {oversized.length === 1 ? 'File exceeds' : 'Some files exceed'} this printer&apos;s build volume ({buildVolume})
                </p>
                {oversized.map((i, idx) => {
                  const d = i.dimensions!
                  const largest = Math.max(d.x, d.y, d.z)
                  const printerLargest = pv ? Math.max(pv.x, pv.y, pv.z) : 0
                  return (
                    <p key={i.id} className="text-red-600">
                      {withDims.length > 1 ? `File ${idx + 1}: ` : ''}{d.x} × {d.y} × {d.z} mm
                      {largest > printerLargest && (
                        <span className="ml-1 text-red-500">(largest dim {largest}mm, printer max {printerLargest}mm)</span>
                      )}
                    </p>
                  )
                })}
                <p className="mt-1 text-red-500">The owner may be able to split the model into parts — include a note below.</p>
              </div>
            )
          }

          // No files uploaded yet — static hint
          return (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <Ruler className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              Max print size: <span className="font-medium text-slate-700">{buildVolume}</span> — dimensions will be checked when you upload a file.
            </div>
          )
        })()}

        {modelMode === null && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                mode: 'link' as const,
                icon: Link2,
                title: 'I have a reference',
                desc: 'Share a link to what you want — MakerWorld, Printables, Thingiverse, a product page, or any reference image.',
              },
              {
                mode: 'file' as const,
                icon: FileUp,
                title: 'I have the 3D file',
                desc: 'Upload your own STL, 3MF, or OBJ — modelled yourself or downloaded and ready to print.',
              },
            ].map(({ mode, icon: Icon, title, desc }) => (
              <button key={mode} type="button" onClick={() => pickMode(mode)}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center hover:border-orange-400 hover:bg-orange-50 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
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
                placeholder="https://www.thingiverse.com/thing:... or any reference link" className={`${inputClass} pr-9`} autoFocus />
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

            {modelUrl.trim() && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <Download className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Have the file too? Upload it for a 3D preview</p>
                    <p className="mt-0.5 text-xs text-blue-600">
                      Optional — the link above is enough. If you already downloaded the STL or 3MF, you can drop it here so the owner gets a preview and dimension check.
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
                  onUpdatePartColor={updatePartColor}
                  filaments={filaments}
                  addMoreRef={addInputRef}
                  onDrop={addFiles}
                  onAddMore={addFiles}
                  buildVolume={buildVolume}
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
            onUpdatePartColor={updatePartColor}
            filaments={filaments}
            addMoreRef={addInputRef}
            onDrop={addFiles}
            onAddMore={addFiles}
            buildVolume={buildVolume}
          />
        )}

      </div>

      {/* ── Material, Color, Size ─────────────────────────── */}
      {formVisible && (
        <>
          {/* Material */}
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Material <span className="text-red-500">*</span></h3>
            <p className="mb-3 text-xs text-slate-400">Which filament do you want your print in?</p>
            <div className="space-y-2">
              {printer.materials.map((mat) => (
                <button key={mat} type="button" onClick={() => setMaterial(mat)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${material === mat ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'}`}>
                  <p className={`text-sm font-medium ${material === mat ? 'text-orange-700' : 'text-slate-800'}`}>{MATERIAL_LABELS[mat]}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{MATERIAL_DESCRIPTIONS[mat]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Color</h3>
            <p className="mb-3 text-xs text-slate-400">What color do you want? Leave as &quot;Any&quot; if you&apos;re flexible.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={() => { setRequestColor('Any'); setRequestColorHex('#888888') }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${requestColor === 'Any' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'}`}>
                Any / Owner decides
              </button>
              {COLOR_PRESETS.map(({ name, hex }) => (
                <button key={name} type="button" onClick={() => { setRequestColor(name); setRequestColorHex(hex) }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${requestColor === name ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'}`}>
                  <span className="h-3 w-3 rounded-full border border-slate-200 shrink-0" style={{ background: hex }} />
                  {name}
                </button>
              ))}
            </div>
            {requestColor !== 'Any' && (
              <p className="text-xs text-slate-400">Selected: <span className="font-medium text-slate-700">{requestColor}</span></p>
            )}
          </div>

          {/* Size — only for link mode without file dimensions */}
          {modelMode === 'link' && !fileItems.some((i) => i.dimensions) && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Approximate size</h3>
              <p className="mb-3 text-xs text-slate-400">Best guess — the owner will confirm from the reference.</p>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setLinkSize(s)}
                    className={`rounded-xl border px-3 py-3 text-center transition ${linkSize === s ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
                    <p className="text-sm font-medium capitalize">{s}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{SIZE_LABELS[s].split(' ')[1]}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Sections B + C ───────────────────────────────────── */}
      {formVisible && (
        <>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Finish expectation <span className="text-red-500">*</span></h3>
            <p className="mb-3 text-xs text-slate-400">How important is the surface finish to you? The owner will decide the best settings to achieve it.</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { q: 'functional'  as PrintQuality, label: 'Functional',      desc: 'Shape matters most, minor surface marks are fine',       infill: defaultProfile?.infill_draft    ?? 15 },
                { q: 'presentable' as PrintQuality, label: 'Presentable',     desc: 'Looks good, layer lines acceptable',                     infill: defaultProfile?.infill_standard ?? 25 },
                { q: 'display'     as PrintQuality, label: 'Display quality', desc: 'As smooth as possible, closest to the reference',        infill: defaultProfile?.infill_premium  ?? 40 },
              ]).map(({ q, label, desc, infill }) => {
                const est = getQualityEstimate(q)
                return (
                  <button key={q} type="button" onClick={() => setQuality(q)}
                    className={`rounded-xl border px-3 py-3 text-center transition ${quality === q ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{infill}% infill</p>
                    {est ? (
                      <p className={`text-sm font-semibold mt-1 ${quality === q ? 'text-orange-600' : 'text-slate-600'}`}>
                        ~RM {Math.round(est.suggested_price)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">{desc}</p>
                    )}
                  </button>
                )
              })}
            </div>
            {material && (
              <p className="mt-2 text-[11px] text-slate-400">
                Estimates based on typical {estimateSize} print in {material.toUpperCase()}. Your final quote may differ.
              </p>
            )}
            {!material && (
              <p className="mt-2 text-[11px] text-slate-400">Select a material above to see estimated prices for each tier.</p>
            )}
          </div>

          {/* ── Print options (capabilities) ── */}
          {hasAnyCap && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Print options</h3>
              <p className="mb-3 text-xs text-slate-400">Not sure? Leave on <span className="font-medium text-slate-500">Owner decides</span> — the owner will apply what suits your model best.</p>

              {/* ── Owner-decide options (3-state) ── */}
              {Object.entries(OWNER_DECIDE_CAPS).some(([key]) => availableCaps[key as keyof typeof availableCaps]) && (
                <div className="space-y-2 mb-3">
                  {(Object.entries(OWNER_DECIDE_CAPS) as [string, { label: string; desc: string }][])
                    .filter(([key]) => availableCaps[key as keyof typeof availableCaps])
                    .map(([key, info]) => {
                      const state = capState(key)
                      const conflicted =
                        (key === 'ironing' && capState('fuzzy_skin') === 'yes') ||
                        (key === 'fuzzy_skin' && capState('ironing') === 'yes')
                      return (
                        <div key={key} className={`rounded-xl border px-3 py-2.5 transition ${
                          conflicted ? 'border-slate-100 bg-slate-50 opacity-40' :
                          state === 'yes' ? 'border-orange-300 bg-orange-50' :
                          state === 'no'  ? 'border-slate-200 bg-slate-50' :
                          'border-slate-200 bg-white'
                        }`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm font-medium truncate ${state === 'no' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {info.label}
                              </span>
                              <button
                                type="button"
                                onMouseEnter={(e) => setCapTooltip({ key, x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setCapTooltip(null)}
                                className="shrink-0 text-slate-300 hover:text-slate-500 transition"
                                tabIndex={-1}
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {/* 3-state segmented control */}
                            <div className="flex shrink-0 rounded-lg border border-slate-200 overflow-hidden text-xs">
                              {(['owner', 'yes', 'no'] as const).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  disabled={conflicted}
                                  onClick={() => setCapState(key, s)}
                                  className={`px-2.5 py-1 transition font-medium ${
                                    state === s
                                      ? s === 'yes' ? 'bg-orange-500 text-white'
                                      : s === 'no'  ? 'bg-slate-200 text-slate-600'
                                      : 'bg-slate-100 text-slate-600'
                                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                  } ${s !== 'no' ? 'border-r border-slate-200' : ''}`}
                                >
                                  {s === 'owner' ? 'Owner decides' : s === 'yes' ? 'Yes' : 'No'}
                                </button>
                              ))}
                            </div>
                          </div>
                          {conflicted && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Conflicts with {key === 'ironing' ? 'fuzzy skin' : 'ironing'} — set that to Owner decides first
                            </p>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}

              {/* ── Customer-driven options (binary toggle) ── */}
              <div className="space-y-2">
                {(Object.entries(CUSTOMER_CAPS) as [string, { label: string; desc: string }][])
                  .filter(([key]) => availableCaps[key as keyof typeof availableCaps])
                  .map(([key]) => {
                    const info = CUSTOMER_CAPS[key]
                    const isOn = selectedCaps.has(key)
                    return (
                      <div key={key}>
                        <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                          isOn ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}>
                          {/* Toggle switch */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCaps((prev) => {
                                const next = new Set(prev)
                                if (next.has(key)) next.delete(key)
                                else next.add(key)
                                return next
                              })
                              if (!selectedCaps.has(key) === false) {
                                if (key === 'text_on_surface') setSurfaceText('')
                                if (key === 'pause_insert') setInsertNotes('')
                              }
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                              isOn ? 'bg-orange-500' : 'bg-slate-200'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                          <span className={`flex-1 text-sm ${isOn ? 'font-medium text-orange-800' : 'text-slate-700'}`}>{info.label}</span>
                          <button
                            type="button"
                            onMouseEnter={(e) => setCapTooltip({ key, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setCapTooltip(null)}
                            className="text-slate-300 hover:text-slate-500 transition"
                            tabIndex={-1}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {/* Embedded inserts input */}
                        {key === 'pause_insert' && isOn && (
                          <div className="mt-1.5 ml-12">
                            <input
                              type="text"
                              value={insertNotes}
                              onChange={(e) => setInsertNotes(e.target.value)}
                              placeholder="e.g. 4× M3 heat-set nuts, holes on the bottom face"
                              maxLength={120}
                              className={inputClass}
                            />
                            <p className="mt-1 text-xs text-slate-400">Describe the insert size, quantity, and location — the owner will pause the print at the right layer</p>
                          </div>
                        )}
                        {/* Surface text input */}
                        {key === 'text_on_surface' && isOn && (
                          <div className="mt-1.5 ml-12">
                            <input
                              type="text"
                              value={surfaceText}
                              onChange={(e) => setSurfaceText(e.target.value)}
                              placeholder="e.g. My Name, Hello World, 2024"
                              maxLength={50}
                              className={inputClass}
                            />
                            <p className="mt-1 text-xs text-slate-400">Max 50 characters · the owner will place the text on the model surface</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* Fixed tooltip */}
              {capTooltip && (
                <div
                  style={{
                    position: 'fixed',
                    left: capTooltip.x,
                    top: capTooltip.y,
                    transform: 'translate(-50%, calc(-100% - 8px))',
                    zIndex: 9999,
                  }}
                  className="pointer-events-none rounded-lg bg-slate-800 px-3 py-2 text-[11px] leading-snug text-white shadow-xl max-w-[220px] text-center"
                >
                  <strong className="block mb-0.5">{(OWNER_DECIDE_CAPS[capTooltip.key] ?? CUSTOMER_CAPS[capTooltip.key])?.label}</strong>
                  {(OWNER_DECIDE_CAPS[capTooltip.key] ?? CUSTOMER_CAPS[capTooltip.key])?.desc}
                  <div style={{
                    position: 'absolute', left: '50%', top: '100%',
                    transform: 'translateX(-50%)', width: 0, height: 0,
                    borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                    borderTop: '5px solid #1e293b',
                  }} />
                </div>
              )}
            </div>
          )}

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

          {/* ── Pickup or Delivery ── */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">How will you receive your order?</h3>
            <div className={`grid gap-2 ${printer.delivery_available ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                onClick={() => setFulfillment('pickup')}
                className={`rounded-xl border p-3 text-left transition ${
                  fulfillment === 'pickup'
                    ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                    : 'border-slate-200 bg-white hover:border-orange-200'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">Pickup</p>
                {printer.pickup_address
                  ? <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{printer.pickup_address}</p>
                  : <p className="mt-0.5 text-xs text-slate-400">Collect from owner's location</p>}
              </button>
              {printer.delivery_available && (
                <button
                  type="button"
                  onClick={() => setFulfillment('delivery')}
                  className={`rounded-xl border p-3 text-left transition ${
                    fulfillment === 'delivery'
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                      : 'border-slate-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">Delivery</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    RM {Number(printer.delivery_rate_per_km ?? 1.00).toFixed(2)}/km · fee based on distance
                  </p>
                </button>
              )}
            </div>
            {fulfillment === 'delivery' && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Delivery address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    required
                    rows={2}
                    placeholder="Full address including postcode and city"
                    className={`${inputClass} resize-none`}
                  />
                </div>
                {deliveryGeoLoading && (
                  <p className="text-xs text-slate-400">Estimating distance…</p>
                )}
                {deliveryEstimate && !deliveryGeoLoading && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                    <span>📍</span>
                    <span>
                      ~{deliveryEstimate.km} km from owner ·{' '}
                      <strong>est. RM {deliveryEstimate.fee.toFixed(2)} delivery fee</strong>
                      <span className="ml-1 text-green-500">(at RM {Number(printer.delivery_rate_per_km ?? 1.00).toFixed(2)}/km)</span>
                    </span>
                  </div>
                )}
                {deliveryGeoError && !deliveryGeoLoading && (
                  <p className="text-xs text-amber-600">{deliveryGeoError}</p>
                )}
              </div>
            )}
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
