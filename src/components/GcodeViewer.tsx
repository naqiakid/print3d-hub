'use client'

import { useEffect, useRef, useState } from 'react'
import { Crosshair, Maximize2, Minimize2, Palette, Sparkles, Layers } from 'lucide-react'
import { WebGLPreview } from 'gcode-preview'

export type ViewMode = 'features' | 'filament' | 'model'

export const SUPPORT_GREEN = '#22c55e'

// Slicer feature definitions and color mapping
export const FEATURE_DEFS = {
  outerWall: { tool: 'T0', color: '#f97316', label: 'Outer Wall' },
  innerWall: { tool: 'T1', color: '#eab308', label: 'Inner Wall' },
  infill:    { tool: 'T2', color: '#a855f7', label: 'Infill' },
  solid:     { tool: 'T3', color: '#3b82f6', label: 'Solid Surface' },
  support:   { tool: 'T4', color: '#22c55e', label: 'Support' },
  brim:      { tool: 'T5', color: '#06b6d4', label: 'Brim / Skirt' },
  bridge:    { tool: 'T6', color: '#ec4899', label: 'Bridge' },
  other:     { tool: 'T7', color: '#94a3b8', label: 'Other' },
} as const

export type FeatureKey = keyof typeof FEATURE_DEFS

// Array of 8 extrusion colors mapping directly to tools T0 through T7
export const FEATURE_EXTRUSION_COLORS: string[] = [
  FEATURE_DEFS.outerWall.color, // T0
  FEATURE_DEFS.innerWall.color, // T1
  FEATURE_DEFS.infill.color,    // T2
  FEATURE_DEFS.solid.color,     // T3
  FEATURE_DEFS.support.color,   // T4
  FEATURE_DEFS.brim.color,      // T5
  FEATURE_DEFS.bridge.color,    // T6
  FEATURE_DEFS.other.color,     // T7
]

// Classifies slicer feature comments (OrcaSlicer, Bambu Studio, PrusaSlicer, Cura)
function classifyFeature(line: string): FeatureKey | null {
  const t = line.trim()
  if (/^;+\s*TYPE\s*:/i.test(t) || /^;MESH:/i.test(t) || /^;SUPPORT_INTERFACE/i.test(t)) {
    if (/support/i.test(t) || t === ';MESH:SUPPORT' || t === ';SUPPORT_INTERFACE_START') {
      return 'support'
    }
    if (/brim|skirt/i.test(t)) {
      return 'brim'
    }
    if (/outer\s*wall|external\s*perimeter|wall-outer/i.test(t)) {
      return 'outerWall'
    }
    if (/inner\s*wall|overhang|perimeter|wall-inner/i.test(t)) {
      return 'innerWall'
    }
    if (/sparse\s*infill|internal\s*infill|fill\b/i.test(t)) {
      return 'infill'
    }
    if (/solid|top\s*surface|bottom\s*surface|skin|ironing/i.test(t)) {
      return 'solid'
    }
    if (/bridge/i.test(t)) {
      return 'bridge'
    }
    return 'other'
  }
  return null
}

// Injects T0..T7 tool change commands according to slicer feature annotations
function tagGcodeFeatures(gcode: string): { tagged: string; detected: FeatureKey[] } {
  const lines = gcode.split('\n')
  const result: string[] = []
  let currentTool: string | null = null
  const detected = new Set<FeatureKey>()

  for (const line of lines) {
    const feature = classifyFeature(line)
    if (feature) {
      detected.add(feature)
      const targetTool = FEATURE_DEFS[feature].tool
      if (targetTool !== currentTool) {
        result.push(line)
        result.push(targetTool)
        currentTool = targetTool
        continue
      }
    }
    result.push(line)
  }

  // Preserve ordered list of detected features
  const orderedKeys: FeatureKey[] = [
    'outerWall',
    'innerWall',
    'infill',
    'solid',
    'support',
    'brim',
    'bridge',
    'other',
  ]
  const presentFeatures = orderedKeys.filter((k) => detected.has(k))

  return { tagged: result.join('\n'), detected: presentFeatures }
}

// Detects support section boundaries
function isStartOfSupport(trimmed: string) {
  return (
    (/^;+\s*TYPE\s*:/i.test(trimmed) && /support/i.test(trimmed)) ||
    trimmed === ';MESH:SUPPORT' ||
    trimmed === ';SUPPORT_INTERFACE_START'
  )
}
function isEndOfSupport(trimmed: string) {
  return (
    (/^;+\s*TYPE\s*:/i.test(trimmed) && !/support/i.test(trimmed)) ||
    (/^;MESH:/i.test(trimmed) && trimmed !== ';MESH:SUPPORT') ||
    trimmed === ';SUPPORT_INTERFACE_END'
  )
}

// Injects T1 / T0 tool-change markers around support sections for filament view
function tagSupportTool(gcode: string): string {
  const lines  = gcode.split('\n')
  const result: string[] = []
  let inSupport = false

  for (const line of lines) {
    const t = line.trim()
    result.push(line)

    if (!inSupport && isStartOfSupport(t)) {
      result.push('T1')
      inSupport = true
    } else if (inSupport && isEndOfSupport(t)) {
      result.push('T0')
      inSupport = false
    }
  }

  return result.join('\n')
}

// Strips extrusion (E) from support moves so they render as invisible travels
function filterSupports(gcode: string): string {
  const lines  = gcode.split('\n')
  const result: string[] = []
  let inSupport = false

  for (const line of lines) {
    const t = line.trim()

    if (!inSupport && isStartOfSupport(t)) inSupport = true
    else if (inSupport && isEndOfSupport(t)) inSupport = false

    if (inSupport && /^G[0-3]\s/i.test(t) && /\bE[\d.e+\-]+/i.test(t)) {
      result.push(t.replace(/\s*E[\d.e+\-]+/gi, ''))
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

type RenderedView = { canvas: HTMLCanvasElement; preview: WebGLPreview }

type Props = {
  urls: string[]
  colors?: string[]
  className?: string
  baseHeight?: string   // overrides the default collapsed height
  autoStart?: boolean
}

export default function GcodeViewer({ urls, colors, className, baseHeight, autoStart = false }: Props) {
  const mountRef         = useRef<HTMLDivElement>(null)
  const featuresViewRef  = useRef<RenderedView | null>(null)
  const filamentViewRef  = useRef<RenderedView | null>(null)
  const modelViewRef     = useRef<RenderedView | null>(null)
  const viewModeRef      = useRef<ViewMode>('features')

  const [activeIdx,         setActiveIdx]         = useState(0)
  const [started,           setStarted]           = useState(autoStart)
  const [loading,           setLoading]           = useState(false)
  const [status,            setStatus]            = useState('')
  const [error,             setError]             = useState('')
  const [hasSupports,       setHasSupports]       = useState<boolean | null>(null)
  const [detectedFeatures,  setDetectedFeatures]  = useState<FeatureKey[]>([])
  const [expanded,          setExpanded]          = useState(false)
  const [viewMode,          setViewMode]          = useState<ViewMode>('features')

  viewModeRef.current = viewMode

  // ── Download + pre-render views ─────────────────────────────────────────────
  useEffect(() => {
    if (!started) return
    const mount = mountRef.current
    const url   = urls[activeIdx]
    if (!mount || !url) return

    if (/\.bgcode$/i.test(url)) {
      setError('3D preview not available for binary .bgcode files')
      return
    }

    setLoading(true)
    setError('')
    setHasSupports(null)
    setDetectedFeatures([])
    setStatus('Downloading G-code… (this may take a moment)')

    let aborted = false

    function makeCanvas(onTop: boolean): HTMLCanvasElement {
      const c = document.createElement('canvas')
      c.width  = mount!.clientWidth  || 480
      c.height = mount!.clientHeight || 480
      c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;z-index:${onTop ? 1 : 0}`
      mount!.appendChild(c)
      return c
    }

    function makePreview(canvas: HTMLCanvasElement, extrusionColor: string | string[]): WebGLPreview {
      return new WebGLPreview({
        canvas,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extrusionColor:  extrusionColor as any,
        backgroundColor: '#2e4a62',
        renderTravel:    false,
        renderTubes:     true,
      })
    }

    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const gcode = await res.text()
        if (aborted) return

        const filamentColor = colors?.[activeIdx] || '#f97316'

        const supportsFound = (
          /;TYPE:Support/i.test(gcode)          ||
          /;MESH:SUPPORT/i.test(gcode)          ||
          /;SUPPORT_INTERFACE_START/i.test(gcode)
        )
        setHasSupports(supportsFound)

        // Process feature classifications
        const { tagged, detected } = tagGcodeFeatures(gcode)
        setDetectedFeatures(detected)

        // ── 1. Features view (slicer color-coded toolpaths) ─────────────────
        setStatus('Rendering slicer features…')
        await new Promise<void>((r) => setTimeout(r, 0))
        if (aborted) return

        const featuresOnTop   = viewModeRef.current === 'features'
        const featuresCanvas  = makeCanvas(featuresOnTop)
        const featuresPreview = makePreview(featuresCanvas, FEATURE_EXTRUSION_COLORS)
        featuresPreview.processGCode(tagged)
        featuresPreview.render()
        featuresPreview.controls.saveState()
        featuresViewRef.current = { canvas: featuresCanvas, preview: featuresPreview }

        // ── 2. Filament view (material color with supports highlighted) ─────
        setStatus('Preparing filament view…')
        await new Promise<void>((r) => setTimeout(r, 0))
        if (aborted) return

        const filamentOnTop   = viewModeRef.current === 'filament'
        const filamentCanvas  = makeCanvas(filamentOnTop)
        const filamentColors  = supportsFound ? [filamentColor, SUPPORT_GREEN] : filamentColor
        const filamentGcode   = supportsFound ? tagSupportTool(gcode) : gcode
        const filamentPreview = makePreview(filamentCanvas, filamentColors)
        filamentPreview.processGCode(filamentGcode)
        filamentPreview.render()
        filamentPreview.controls.saveState()
        filamentViewRef.current = { canvas: filamentCanvas, preview: filamentPreview }

        // ── 3. Model-only view (supports removed, if applicable) ────────────
        if (supportsFound) {
          setStatus('Preparing model-only view…')
          await new Promise<void>((r) => setTimeout(r, 0))
          if (aborted) return

          const modelOnTop   = viewModeRef.current === 'model'
          const modelCanvas  = makeCanvas(modelOnTop)
          const modelPreview = makePreview(modelCanvas, filamentColor)
          modelPreview.processGCode(filterSupports(gcode))
          modelPreview.render()
          modelPreview.controls.saveState()
          modelViewRef.current = { canvas: modelCanvas, preview: modelPreview }
        }

        setLoading(false)
      } catch {
        if (!aborted) {
          setError('Could not load G-code preview')
          setLoading(false)
        }
      }
    })()

    return () => {
      aborted = true
      for (const r of [featuresViewRef, filamentViewRef, modelViewRef]) {
        if (r.current) {
          try { r.current.preview.renderer?.dispose() } catch {}
          try { r.current.preview.controls?.dispose() } catch {}
          if (mount.contains(r.current.canvas)) mount.removeChild(r.current.canvas)
          r.current = null
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, activeIdx, urls.join(','), (colors ?? []).join(',')])

  // ── Instant toggle with camera synchronization ──────────────────────────────
  function switchMode(newMode: ViewMode) {
    if (newMode === viewMode) return

    const currentView =
      viewMode === 'features' ? featuresViewRef.current :
      viewMode === 'filament' ? filamentViewRef.current :
      modelViewRef.current

    const targetView =
      newMode === 'features' ? featuresViewRef.current :
      newMode === 'filament' ? filamentViewRef.current :
      modelViewRef.current

    if (currentView?.preview && targetView?.preview) {
      try {
        targetView.preview.camera.position.copy(currentView.preview.camera.position)
        targetView.preview.camera.quaternion.copy(currentView.preview.camera.quaternion)
        targetView.preview.controls.target.copy(currentView.preview.controls.target)
        targetView.preview.controls.update()
        targetView.preview.render()
      } catch {}
    }

    if (featuresViewRef.current) {
      featuresViewRef.current.canvas.style.zIndex = newMode === 'features' ? '1' : '0'
    }
    if (filamentViewRef.current) {
      filamentViewRef.current.canvas.style.zIndex = newMode === 'filament' ? '1' : '0'
    }
    if (modelViewRef.current) {
      modelViewRef.current.canvas.style.zIndex = newMode === 'model' ? '1' : '0'
    }

    setViewMode(newMode)
  }

  function handleResetView() {
    const active =
      viewMode === 'features' ? featuresViewRef.current :
      viewMode === 'filament' ? filamentViewRef.current :
      modelViewRef.current

    if (!active) return
    active.preview.controls.reset()
    active.preview.render()
  }

  const heightClass = expanded ? 'h-[540px]' : (baseHeight ?? 'h-[360px]')
  const isLoaded    = started && !loading && !error

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#2e4a62] ${heightClass} ${className ?? ''}`}>
      {/* Canvas mount */}
      <div ref={mountRef} className="relative w-full h-full" />

      {/* ── Click-to-load gate ── */}
      {!started && !loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <p className="text-xs text-slate-400 text-center px-6">
            G-code 3D preview — loads full toolpath data with slicer colors.<br />
            May take a moment depending on file size.
          </p>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition active:scale-95"
          >
            <Palette className="h-4 w-4" />
            Load 3D Slicer Preview
          </button>
        </div>
      )}

      {/* ── Plate tabs (top-left) ── */}
      <div className="absolute top-2 left-2 z-20 flex gap-1">
        {urls.map((_, i) => (
          <button
            key={i}
            type="button"
            disabled={urls.length === 1}
            onClick={() => { setActiveIdx(i); setStarted(false) }}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm transition ${
              activeIdx === i
                ? 'bg-orange-500 text-white shadow-orange-500/30'
                : urls.length === 1
                ? 'bg-white/80 text-slate-500 cursor-default'
                : 'bg-white/90 text-slate-600 hover:bg-white'
            }`}
          >
            Plate {i + 1}
          </button>
        ))}
      </div>

      {/* ── View Mode Switcher (top-right) ── */}
      {isLoaded && (
        <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1.5">
          <div className="flex rounded-lg overflow-hidden shadow-md border border-white/10 bg-slate-900/80 backdrop-blur-md">
            <button
              type="button"
              onClick={() => switchMode('features')}
              title="Show line types in distinct slicer colors (outer wall, infill, supports, brim)"
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'features'
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Features</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('filament')}
              title="Show in filament material color"
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition border-l border-white/10 ${
                viewMode === 'filament'
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Filament</span>
            </button>
            {hasSupports && (
              <button
                type="button"
                onClick={() => switchMode('model')}
                title="Hide support structures to see finished model"
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition border-l border-white/10 ${
                  viewMode === 'model'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Model Only</span>
              </button>
            )}
          </div>

          {/* Filament mode sub-legend */}
          {viewMode === 'filament' && hasSupports && (
            <div className="flex items-center gap-1 text-[10px] text-slate-300 bg-slate-900/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              <span>Supports (green)</span>
            </div>
          )}
        </div>
      )}

      {/* ── Slicer Line-Type Color Legend (interactive bottom/top overlay) ── */}
      {isLoaded && viewMode === 'features' && detectedFeatures.length > 0 && (
        <div className="absolute top-10 left-2 z-10 flex flex-wrap items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 shadow-lg max-w-[calc(100%-16px)] sm:max-w-[70%]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden xs:inline">
            Toolpath:
          </span>
          {detectedFeatures.map((key) => {
            const def = FEATURE_DEFS[key]
            if (!def) return null
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-200 bg-white/5 hover:bg-white/15 px-1.5 py-0.5 rounded transition cursor-default"
                title={`${def.label}`}
              >
                <span
                  className="h-2 w-2 rounded-full shadow-sm flex-shrink-0"
                  style={{ backgroundColor: def.color }}
                />
                <span className="whitespace-nowrap">{def.label}</span>
              </span>
            )
          })}
        </div>
      )}

      {/* ── No-support badge ── */}
      {isLoaded && hasSupports === false && viewMode !== 'features' && (
        <div className="absolute top-11 right-2 z-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 shadow-sm">
          ✓ No support structures
        </div>
      )}

      {/* ── Bottom toolbar ── */}
      {isLoaded && (
        <div className="absolute bottom-2 left-2 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={handleResetView}
            title="Fit to object"
            className="flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-white hover:text-orange-500 transition"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Fit view
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-white hover:text-orange-500 transition"
          >
            {expanded
              ? <><Minimize2 className="h-3.5 w-3.5" /> Collapse</>
              : <><Maximize2 className="h-3.5 w-3.5" /> Expand</>}
          </button>
        </div>
      )}

      {/* ── Rotate hint ── */}
      {isLoaded && (
        <p className="absolute bottom-2 right-3 text-[10px] text-slate-400 select-none pointer-events-none hidden sm:block">
          Drag to rotate · scroll to zoom · right-drag to pan
        </p>
      )}

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#2e4a62]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-orange-500" />
            <span className="text-xs text-slate-300">{status}</span>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#2e4a62]">
          <p className="text-xs text-slate-400 px-4 text-center">{error}</p>
        </div>
      )}
    </div>
  )
}
