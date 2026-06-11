'use client'

import { useEffect, useRef, useState } from 'react'
import { Crosshair, Maximize2, Minimize2 } from 'lucide-react'
import { WebGLPreview } from 'gcode-preview'

type ViewMode = 'full' | 'model'

const SUPPORT_GREEN = '#4ade80'

// Detects support section boundaries — same markers used by filterSupports & tagSupportTool.
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

// Injects T1 / T0 tool-change markers around support sections so the renderer
// can colour them separately via the extrusionColor array.
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

// Strips extrusion (E) from support moves so they render as invisible travels.
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
}

export default function GcodeViewer({ urls, colors, className }: Props) {
  const mountRef     = useRef<HTMLDivElement>(null)
  const fullViewRef  = useRef<RenderedView | null>(null)
  const modelViewRef = useRef<RenderedView | null>(null)
  // Keep latest viewMode readable inside the async effect without adding it as a dep
  const viewModeRef  = useRef<ViewMode>('full')

  const [activeIdx,   setActiveIdx]   = useState(0)
  const [started,     setStarted]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [status,      setStatus]      = useState('')
  const [error,       setError]       = useState('')
  const [hasSupports, setHasSupports] = useState<boolean | null>(null)
  const [expanded,    setExpanded]    = useState(false)
  const [viewMode,    setViewMode]    = useState<ViewMode>('full')

  viewModeRef.current = viewMode   // always up-to-date, safe to read in the effect

  // ── Download + pre-render both views ────────────────────────────────────────
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
    setStatus('Downloading G-code… (this may take a moment)')

    let aborted = false

    function makeCanvas(onTop: boolean): HTMLCanvasElement {
      const c = document.createElement('canvas')
      c.width  = mount!.clientWidth  || 480
      c.height = mount!.clientHeight || 480
      // Both canvases are always display:block so clientWidth/Height stays correct
      // for WebGL viewport setup. z-index controls which one is visible on top.
      c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;z-index:${onTop ? 1 : 0}`
      mount!.appendChild(c)
      return c
    }

    function makePreview(canvas: HTMLCanvasElement, extrusionColor: string | string[]): WebGLPreview {
      return new WebGLPreview({
        canvas,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extrusionColor:  extrusionColor as any,   // library accepts arrays (T0/T1 tool indexing)
        backgroundColor: '#0f172a',
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

        const color = colors?.[activeIdx] || '#e07820'

        const supportsFound = (
          /;TYPE:Support/i.test(gcode)         ||
          /;MESH:SUPPORT/i.test(gcode)          ||
          /;SUPPORT_INTERFACE_START/i.test(gcode)
        )
        setHasSupports(supportsFound)

        // ── Full view (always rendered) ────────────────────────────────
        setStatus('Rendering…')
        await new Promise<void>((r) => setTimeout(r, 0))
        if (aborted) return

        // Full view on top when: no supports, or user is already in 'full' mode
        const fullOnTop   = !supportsFound || viewModeRef.current === 'full'
        const fullCanvas  = makeCanvas(fullOnTop)
        // When supports exist: inject T1/T0 markers so supports render in green
        const fullColor   = supportsFound ? [color, SUPPORT_GREEN] : color
        const fullGcode   = supportsFound ? tagSupportTool(gcode) : gcode
        const fullPreview = makePreview(fullCanvas, fullColor)
        fullPreview.processGCode(fullGcode)
        fullPreview.render()
        fullPreview.controls.saveState()
        fullViewRef.current = { canvas: fullCanvas, preview: fullPreview }

        if (!supportsFound) {
          setLoading(false)
          return
        }

        // ── Model-only view (supports stripped, pre-rendered for instant toggle) ──
        setStatus('Preparing model-only view…')
        await new Promise<void>((r) => setTimeout(r, 0))
        if (aborted) return

        const modelCanvas  = makeCanvas(viewModeRef.current === 'model'  /* on top if already in model mode */)
        const modelPreview = makePreview(modelCanvas, color)
        modelPreview.processGCode(filterSupports(gcode))
        modelPreview.render()
        modelPreview.controls.saveState()
        modelViewRef.current = { canvas: modelCanvas, preview: modelPreview }

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
      for (const r of [fullViewRef, modelViewRef]) {
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

  // ── Instant toggle — swap z-index, no re-render needed ─────────────────────
  function switchMode(mode: ViewMode) {
    if (mode === viewMode) return
    setViewMode(mode)
    const full  = fullViewRef.current?.canvas
    const model = modelViewRef.current?.canvas
    if (!full || !model) return
    full.style.zIndex  = mode === 'full'  ? '1' : '0'
    model.style.zIndex = mode === 'model' ? '1' : '0'
  }

  function handleResetView() {
    const active = (viewMode === 'model' ? modelViewRef : fullViewRef).current
    if (!active) return
    active.preview.controls.reset()
    active.preview.render()
  }

  const heightClass = expanded ? 'h-[520px]' : 'h-[360px]'
  const isLoaded    = started && !loading && !error

  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-900 ${heightClass} ${className ?? ''}`}>
      {/* Canvas mount — position:relative so absolute-positioned canvases anchor here */}
      <div ref={mountRef} className="relative w-full h-full" />

      {/* ── Click-to-load gate ── */}
      {!started && !loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <p className="text-xs text-slate-400 text-center px-6">
            G-code 3D preview — loads the full file (~5–50 MB).<br />
            May take a few seconds depending on file size.
          </p>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
          >
            Load 3D Preview
          </button>
        </div>
      )}

      {/* ── Plate tabs (top-left) ── */}
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        {urls.map((_, i) => (
          <button
            key={i}
            type="button"
            disabled={urls.length === 1}
            onClick={() => { setActiveIdx(i); setStarted(false) }}
            className={`rounded-full px-2 py-0.5 text-xs font-medium shadow-sm transition ${
              activeIdx === i
                ? 'bg-orange-500 text-white'
                : urls.length === 1
                ? 'bg-white/80 text-slate-500 cursor-default'
                : 'bg-white/90 text-slate-600 hover:bg-white'
            }`}
          >
            Plate {i + 1}
          </button>
        ))}
      </div>

      {/* ── View mode toggle — only when supports exist and loaded ── */}
      {isLoaded && hasSupports && (
        <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
          <div className="flex rounded-lg overflow-hidden shadow border border-white/10">
            <button
              type="button"
              onClick={() => switchMode('model')}
              title="Hide support structures — shows how your model will look after printing"
              className={`px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'model'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/90 text-slate-600 hover:bg-white'
              }`}
            >
              Model only
            </button>
            <button
              type="button"
              onClick={() => switchMode('full')}
              title="Show all print paths including support structures"
              className={`px-2.5 py-1 text-xs font-semibold transition border-l border-white/20 ${
                viewMode === 'full'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/90 text-slate-600 hover:bg-white'
              }`}
            >
              Full print
            </button>
          </div>
          {viewMode === 'full' && (
            <div className="flex items-center gap-2 justify-end">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-[#4ade80] inline-block" /> supports
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── No-support badge ── */}
      {isLoaded && hasSupports === false && (
        <div className="absolute top-2 right-2 z-10 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 shadow-sm">
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
        <p className="absolute bottom-2 right-3 text-[10px] text-slate-500 select-none pointer-events-none">
          Drag to rotate · scroll to zoom · right-drag to pan
        </p>
      )}

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-orange-500" />
            <span className="text-xs text-slate-400">{status}</span>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
          <p className="text-xs text-slate-500 px-4 text-center">{error}</p>
        </div>
      )}
    </div>
  )
}
