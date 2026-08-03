'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileCode2, Info, ChevronRight, HelpCircle, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useRouter } from 'next/navigation'
import type { RequestPrinterView, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import { calculateEstimate, DEFAULT_ELECTRICITY_RATE } from '@/lib/pricing'
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

function ModelPreview({ geometry }: { geometry: THREE.BufferGeometry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !geometry) return

    const width = canvas.clientWidth || 300
    const height = canvas.clientHeight || 200

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    geometry.center()
    const material = new THREE.MeshNormalMaterial()
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dirLight.position.set(10, 10, 10)
    scene.add(dirLight)

    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    let distance = 100
    if (box) {
      const size = new THREE.Vector3()
      box.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      distance = maxDim * 1.8
    }
    camera.position.set(distance, distance, distance)
    camera.lookAt(0, 0, 0)

    let animationFrameId: number
    const animate = () => {
      mesh.rotation.y += 0.015
      mesh.rotation.x += 0.008
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
  }, [geometry])

  return (
    <div className="relative w-full aspect-square md:aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute bottom-2 left-2 rounded bg-slate-900/60 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
        3D Model Preview
      </div>
    </div>
  )
}

export default function PublicPriceCalculator({ printer, filaments }: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [dimensions, setDimensions] = useState<{ x: number; y: number; z: number } | null>(null)
  const [rawVolumeCc, setRawVolumeCc] = useState<number | null>(null)
  const [parsedGeometry, setParsedGeometry] = useState<THREE.BufferGeometry | null>(null)
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
      // Keep it synced in session storage
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
    if (!file) return

    if (typeof window !== 'undefined') {
      (window as any).__pendingRequestFile = file;
      (window as any).__pendingRequestParams = {
        material: selectedMaterial,
        infill: infill,
      }
    }

    router.push(`/request/${printer.id}`)
  }

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const selectedFile = files[0]
    
    const ext = selectedFile.name.toLowerCase().split('.').pop()
    if (ext !== 'stl' && ext !== 'obj') {
      alert('Only .stl and .obj files are supported in this estimator.')
      return
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      alert('File exceeds the maximum size limit of 50MB.')
      return
    }

    setFile(selectedFile)
    setParsing(true)
    setParsedGeometry(null)

    if (ext === 'obj') {
      // Mock stats for OBJ files in instant calculator; direct request form will handle upload
      setDimensions({ x: 60, y: 60, z: 60 })
      setRawVolumeCc(45)
      setParsing(false)
      return
    }

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const loader = new STLLoader()
      const geometry = loader.parse(arrayBuffer)
      setParsedGeometry(geometry)
      
      // Bounding box dimensions
      geometry.computeBoundingBox()
      const box = geometry.boundingBox
      if (box) {
        const size = new THREE.Vector3()
        box.getSize(size)
        setDimensions({
          x: Math.round(size.x * 10) / 10,
          y: Math.round(size.y * 10) / 10,
          z: Math.round(size.z * 10) / 10,
        })
      }

      // Volume calculation
      const volumeMm3 = calculateSTLVolume(geometry)
      setRawVolumeCc(volumeMm3 / 1000)
    } catch (err) {
      console.error('Failed to parse STL file:', err)
      alert('Error parsing STL file. Ensure the file is not corrupted.')
      setFile(null)
    } finally {
      setParsing(false)
    }
  }

  // Perform price calculation
  const getEstimate = () => {
    if (rawVolumeCc == null) return null

    // Plastic density grams per cc
    const DENSITIES: Record<FilamentMaterial, number> = {
      pla: 1.24,
      petg: 1.27,
      abs: 1.04,
      tpu: 1.21,
      nylon: 1.14,
      pc: 1.20,
    }
    const density = DENSITIES[selectedMaterial] ?? 1.24

    // Weight: Volume * Density * (infill * 0.6 + 0.4) to account for walls
    const estimatedWeightG = rawVolumeCc * density * ((infill / 100) * 0.6 + 0.4)
    
    // Print hours: Standard extrusion of 15g per hour, scaled by nozzle multiplier
    const nozzleTimeMults: Record<string, number> = { '0.2': 1.8, '0.4': 1.0, '0.6': 0.7, '0.8': 0.5 }
    const mult = nozzleTimeMults[String(nozzle)] ?? 1.0
    const estimatedHours = (estimatedWeightG / 15) * mult

    const filamentCostPerKg = (printer.filament_costs || {})[selectedMaterial] ?? 50
    const est = calculateEstimate({
      size: 'medium', // fallback bucket
      quality: 'basic',
      material: selectedMaterial,
      power_watts: printer.power_watts ?? 350,
      cost_per_kg: filamentCostPerKg,
      electricity_rate: DEFAULT_ELECTRICITY_RATE,
      markup_percent: printer.markup_percent ?? 30,
      machine_rate_per_hour: printer.machine_rate_per_hour ?? 1.5,
      waste_percent: printer.waste_percent ?? 8,
      known_weight_g: estimatedWeightG,
      known_hours: estimatedHours,
      affiliate_discount_pct: activePromo?.discount_pct ?? 0,
    })

    return {
      weight: Math.round(estimatedWeightG),
      hours: Math.round(estimatedHours * 10) / 10,
      price: est.final_price,
      rawPrice: est.suggested_price,
      discountAmount: est.discount_amount,
    }
  }

  const estimate = getEstimate()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <span>⚡ Instant Price Estimator</span>
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Drop your STL file to estimate weight, time, and pricing instantly.
        </p>
      </div>

      {/* File Dropzone */}
      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/5 transition duration-200 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl,.obj"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files)}
          />
          <Upload className="mx-auto h-7 w-7 text-slate-400 group-hover:text-orange-500 transition mb-2" />
          <p className="text-xs font-bold text-slate-600 group-hover:text-slate-800 transition">
            Upload 3D model
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Drag and drop or click to browse</p>
          <p className="text-[9px] text-slate-400 mt-1.5 font-medium border-t border-slate-100 pt-2 max-w-[240px] mx-auto">
            Supported formats: <strong>.STL, .OBJ</strong><br />
            Max file size: <strong>50MB</strong>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-150 p-3 bg-slate-50 flex items-center gap-2 text-xs">
          <FileCode2 className="h-5 w-5 text-orange-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-700 truncate">{file.name}</p>
            <p className="text-[10px] text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null)
              setDimensions(null)
              setRawVolumeCc(null)
              setParsedGeometry(null)
            }}
            className="text-slate-400 hover:text-red-500 transition text-[10px] font-bold"
          >
            Clear
          </button>
        </div>
      )}

      {/* Loading State */}
      {parsing && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs font-medium text-slate-500">
          <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
          <span>Analyzing model geometry...</span>
        </div>
      )}

      {/* Options & Results */}
      {file && !parsing && dimensions && estimate && (
        <div className="pt-4 border-t border-slate-100 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Left Column: 3D Preview (for STL files only) */}
            <div>
              {parsedGeometry ? (
                <ModelPreview geometry={parsedGeometry} />
              ) : (
                <div className="w-full aspect-square md:aspect-video rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-4">
                  <FileCode2 className="h-8 w-8 text-slate-350 mb-2 animate-bounce" />
                  <p className="text-xs font-bold text-slate-600">3D Preview Unavailable</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                    Instant 3D model parsing is supported for STL files. You can still order this OBJ file.
                  </p>
                </div>
              )}
              
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center text-slate-500">
                  <span>File Name</span>
                  <span className="font-semibold text-slate-700 truncate max-w-[150px]">{file.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Model Bounds</span>
                  <span className="font-semibold text-slate-700 font-mono">
                    {dimensions.x} × {dimensions.y} × {dimensions.z} mm
                  </span>
                </div>
              </div>
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
              <div className="pt-3 border-t border-slate-100 space-y-2">
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
                  <span className="text-slate-500 font-medium">Est. Weight</span>
                  <span className="font-semibold text-slate-700 font-mono">{estimate.weight} grams</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Est. Print Time</span>
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
