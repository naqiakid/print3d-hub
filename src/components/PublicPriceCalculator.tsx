'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileCode2, Info, ChevronRight, HelpCircle, Loader2, Sparkles, Check, AlertCircle, Trash2, Plus } from 'lucide-react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { useRouter } from 'next/navigation'
import type { RequestPrinterView, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import { calculateEstimate, DEFAULT_ELECTRICITY_RATE, DEFAULT_MACHINE_RATE } from '@/lib/pricing'
import { verifyAffiliateCode } from '@/lib/actions'

interface Props {
  printer: RequestPrinterView
  filaments: Filament[]
}

// Estimates the signed volume of a buffer geometry in mm^3
function calculateSTLVolume(geometry: THREE.BufferGeometry): number {
  let volume = 0
  const position = geometry.attributes.position
  if (!position) return 0
  
  const count = position.count
  for (let i = 0; i < count; i += 3) {
    const x1 = position.getX(i + 0)
    const y1 = position.getY(i + 0)
    const z1 = position.getZ(i + 0)
    
    const x2 = position.getX(i + 1)
    const y2 = position.getY(i + 1)
    const z2 = position.getZ(i + 1)
    
    const x3 = position.getX(i + 2)
    const y3 = position.getY(i + 2)
    const z3 = position.getZ(i + 2)
    
    volume += (
      -x3 * y2 * z1 +
      x2 * y3 * z1 +
      x3 * y1 * z2 -
      x1 * y3 * z2 -
      x2 * y1 * z3 +
      x1 * y2 * z3
    ) / 6.0
  }
  return Math.abs(volume)
}

function ModelPreview({ geometry, group }: { geometry: THREE.BufferGeometry | null; group: THREE.Group | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || (!geometry && !group)) return

    const width = canvas.clientWidth || 300
    const height = canvas.clientHeight || 200

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    let activeObject: THREE.Object3D | null = null
    let maxDim = 100

    if (geometry) {
      geometry.center()
      const material = new THREE.MeshNormalMaterial()
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)
      activeObject = mesh

      geometry.computeBoundingBox()
      const box = geometry.boundingBox
      if (box) {
        const size = new THREE.Vector3()
        box.getSize(size)
        maxDim = Math.max(size.x, size.y, size.z)
      }
    } else if (group) {
      // Clone group to avoid modifying original reference in case of multiple mounts
      const groupClone = group.clone()
      const box = new THREE.Box3().setFromObject(groupClone)
      const center = new THREE.Vector3()
      box.getCenter(center)
      groupClone.position.sub(center)

      groupClone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshNormalMaterial()
        }
      })
      scene.add(groupClone)
      activeObject = groupClone

      const size = new THREE.Vector3()
      box.getSize(size)
      maxDim = Math.max(size.x, size.y, size.z)
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dirLight.position.set(10, 10, 10)
    scene.add(dirLight)

    const distance = maxDim * 1.8
    camera.position.set(distance, distance, distance)
    camera.lookAt(0, 0, 0)

    let animationFrameId: number
    const animate = () => {
      if (activeObject) {
        activeObject.rotation.y += 0.015
        activeObject.rotation.x += 0.008
      }
      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(animate)
    }
    animate()

    const resizeObserver = new ResizeObserver(() => {
      if (!canvas) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(canvas)

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      renderer.dispose()
    }
  }, [geometry, group])

  return (
    <div className="relative w-full aspect-square md:aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute bottom-2 left-2 rounded bg-slate-900/60 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
        3D Model Preview
      </div>
    </div>
  )
}

interface SlicedItem {
  id: string
  file: File
  dimensions: { x: number; y: number; z: number }
  volumeCc: number
  geometry: THREE.BufferGeometry | null
  group: THREE.Group | null
}

export default function PublicPriceCalculator({ printer, filaments }: Props) {
  const router = useRouter()
  const [slicedItems, setSlicedItems] = useState<SlicedItem[]>([])
  const [parsing, setParsing] = useState(false)
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Options
  const availableMaterials = Object.keys(printer.filament_costs || {}).filter(
    (m) => (printer.filament_costs || {})[m as FilamentMaterial] != null
  ) as FilamentMaterial[]
  const [selectedMaterial, setSelectedMaterial] = useState<FilamentMaterial>(
    availableMaterials[0] ?? 'pla'
  )
  const [infill, setInfill] = useState(15)
  const [nozzle, setNozzle] = useState(0.4)

  // Affiliate/Promo States
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [activePromo, setActivePromo] = useState<{ code: string; discount_pct: number } | null>(null)
  const [verifyingPromo, setVerifyingPromo] = useState(false)
  const [promoError, setPromoError] = useState('')

  // Load from session storage / local storage on mount
  useEffect(() => {
    const storedCode = sessionStorage.getItem('active_affiliate_code') || localStorage.getItem('affiliate_code')
    if (storedCode) {
      setPromoCodeInput(storedCode)
      handleApplyPromo(storedCode)
    }
  }, [])

  const handleApplyPromo = async (codeToVerify?: string) => {
    const code = (codeToVerify ?? promoCodeInput).trim().toUpperCase()
    if (!code) return

    setVerifyingPromo(true)
    setPromoError('')

    const res = await verifyAffiliateCode(code, printer.id)
    setVerifyingPromo(false)

    if ('error' in res) {
      setPromoError(res.error)
      setActivePromo(null)
    } else {
      setActivePromo({
        code: res.code,
        discount_pct: res.discount_pct
      })
      sessionStorage.setItem('active_affiliate_code', res.code)
    }
  }

  const handleRemovePromo = () => {
    setActivePromo(null)
    setPromoCodeInput('')
    setPromoError('')
    sessionStorage.removeItem('active_affiliate_code')
  }

  const handleProceedToOrder = (e: React.MouseEvent) => {
    e.preventDefault()
    if (slicedItems.length === 0) return

    if (typeof window !== 'undefined') {
      (window as any).__pendingRequestFiles = slicedItems.map((item) => item.file);
      (window as any).__pendingRequestParams = {
        material: selectedMaterial,
        infill: infill,
      }
    }

    router.push(`/request/${printer.id}`)
  }

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileList = Array.from(files)

    // Filter valid files
    const validFiles = fileList.filter((f) => {
      const ext = f.name.toLowerCase().split('.').pop()
      if (ext !== 'stl' && ext !== 'obj' && ext !== '3mf') {
        alert(`File format for "${f.name}" is not supported. Upload .stl, .obj, or .3mf.`)
        return false
      }
      if (f.size > 50 * 1024 * 1024) {
        alert(`File "${f.name}" exceeds the 50MB maximum size limit.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    setParsing(true)
    
    // Parse files sequentially
    for (const f of validFiles) {
      const ext = f.name.toLowerCase().split('.').pop()
      const newId = crypto.randomUUID()

      if (ext === 'obj') {
        // Fallback mock stats for OBJ files
        const newItem: SlicedItem = {
          id: newId,
          file: f,
          dimensions: { x: 75, y: 75, z: 75 },
          volumeCc: 50,
          geometry: null,
          group: null,
        }
        setSlicedItems((prev) => [...prev, newItem])
        setActivePreviewId((prev) => prev ?? newId)
      } else if (ext === '3mf') {
        try {
          const arrayBuffer = await f.arrayBuffer()
          const loader = new ThreeMFLoader()
          const group = loader.parse(arrayBuffer)

          // Calculate dimensions
          const box = new THREE.Box3().setFromObject(group)
          const size = new THREE.Vector3()
          box.getSize(size)
          const dims = {
            x: Math.round(size.x * 10) / 10,
            y: Math.round(size.y * 10) / 10,
            z: Math.round(size.z * 10) / 10,
          }

          // Calculate volume
          let totalVolumeMm3 = 0
          group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              let vol = calculateSTLVolume(child.geometry)
              vol *= Math.abs(child.scale.x * child.scale.y * child.scale.z)
              totalVolumeMm3 += vol
            }
          })
          const volumeCc = totalVolumeMm3 / 1000

          const newItem: SlicedItem = {
            id: newId,
            file: f,
            dimensions: dims,
            volumeCc: volumeCc || 50, // fallback if 0
            geometry: null,
            group: group,
          }
          setSlicedItems((prev) => [...prev, newItem])
          setActivePreviewId((prev) => prev ?? newId)
        } catch (err) {
          console.error(`Failed to parse 3MF file "${f.name}":`, err)
          alert(`Error parsing 3MF file "${f.name}". Ensure it is not corrupted.`)
        }
      } else {
        // Parse STL
        try {
          const arrayBuffer = await f.arrayBuffer()
          const loader = new STLLoader()
          const geometry = loader.parse(arrayBuffer)
          
          geometry.computeBoundingBox()
          const box = geometry.boundingBox
          let dims = { x: 50, y: 50, z: 50 }
          if (box) {
            const size = new THREE.Vector3()
            box.getSize(size)
            dims = {
              x: Math.round(size.x * 10) / 10,
              y: Math.round(size.y * 10) / 10,
              z: Math.round(size.z * 10) / 10,
            }
          }

          const volumeMm3 = calculateSTLVolume(geometry)
          const newItem: SlicedItem = {
            id: newId,
            file: f,
            dimensions: dims,
            volumeCc: volumeMm3 / 1000,
            geometry,
            group: null,
          }
          setSlicedItems((prev) => [...prev, newItem])
          setActivePreviewId((prev) => prev ?? newId)
        } catch (err) {
          console.error(`Failed to parse STL file "${f.name}":`, err)
          alert(`Error parsing STL file "${f.name}". Ensure it is not corrupted.`)
        }
      }
    }
    setParsing(false)
  }

  const handleRemoveItem = (id: string) => {
    setSlicedItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.geometry) {
        target.geometry.dispose()
      }
      return prev.filter((item) => item.id !== id)
    })
    setActivePreviewId((prev) => {
      if (prev !== id) return prev
      const remaining = slicedItems.filter((item) => item.id !== id)
      return remaining.find((item) => item.geometry !== null)?.id ?? remaining[0]?.id ?? null
    })
  }

  const handleClearAll = () => {
    slicedItems.forEach((item) => {
      if (item.geometry) {
        item.geometry.dispose()
      }
    })
    setSlicedItems([])
    setActivePreviewId(null)
  }

  // Perform price calculation
  const getEstimate = () => {
    if (slicedItems.length === 0) return null

    const DENSITIES: Record<FilamentMaterial, number> = {
      pla: 1.24,
      petg: 1.27,
      abs: 1.04,
      tpu: 1.21,
      nylon: 1.14,
      pc: 1.20,
    }
    const density = DENSITIES[selectedMaterial] ?? 1.24

    let totalWeightG = 0
    let totalHours = 0

    slicedItems.forEach((item) => {
      const w = item.volumeCc * density * ((infill / 100) * 0.6 + 0.4)
      totalWeightG += w

      const nozzleTimeMults: Record<string, number> = { '0.2': 1.8, '0.4': 1.0, '0.6': 0.7, '0.8': 0.5 }
      const mult = nozzleTimeMults[String(nozzle)] ?? 1.0
      totalHours += (w / 15) * mult
    })

    const filamentCostPerKg = (printer.filament_costs || {})[selectedMaterial] ?? 50
    const est = calculateEstimate({
      size: 'medium',
      quality: 'basic',
      material: selectedMaterial,
      power_watts: printer.power_watts ?? 350,
      cost_per_kg: filamentCostPerKg,
      electricity_rate: DEFAULT_ELECTRICITY_RATE,
      markup_percent: printer.markup_percent ?? 30,
      machine_rate_per_hour: printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE,
      waste_percent: printer.waste_percent ?? 8,
      known_weight_g: totalWeightG,
      known_hours: totalHours,
      affiliate_discount_pct: activePromo?.discount_pct ?? 0,
    })

    return {
      weight: Math.round(totalWeightG),
      hours: Math.round(totalHours * 10) / 10,
      price: est.final_price,
      rawPrice: est.suggested_price,
      discountAmount: est.discount_amount,
    }
  }

  const estimate = getEstimate()
  const activePreviewItem = slicedItems.find((item) => item.id === activePreviewId)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span>⚡ Instant Price Estimator</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Drop STL, OBJ, or 3MF files to calculate weight, time, and pricing.
          </p>
        </div>
        {slicedItems.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition"
          >
            Clear All
          </button>
        )}
      </div>

      {/* File Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/5 transition duration-200 group ${
          slicedItems.length > 0 ? 'py-4' : 'py-7'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.obj,.3mf"
          multiple
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        <Upload className="mx-auto h-6 w-6 text-slate-400 group-hover:text-orange-500 transition mb-1.5" />
        <p className="text-xs font-bold text-slate-650 group-hover:text-slate-800 transition">
          {slicedItems.length > 0 ? 'Add more files' : 'Upload 3D models'}
        </p>
        {slicedItems.length === 0 && (
          <>
            <p className="text-[10px] text-slate-400 mt-0.5">Drag and drop or click to browse</p>
            <p className="text-[9px] text-slate-400 mt-1.5 font-medium border-t border-slate-100 pt-2 max-w-[240px] mx-auto">
              Supported formats: <strong>.STL, .OBJ, .3MF</strong><br />
              Max file size: <strong>50MB per file</strong>
            </p>
          </>
        )}
      </div>

      {/* Sliced File Queue */}
      {slicedItems.length > 0 && (
        <div className="space-y-2 border border-slate-150 rounded-xl p-2.5 bg-slate-50/40">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Uploaded Files ({slicedItems.length})</p>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {slicedItems.map((item) => {
              const isStl = item.file.name.toLowerCase().endsWith('.stl')
              const isSelected = item.id === activePreviewId
              return (
                <div
                  key={item.id}
                  onClick={() => isStl && setActivePreviewId(item.id)}
                  className={`rounded-lg border p-2 flex items-center justify-between gap-3 text-xs cursor-pointer transition ${
                    isSelected
                      ? 'border-orange-200 bg-orange-50/20 shadow-sm'
                      : isStl
                      ? 'border-slate-150 bg-white hover:border-slate-250'
                      : 'border-slate-150 bg-white cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode2 className={`h-4 w-4 shrink-0 ${isStl ? 'text-orange-500' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700 truncate max-w-[160px]">{item.file.name}</p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB · {isStl ? 'STL (Click to preview)' : item.file.name.split('.').pop()?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveItem(item.id)
                    }}
                    className="text-slate-400 hover:text-red-500 p-1 rounded transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {parsing && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-slate-500 bg-slate-50 rounded-xl border border-slate-150 animate-pulse">
          <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
          <span>Analyzing model geometry...</span>
        </div>
      )}

      {/* Options & Results */}
      {slicedItems.length > 0 && !parsing && estimate && (
        <div className="pt-4 border-t border-slate-150 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Left Column: Active 3D Preview */}
            <div>
              {(activePreviewItem?.geometry || activePreviewItem?.group) ? (
                <ModelPreview geometry={activePreviewItem.geometry} group={activePreviewItem.group} />
              ) : (
                <div className="w-full aspect-square md:aspect-video rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-4">
                  <FileCode2 className="h-8 w-8 text-slate-350 mb-2" />
                  <p className="text-xs font-bold text-slate-600">3D Preview Unavailable</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                    Instant 3D rendering is active for STL and 3MF files. Click any file above to preview it.
                  </p>
                </div>
              )}
              
              {activePreviewItem && (
                <div className="mt-3 rounded-xl border border-slate-150 bg-slate-50/50 p-2.5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Active Preview</span>
                    <span className="font-semibold text-slate-700 truncate max-w-[150px]">{activePreviewItem.file.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Preview Bounds</span>
                    <span className="font-semibold text-slate-700 font-mono">
                      {activePreviewItem.dimensions.x} × {activePreviewItem.dimensions.y} × {activePreviewItem.dimensions.z} mm
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Parameters & Checkout */}
            <div className="space-y-4">
              {/* Material Toggle Buttons */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Material
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableMaterials.map((mat) => (
                    <button
                      key={mat}
                      type="button"
                      onClick={() => setSelectedMaterial(mat)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                        selectedMaterial === mat
                          ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {MATERIAL_LABELS[mat] ?? mat.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Preset Toggle Buttons */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Quality Presets
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {[
                    { label: 'Standard', infill: 20, desc: '20% Infill' },
                    { label: 'Strong', infill: 50, desc: '50% Infill' },
                    { label: 'Solid', infill: 80, desc: '80% Infill' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setInfill(preset.infill)}
                      className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl border transition text-center ${
                        infill === preset.infill
                          ? 'border-orange-500 bg-orange-500/5 text-orange-600 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-350'
                      }`}
                    >
                      <span className="text-xs font-bold">{preset.label}</span>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="pt-3 border-t border-slate-150 space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Promo / Affiliate Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="e.g. SAVE5"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      disabled={activePromo !== null || verifyingPromo}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold focus:border-orange-500 focus:bg-white focus:outline-none transition disabled:opacity-75 disabled:bg-slate-100 uppercase"
                    />
                    {activePromo && (
                      <Check className="absolute right-2.5 top-1.5 h-4.5 w-4.5 text-emerald-500" />
                    )}
                  </div>
                  {activePromo ? (
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition whitespace-nowrap"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyPromo()}
                      disabled={verifyingPromo || !promoCodeInput.trim()}
                      className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {verifyingPromo ? 'Verifying...' : 'Apply'}
                    </button>
                  )}
                </div>
                {promoError && (
                  <p className="text-[10px] text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {promoError}
                  </p>
                )}
                {activePromo && (
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                    <Sparkles className="h-3 w-3 shrink-0 animate-pulse" /> Code <strong>{activePromo.code}</strong> applied! ({activePromo.discount_pct}% discount)
                  </p>
                )}
              </div>

              {/* Estimates Card */}
              <div className="rounded-xl border border-orange-100 bg-orange-50/20 p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Est. Weight (Total)</span>
                  <span className="font-semibold text-slate-700 font-mono">{estimate.weight} grams</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Est. Print Time (Total)</span>
                  <span className="font-semibold text-slate-700 font-mono">
                    {estimate.hours} hour{estimate.hours !== 1 ? 's' : ''}
                  </span>
                </div>

                {estimate.discountAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-xs border-t border-dashed border-orange-100/50 pt-2">
                      <span className="text-slate-500 font-medium">Base Price</span>
                      <span className="font-semibold text-slate-500 font-mono line-through">
                        RM {estimate.rawPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-emerald-600 font-medium">
                      <span className="flex items-center gap-0.5">Promo Discount ({activePromo?.discount_pct}%)</span>
                      <span className="font-bold font-mono">
                        - RM {estimate.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}

                <div className="border-t border-orange-100/50 pt-2.5 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                      {estimate.discountAmount > 0 ? 'Discounted Price' : 'Estimated Cost'}
                    </p>
                    <p className="text-xl font-black text-orange-600 font-mono leading-none">
                      RM {estimate.price.toFixed(2)}
                    </p>
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400">Excludes delivery</span>
                </div>

                {estimate.price === 15.00 && (
                  <div className="text-[10px] text-amber-600 font-semibold mt-1 bg-amber-50 rounded-lg px-2 py-1 flex items-center gap-1 border border-amber-100/70">
                    <Info className="h-3 w-3 shrink-0 text-amber-500" /> Note: RM 15.00 minimum order price applied.
                  </div>
                )}
              </div>

              {/* Proceed to Order Button */}
              <button
                type="button"
                onClick={handleProceedToOrder}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/15 hover:bg-orange-600 transition hover:shadow-orange-500/25 active:scale-98"
              >
                Proceed to Order <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
