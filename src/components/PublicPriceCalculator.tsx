'use client'

import { useState, useRef } from 'react'
import { Upload, FileCode2, Info, ChevronRight, HelpCircle, Loader2 } from 'lucide-react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import type { RequestPrinterView, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import { calculateEstimate, DEFAULT_ELECTRICITY_RATE } from '@/lib/pricing'

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

export default function PublicPriceCalculator({ printer, filaments }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [dimensions, setDimensions] = useState<{ x: number; y: number; z: number } | null>(null)
  const [rawVolumeCc, setRawVolumeCc] = useState<number | null>(null)
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

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const selectedFile = files[0]
    if (!selectedFile.name.toLowerCase().endsWith('.stl')) {
      alert('Only .stl files are supported in this instant estimator.')
      return
    }

    setFile(selectedFile)
    setParsing(true)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const loader = new STLLoader()
      const geometry = loader.parse(arrayBuffer)
      
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
    })

    return {
      weight: Math.round(estimatedWeightG),
      hours: Math.round(estimatedHours * 10) / 10,
      price: est.suggested_price,
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
            accept=".stl"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files)}
          />
          <Upload className="mx-auto h-7 w-7 text-slate-400 group-hover:text-orange-500 transition mb-2" />
          <p className="text-xs font-bold text-slate-600 group-hover:text-slate-800 transition">
            Upload STL model
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Drag and drop or click to browse</p>
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
        <div className="space-y-4 pt-1 border-t border-slate-100 animate-fade-in">
          {/* Specs Controls */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Material
              </label>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value as FilamentMaterial)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus:border-orange-500 focus:bg-white focus:outline-none transition"
              >
                {availableMaterials.map((mat) => (
                  <option key={mat} value={mat}>
                    {MATERIAL_LABELS[mat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Nozzle Diameter
              </label>
              <select
                value={nozzle}
                onChange={(e) => setNozzle(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus:border-orange-500 focus:bg-white focus:outline-none transition"
              >
                <option value={0.2}>0.2 mm (fine)</option>
                <option value={0.4}>0.4 mm (standard)</option>
                <option value={0.6}>0.6 mm (fast)</option>
                <option value={0.8}>0.8 mm (draft)</option>
              </select>
            </div>
          </div>

          {/* Infill Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Infill Density</span>
              <span className="font-semibold text-orange-600">{infill}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={infill}
              onChange={(e) => setInfill(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>

          {/* Estimates Card */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/20 p-3 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Dimensions</span>
              <span className="font-semibold text-slate-700 font-mono">
                {dimensions.x} × {dimensions.y} × {dimensions.z} mm
              </span>
            </div>
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
            <div className="border-t border-orange-100/50 pt-2 flex justify-between items-end">
              <div>
                <p className="text-[10px] text-slate-400 font-medium leading-none mb-0.5">Estimated Cost</p>
                <p className="text-lg font-black text-orange-600 font-mono leading-none">
                  RM {estimate.price.toFixed(2)}
                </p>
              </div>
              <a
                href={`/request/${printer.id}`}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-sm active:scale-95"
              >
                Order Print <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
