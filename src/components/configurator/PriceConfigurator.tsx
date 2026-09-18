'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileCode2, Info, ChevronRight, HelpCircle, Loader2, Sparkles, Check, AlertCircle, Trash2, Plus, Box, Layers } from 'lucide-react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import JSZip from 'jszip'
import { useRouter } from 'next/navigation'
import type { RequestPrinterView, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import { calculateEstimate, DEFAULT_ELECTRICITY_RATE, DEFAULT_MACHINE_RATE, MINIMUM_ORDER_PRICE } from '@/lib/pricing'
import { verifyAffiliateCode } from '@/lib/actions'
import { getColorsForMaterial } from '@/config/materials'
import Ender3BedViewer from './Ender3BedViewer'
import RequestCheckoutModal from './RequestCheckoutModal'

interface Props {
  printer: RequestPrinterView
  filaments: Filament[]
}

export interface SubObjectItem {
  id: string
  name: string
  dimensions: { x: number; y: number; z: number }
  volumeCc: number
  group: THREE.Group
}

export interface PartConfig {
  material: FilamentMaterial
  colorHex: string
  colorName: string
}

interface SlicedItem {
  id: string
  file: File
  dimensions: { x: number; y: number; z: number }
  volumeCc: number
  geometry: THREE.BufferGeometry | null
  group: THREE.Group | null
  subObjects?: SubObjectItem[]
  quantity: number
}

// Packs / arranges multiple 3D objects side-by-side cleanly so they fit
// on the 220x220mm Ender-3 bed without slicer multi-plate offsets.
function createArrangedGroup(children: THREE.Object3D[], subObjects?: SubObjectItem[]): THREE.Group {
  const arranged = new THREE.Group()
  if (children.length === 0) return arranged

  const centeredItems: { obj: THREE.Object3D; size: THREE.Vector3; subId?: string; idx: number }[] = []
  children.forEach((c, idx) => {
    const clone = c.clone()

    const rawBox = new THREE.Box3().setFromObject(clone)
    const rawSize = new THREE.Vector3()
    rawBox.getSize(rawSize)
    const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z)
    if (maxDim > 0 && maxDim < 1.0) {
      clone.scale.multiplyScalar(1000)
    } else if (maxDim > 2500) {
      clone.scale.multiplyScalar(0.001)
    }

    const box = new THREE.Box3().setFromObject(clone)
    const center = new THREE.Vector3()
    box.getCenter(center)
    clone.position.sub(center) // Center locally around (0,0,0)

    const size = new THREE.Vector3()
    box.getSize(size)
    const subId = subObjects ? subObjects[idx]?.id : undefined
    clone.userData = { subObjectId: subId, partIndex: idx }
    centeredItems.push({ obj: clone, size, subId, idx })
  })

  // Arrange side-by-side along X axis with 14mm spacing
  const gap = 14
  const totalWidth =
    centeredItems.reduce((acc, curr) => acc + curr.size.x, 0) +
    Math.max(centeredItems.length - 1, 0) * gap
  let currentX = -totalWidth / 2

  centeredItems.forEach(({ obj, size }) => {
    obj.position.x = currentX + size.x / 2
    obj.position.y = 0
    obj.position.z = 0
    arranged.add(obj)
    currentX += size.x + gap
  })

  return arranged
}

// Calculates accurate mesh volume in mm^3, handling indexed or non-indexed geometries
function calculateGeometryVolume(geometry: THREE.BufferGeometry): number {
  let nonIndexed = geometry
  let needsDispose = false
  if (geometry.index) {
    nonIndexed = geometry.toNonIndexed()
    needsDispose = true
  }
  const position = nonIndexed.attributes.position
  if (!position) return 0
  
  let volume = 0
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
  if (needsDispose) {
    nonIndexed.dispose()
  }
  return Math.abs(volume)
}

export default function PublicPriceCalculator({ printer, filaments }: Props) {
  const router = useRouter()
  const [slicedItems, setSlicedItems] = useState<SlicedItem[]>([])
  const [parsing, setParsing] = useState(false)
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const [selectedSubObjectMap, setSelectedSubObjectMap] = useState<Record<string, string>>({})
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Options
  const availableMaterials = Object.keys(printer.filament_costs || {}).filter(
    (m) => (printer.filament_costs || {})[m as FilamentMaterial] != null
  ) as FilamentMaterial[]
  const [selectedMaterial, setSelectedMaterial] = useState<FilamentMaterial>(
    availableMaterials[0] ?? 'pla'
  )
  const [infill, setInfill] = useState(20)
  const [nozzle, setNozzle] = useState(0.4)

  const [partConfigs, setPartConfigs] = useState<Record<string, PartConfig>>({})
  const [activeConfigPartId, setActiveConfigPartId] = useState<string>('all')

  const getColorsForMat = (mat: FilamentMaterial) => {
    const stockForMat = filaments.filter((f) => f.material === mat && f.in_stock)
    return stockForMat.length > 0
      ? stockForMat.map((f) => ({ name: f.color, hex: f.color_hex }))
      : getColorsForMaterial(mat)
  }

  const stockFilaments = filaments.filter(
    (f) => f.material === selectedMaterial && f.in_stock
  )
  const colorList = getColorsForMat(selectedMaterial)

  const [selectedColorHex, setSelectedColorHex] = useState<string>(colorList[0]?.hex || '#1a1a1a')
  const [selectedColorName, setSelectedColorName] = useState<string>(colorList[0]?.name || 'Matte Black')

  // Keep color aligned when material type changes
  useEffect(() => {
    const list = getColorsForMat(selectedMaterial)
    if (!list.some((c) => c.hex.toLowerCase() === selectedColorHex.toLowerCase())) {
      if (list[0]) {
        setSelectedColorHex(list[0].hex)
        setSelectedColorName(list[0].name)
      }
    }
  }, [selectedMaterial])

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

    setIsCheckoutModalOpen(true)
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
        try {
          const text = await f.text()
          const loader = new OBJLoader()
          const group = loader.parse(text)

          // Compute normals for all meshes
          group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              child.geometry.computeVertexNormals()
            }
          })

          const box = new THREE.Box3().setFromObject(group)
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z)

          let scaleMult = 1
          if (maxDim > 0 && maxDim < 1.0) {
            scaleMult = 1000 // meters to mm
          } else if (maxDim > 2500) {
            scaleMult = 0.001 // micrometers to mm
          }

          if (scaleMult !== 1) {
            group.scale.multiplyScalar(scaleMult)
            box.setFromObject(group)
            box.getSize(size)
          }

          let totalVolumeMm3 = 0
          group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              let vol = calculateGeometryVolume(child.geometry)
              vol *= Math.abs(child.scale.x * child.scale.y * child.scale.z)
              totalVolumeMm3 += vol
            }
          })

          if (totalVolumeMm3 === 0) {
            totalVolumeMm3 = size.x * size.y * size.z * 0.45
          }

          const dims = {
            x: Math.round(size.x * 10) / 10,
            y: Math.round(size.y * 10) / 10,
            z: Math.round(size.z * 10) / 10,
          }
          const volumeCc = Math.max(Math.round((totalVolumeMm3 / 1000) * 10) / 10, 0.5)

          const newItem: SlicedItem = {
            id: newId,
            file: f,
            dimensions: dims,
            volumeCc: volumeCc,
            geometry: null,
            group: group,
            quantity: 1,
          }
          setSlicedItems((prev) => [...prev, newItem])
          setActivePreviewId((prev) => prev ?? newId)
        } catch (err) {
          console.error(`Failed to parse OBJ file "${f.name}":`, err)
          alert(`Error parsing OBJ file "${f.name}". Ensure it is a valid Wavefront OBJ file.`)
        }
      } else if (ext === '3mf') {
        try {
          const arrayBuffer = await f.arrayBuffer()

          // 1. Extract friendly part names from Metadata if available
          let extractedNames: string[] = []
          try {
            const zip = await JSZip.loadAsync(arrayBuffer)
            const settingsXml = await zip.file('Metadata/model_settings.config')?.async('string')
            if (settingsXml) {
              const matches = Array.from(
                settingsXml.matchAll(/<object id="[^"]+">\s*<metadata key="name" value="([^"]+)"\/>/g)
              )
              if (matches.length > 0) {
                extractedNames = matches.map((m) => m[1])
              }
            }
          } catch (zipErr) {
            console.warn('Could not read 3MF metadata:', zipErr)
          }

          // 2. Parse 3MF with ThreeMFLoader
          const loader = new ThreeMFLoader()
          const group = loader.parse(arrayBuffer)

          // Compute normals for all child meshes
          group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              child.geometry.computeVertexNormals()
            }
          })

          // 3. Identify and localize all individual objects inside the 3MF
          const subObjects: SubObjectItem[] = []
          const rawChildren = group.children.length > 0 ? [...group.children] : [group]

          let totalVolumeMm3 = 0

          rawChildren.forEach((child, idx) => {
            const childClone = child.clone()

            // Normalize scale for child if in meters (< 1.0) or micrometers (> 2500)
            const childRawBox = new THREE.Box3().setFromObject(childClone)
            const childRawSize = new THREE.Vector3()
            childRawBox.getSize(childRawSize)
            const maxDim = Math.max(childRawSize.x, childRawSize.y, childRawSize.z)
            let scaleMult = 1
            if (maxDim > 0 && maxDim < 1.0) {
              scaleMult = 1000
            } else if (maxDim > 2500) {
              scaleMult = 0.001
            }
            if (scaleMult !== 1) {
              childClone.scale.multiplyScalar(scaleMult)
            }

            // Localize / center child around (0, 0, 0) to strip multi-plate coordinate offset
            const localBox = new THREE.Box3().setFromObject(childClone)
            const localCenter = new THREE.Vector3()
            localBox.getCenter(localCenter)
            childClone.position.sub(localCenter)

            const finalSize = new THREE.Vector3()
            localBox.getSize(finalSize)

            let childVol = 0
            childClone.traverse((c) => {
              if (c instanceof THREE.Mesh && c.geometry) {
                let vol = calculateGeometryVolume(c.geometry)
                vol *= Math.abs(c.scale.x * child.scale.y * child.scale.z)
                childVol += vol
              }
            })
            if (childVol === 0) {
              childVol = finalSize.x * finalSize.y * finalSize.z * 0.45
            }
            totalVolumeMm3 += childVol

            const subId = `${newId}_sub_${idx}`
            const partContainer = new THREE.Group()
            partContainer.userData = { subObjectId: subId, partIndex: idx }
            childClone.userData = { subObjectId: subId, partIndex: idx }
            partContainer.add(childClone)

            const partName = extractedNames[idx] || child.name || (rawChildren.length > 1 ? `Part ${idx + 1}` : f.name)

            subObjects.push({
              id: subId,
              name: partName,
              dimensions: {
                x: Math.round(finalSize.x * 10) / 10,
                y: Math.round(finalSize.y * 10) / 10,
                z: Math.round(finalSize.z * 10) / 10,
              },
              volumeCc: Math.max(Math.round((childVol / 1000) * 10) / 10, 0.5),
              group: partContainer,
            })
          })

          // 4. Create an auto-arranged group if multiple objects exist, so all parts fit on the bed together
          const arrangedGroup = rawChildren.length > 1 ? createArrangedGroup(rawChildren, subObjects) : group
          const totalBox = new THREE.Box3().setFromObject(arrangedGroup)
          const totalSize = new THREE.Vector3()
          totalBox.getSize(totalSize)

          const totalVolumeCc = Math.max(Math.round((totalVolumeMm3 / 1000) * 10) / 10, 0.5)

          // Pre-populate partConfigs for multi-part models
          if (subObjects.length > 1) {
            const initialConfigs: Record<string, PartConfig> = {}
            const curColors = getColorsForMat(selectedMaterial)
            subObjects.forEach((sub, idx) => {
              const col = (idx > 0 && curColors[idx])
                ? curColors[idx]
                : (curColors[0] || { hex: selectedColorHex, name: selectedColorName })
              initialConfigs[sub.id] = {
                material: selectedMaterial,
                colorHex: col.hex,
                colorName: col.name,
              }
            })
            setPartConfigs((prev) => ({ ...prev, ...initialConfigs }))
          }

          const newItem: SlicedItem = {
            id: newId,
            file: f,
            dimensions: {
              x: Math.round(totalSize.x * 10) / 10,
              y: Math.round(totalSize.y * 10) / 10,
              z: Math.round(totalSize.z * 10) / 10,
            },
            volumeCc: totalVolumeCc,
            geometry: null,
            group: arrangedGroup,
            subObjects: subObjects.length > 1 ? subObjects : undefined,
            quantity: 1,
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
          geometry.computeVertexNormals()

          geometry.computeBoundingBox()
          const box = geometry.boundingBox
          let dims = { x: 50, y: 50, z: 50 }
          let scaleMult = 1
          if (box) {
            const rawSize = new THREE.Vector3()
            box.getSize(rawSize)
            const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z)
            if (maxDim > 0 && maxDim < 1.0) {
              scaleMult = 1000
            } else if (maxDim > 2500) {
              scaleMult = 0.001
            }

            if (scaleMult !== 1) {
              geometry.scale(scaleMult, scaleMult, scaleMult)
              geometry.computeBoundingBox()
              geometry.boundingBox?.getSize(rawSize)
            }

            dims = {
              x: Math.round(rawSize.x * 10) / 10,
              y: Math.round(rawSize.y * 10) / 10,
              z: Math.round(rawSize.z * 10) / 10,
            }
          }

          let volumeMm3 = calculateGeometryVolume(geometry)
          if (volumeMm3 === 0 && box) {
            volumeMm3 = dims.x * dims.y * dims.z * 0.45
          }
          const volumeCc = Math.max(Math.round((volumeMm3 / 1000) * 10) / 10, 0.5)

          const newItem: SlicedItem = {
            id: newId,
            file: f,
            dimensions: dims,
            volumeCc: volumeCc,
            geometry,
            group: null,
            quantity: 1,
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

  const updateItemQuantity = (id: string, newQty: number) => {
    const qty = Math.max(1, Math.min(500, Math.floor(newQty) || 1))
    setSlicedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
    )
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

    let totalWeightG = 0
    let totalHours = 0
    let totalFilamentCost = 0
    let totalUnits = 0

    const nozzleTimeMults: Record<string, number> = { '0.2': 1.8, '0.4': 1.0, '0.6': 0.7, '0.8': 0.5 }
    const mult = nozzleTimeMults[String(nozzle)] ?? 1.0

    slicedItems.forEach((item) => {
      const qty = item.quantity || 1
      totalUnits += qty

      if (item.subObjects && item.subObjects.length > 1) {
        item.subObjects.forEach((sub) => {
          const partCfg = partConfigs[sub.id]
          const partMat = partCfg?.material || selectedMaterial
          const density = DENSITIES[partMat] ?? 1.24
          const partWeight = sub.volumeCc * density * ((infill / 100) * 0.6 + 0.4)
          totalWeightG += partWeight * qty
          totalHours += (partWeight / 25) * mult * qty

          const costPerKg = (printer.filament_costs || {})[partMat] ?? 50
          totalFilamentCost += (partWeight / 1000) * costPerKg * qty
        })
      } else {
        const density = DENSITIES[selectedMaterial] ?? 1.24
        const w = item.volumeCc * density * ((infill / 100) * 0.6 + 0.4)
        totalWeightG += w * qty
        totalHours += (w / 25) * mult * qty

        const costPerKg = (printer.filament_costs || {})[selectedMaterial] ?? 50
        totalFilamentCost += (w / 1000) * costPerKg * qty
      }
    })

    // Batch volume discount for multiple copies:
    // 3 - 4 copies: 5% off
    // 5 - 9 copies: 10% off
    // 10+ copies: 15% off
    let batchDiscountPct = 0
    if (totalUnits >= 10) batchDiscountPct = 15
    else if (totalUnits >= 5) batchDiscountPct = 10
    else if (totalUnits >= 3) batchDiscountPct = 5

    const promoDiscountPct = activePromo?.discount_pct ?? 0
    const totalDiscountPct = Math.min(promoDiscountPct + batchDiscountPct, 40)

    const effectiveCostPerKg = totalWeightG > 0
      ? (totalFilamentCost / (totalWeightG / 1000))
      : ((printer.filament_costs || {})[selectedMaterial] ?? 50)

    const est = calculateEstimate({
      size: 'medium',
      quality: 'basic',
      material: selectedMaterial,
      power_watts: printer.power_watts ?? 350,
      cost_per_kg: effectiveCostPerKg,
      electricity_rate: DEFAULT_ELECTRICITY_RATE,
      markup_percent: printer.markup_percent ?? 30,
      machine_rate_per_hour: printer.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE,
      waste_percent: printer.waste_percent ?? 8,
      known_weight_g: totalWeightG,
      known_hours: totalHours,
      affiliate_discount_pct: totalDiscountPct,
    })

    const unitPrice = totalUnits > 0 ? est.final_price / totalUnits : est.final_price

    return {
      weight: Math.round(totalWeightG),
      hours: Math.round(totalHours * 10) / 10,
      price: est.final_price,
      rawPrice: est.suggested_price,
      discountAmount: est.discount_amount,
      totalUnits,
      unitPrice: Math.round(unitPrice * 100) / 100,
      batchDiscountPct,
      promoDiscountPct,
    }
  }

  const estimate = getEstimate()
  const activePreviewItem = slicedItems.find((item) => item.id === activePreviewId)

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 md:p-8 shadow-xl shadow-slate-200/50 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>⚡ Instant Price Estimator</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Drop STL, OBJ, or 3MF files to calculate weight, time, and pricing.
          </p>
        </div>
        {slicedItems.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-bold text-red-500 hover:text-red-600 transition px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Beginner 3-Step Guide for Non-CAD Users */}
      <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50/90 via-amber-50/50 to-white p-4 sm:p-5 text-xs text-slate-700 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] shadow-sm">
            💡
          </span>
          <span>Don&apos;t have your own 3D design? It takes 10 seconds:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white/90 rounded-xl p-3 border border-orange-100 shadow-2xs">
            <p className="font-bold text-orange-700 text-xs">1. Find a Free Model</p>
            <p className="text-slate-500 mt-1 leading-relaxed text-[11px]">
              Explore <a href="https://makerworld.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline font-semibold">MakerWorld</a> or <a href="https://printables.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline font-semibold">Printables</a> for thousands of designs.
            </p>
          </div>
          <div className="bg-white/90 rounded-xl p-3 border border-orange-100 shadow-2xs">
            <p className="font-bold text-orange-700 text-xs">2. Download File</p>
            <p className="text-slate-500 mt-1 leading-relaxed text-[11px]">Click &ldquo;Download STL or 3MF&rdquo; on the model page to save it to your device.</p>
          </div>
          <div className="bg-white/90 rounded-xl p-3 border border-orange-100 shadow-2xs">
            <p className="font-bold text-orange-700 text-xs">3. Drop &amp; Color Here</p>
            <p className="text-slate-500 mt-1 leading-relaxed text-[11px]">Drop that downloaded file below to see it in 3D on the Ender-3 bed, change colors, and check instant pricing!</p>
          </div>
        </div>
      </div>

      {/* File Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/5 transition duration-200 group ${
          slicedItems.length > 0 ? 'py-5' : 'py-9'
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
        <Upload className="mx-auto h-7 w-7 text-slate-400 group-hover:text-orange-500 transition mb-2" />
        <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition">
          {slicedItems.length > 0 ? 'Add more 3D files' : 'Upload 3D models'}
        </p>
        {slicedItems.length === 0 && (
          <>
            <p className="text-xs text-slate-400 mt-1">Drag and drop or click to browse</p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium border-t border-slate-100 pt-2.5 max-w-[280px] mx-auto">
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
              const ext = item.file.name.split('.').pop()?.toUpperCase() || 'FILE'
              const isSelected = item.id === activePreviewId
              const currentSubId = selectedSubObjectMap[item.id] || 'all'
              return (
                <div
                  key={item.id}
                  onClick={() => setActivePreviewId(item.id)}
                  className={`rounded-xl border p-2.5 transition cursor-pointer ${
                    isSelected
                      ? 'border-orange-300 bg-orange-50/30 shadow-sm ring-1 ring-orange-400/20'
                      : 'border-slate-150 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2 className={`h-4 w-4 shrink-0 ${isSelected ? 'text-orange-500' : 'text-slate-400'}`} />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 truncate max-w-[200px]">{item.file.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB · {ext}
                          {item.subObjects && item.subObjects.length > 1 && (
                            <span className="ml-1.5 font-bold text-orange-600 bg-orange-100/80 px-1.5 py-0.5 rounded text-[9px]">
                              {item.subObjects.length} Objects Detected
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center border border-slate-200 bg-white rounded-lg px-1.5 py-0.5 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Qty:</span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, (item.quantity || 1) - 1)}
                          disabled={(item.quantity || 1) <= 1}
                          className="h-5 w-5 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold transition"
                        >
                          −
                        </button>
                        <span className="font-mono text-xs font-bold text-slate-800 min-w-[18px] text-center">
                          {item.quantity || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, (item.quantity || 1) + 1)}
                          className="h-5 w-5 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveItem(item.id)
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition"
                        title="Remove file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sub-objects quick selection pills in the queue */}
                  {item.subObjects && item.subObjects.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-150/60 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                        Select Part:
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActivePreviewId(item.id)
                          setSelectedSubObjectMap((prev) => ({ ...prev, [item.id]: 'all' }))
                        }}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                          isSelected && currentSubId === 'all'
                            ? 'bg-orange-500 text-white font-bold shadow-2xs'
                            : 'bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-700 border border-slate-200'
                        }`}
                      >
                        <Layers className="h-2.5 w-2.5" />
                        <span>All ({item.subObjects.length})</span>
                      </button>
                      {item.subObjects.map((sub, idx) => {
                        const isSubActive = isSelected && currentSubId === sub.id
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActivePreviewId(item.id)
                              setSelectedSubObjectMap((prev) => ({ ...prev, [item.id]: sub.id }))
                            }}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                              isSubActive
                                ? 'bg-orange-500 text-white font-bold shadow-2xs'
                                : 'bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-700 border border-slate-200'
                            }`}
                          >
                            <Box className="h-2.5 w-2.5" />
                            <span>Part {idx + 1}: {sub.name}</span>
                            <span className="font-mono text-[9px] opacity-75">
                              ({sub.dimensions.x}×{sub.dimensions.y}mm)
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {parsing && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center bg-orange-50/60 rounded-3xl border border-dashed border-orange-300 shadow-sm animate-pulse">
          <div className="h-12 w-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shadow-xs">
            <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Processing & Slicing 3D Model...</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Calculating exact volume, detecting multi-part objects, and mounting on the Ender-3 build plate.
            </p>
          </div>
        </div>
      )}

      {/* Empty State: Live Ender-3 Build Plate Ready for Upload */}
      {slicedItems.length === 0 && !parsing && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs px-1 text-slate-500">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <span>🖨️ Interactive Ender-3 V3 SE Build Plate</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">220 × 220 × 250 mm Volume</span>
          </div>
          <Ender3BedViewer
            colorHex={selectedColorHex}
            materialType={selectedMaterial}
            fileName="Ender-3 V3 SE (Ready for File)"
          />
        </div>
      )}

      {/* Options & Results */}
      {slicedItems.length > 0 && !parsing && estimate && (() => {
        const currentSubId = (activePreviewItem && selectedSubObjectMap[activePreviewItem.id]) || 'all'
        const activeSubObject = activePreviewItem?.subObjects?.find((s) => s.id === currentSubId)

        // The target part being customized in the parameters column
        const configTargetSub = activePreviewItem?.subObjects?.find((s) => s.id === activeConfigPartId)
        const isPerPartConfig = activeConfigPartId !== 'all' && configTargetSub != null

        const activeCustomMaterial = isPerPartConfig
          ? (partConfigs[configTargetSub.id]?.material ?? selectedMaterial)
          : selectedMaterial

        const activeCustomColorHex = isPerPartConfig
          ? (partConfigs[configTargetSub.id]?.colorHex ?? selectedColorHex)
          : selectedColorHex

        const activeCustomColorName = isPerPartConfig
          ? (partConfigs[configTargetSub.id]?.colorName ?? selectedColorName)
          : selectedColorName

        const dynamicColorList = getColorsForMat(activeCustomMaterial)

        const handleMaterialClick = (mat: FilamentMaterial) => {
          const list = getColorsForMat(mat)
          const newColor = list[0] || { name: 'Black', hex: '#1a1a1a' }

          if (!isPerPartConfig || !configTargetSub) {
            setSelectedMaterial(mat)
            setSelectedColorHex(newColor.hex)
            setSelectedColorName(newColor.name)

            if (activePreviewItem?.subObjects) {
              setPartConfigs((prev) => {
                const next = { ...prev }
                activePreviewItem.subObjects?.forEach((sub) => {
                  next[sub.id] = {
                    material: mat,
                    colorHex: newColor.hex,
                    colorName: newColor.name,
                  }
                })
                return next
              })
            }
          } else {
            setPartConfigs((prev) => ({
              ...prev,
              [configTargetSub.id]: {
                material: mat,
                colorHex: newColor.hex,
                colorName: newColor.name,
              },
            }))
          }
        }

        const handleColorClick = (color: { name: string; hex: string }) => {
          if (!isPerPartConfig || !configTargetSub) {
            setSelectedColorHex(color.hex)
            setSelectedColorName(color.name)

            if (activePreviewItem?.subObjects) {
              setPartConfigs((prev) => {
                const next = { ...prev }
                activePreviewItem.subObjects?.forEach((sub) => {
                  next[sub.id] = {
                    ...(next[sub.id] || { material: selectedMaterial }),
                    colorHex: color.hex,
                    colorName: color.name,
                  }
                })
                return next
              })
            }
          } else {
            setPartConfigs((prev) => ({
              ...prev,
              [configTargetSub.id]: {
                ...(prev[configTargetSub.id] || { material: activeCustomMaterial }),
                colorHex: color.hex,
                colorName: color.name,
              },
            }))
          }
        }

        const handleApplyPartToAll = (sourceSubId: string) => {
          const sourceCfg = partConfigs[sourceSubId]
          if (!sourceCfg || !activePreviewItem?.subObjects) return

          setSelectedMaterial(sourceCfg.material)
          setSelectedColorHex(sourceCfg.colorHex)
          setSelectedColorName(sourceCfg.colorName)

          setPartConfigs((prev) => {
            const next = { ...prev }
            activePreviewItem.subObjects?.forEach((sub) => {
              next[sub.id] = { ...sourceCfg }
            })
            return next
          })
        }

        // Build per-part materials map for the 3D viewer
        const currentPartMaterials: Record<string, { colorHex: string; materialType: FilamentMaterial }> = {}
        activePreviewItem?.subObjects?.forEach((sub, idx) => {
          const cfg = partConfigs[sub.id]
          if (cfg) {
            currentPartMaterials[sub.id] = {
              colorHex: cfg.colorHex,
              materialType: cfg.material,
            }
            currentPartMaterials[String(idx)] = {
              colorHex: cfg.colorHex,
              materialType: cfg.material,
            }
          }
        })

        const displayGeometry = activeSubObject ? null : activePreviewItem?.geometry
        const displayGroup = activeSubObject ? activeSubObject.group : activePreviewItem?.group
        const displayDimensions = activeSubObject ? activeSubObject.dimensions : activePreviewItem?.dimensions
        const displayVolumeCc = activeSubObject ? activeSubObject.volumeCc : activePreviewItem?.volumeCc

        const activeSubCfg = activeSubObject ? partConfigs[activeSubObject.id] : null
        const viewerColorHex = activeSubCfg ? activeSubCfg.colorHex : selectedColorHex
        const viewerMaterialType = activeSubCfg ? activeSubCfg.material : selectedMaterial

        const displayTitle = activeSubObject
          ? `${activePreviewItem?.file.name} · ${activeSubObject.name}`
          : activePreviewItem?.file.name

        const isFit = displayDimensions
          ? displayDimensions.x <= 220 &&
            displayDimensions.y <= 220 &&
            displayDimensions.z <= 250
          : true

        return (
          <div className="pt-6 border-t border-slate-150 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Active 3D Preview on Ender-3 V3 SE Bed */}
              <div className="lg:col-span-7 xl:col-span-7 space-y-4">
                {/* 3MF Sub-Object Tab Selector */}
                {activePreviewItem?.subObjects && activePreviewItem.subObjects.length > 1 && (
                  <div className="bg-slate-100/90 rounded-2xl p-2.5 border border-slate-200/80 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-orange-500" />
                        <span>{activePreviewItem.subObjects.length} Objects in this 3MF:</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">Click to inspect & customize</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubObjectMap((prev) => ({ ...prev, [activePreviewItem.id]: 'all' }))
                          setActiveConfigPartId('all')
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          currentSubId === 'all'
                            ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>All Objects ({activePreviewItem.subObjects.length} Arranged)</span>
                      </button>
                      {activePreviewItem.subObjects.map((sub, idx) => {
                        const isSelected = currentSubId === sub.id
                        const subCfg = partConfigs[sub.id]
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubObjectMap((prev) => ({ ...prev, [activePreviewItem.id]: sub.id }))
                              setActiveConfigPartId(sub.id)
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                              isSelected
                                ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                          >
                            {subCfg && (
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: subCfg.colorHex }}
                              />
                            )}
                            <span>Part {idx + 1}: {sub.name}</span>
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                              ({sub.dimensions.x}×{sub.dimensions.y}mm)
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(displayGeometry || displayGroup) ? (
                  <Ender3BedViewer
                    geometry={displayGeometry}
                    group={displayGroup}
                    colorHex={viewerColorHex}
                    materialType={viewerMaterialType}
                    partMaterials={currentPartMaterials}
                    fileName={displayTitle}
                    dimensions={displayDimensions}
                    volumeCc={displayVolumeCc}
                    quantity={activePreviewItem?.quantity || 1}
                  />
                ) : (
                  <div className="w-full aspect-[4/3] rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-6">
                    <FileCode2 className="h-10 w-10 text-slate-350 mb-3" />
                    <p className="text-sm font-bold text-slate-700">3D Preview Unavailable</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[220px] mx-auto">
                      Click any file in the queue above to inspect it on the Ender-3 V3 SE build plate.
                    </p>
                  </div>
                )}
                
                {activePreviewItem && displayDimensions && (
                  <div className="space-y-2.5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Active View / Part</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[260px]">{displayTitle}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Dimensions (W × D × H)</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {displayDimensions.x} × {displayDimensions.y} × {displayDimensions.z} mm
                        </span>
                      </div>
                      {displayVolumeCc != null && (
                        <div className="flex justify-between items-center text-slate-500">
                          <span>{activeSubObject ? 'Part Volume' : 'Total 3MF Volume'}</span>
                          <span className="font-semibold text-slate-800 font-mono">
                            {displayVolumeCc.toFixed(1)} cm³
                          </span>
                        </div>
                      )}
                      {activeSubCfg && (
                        <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200/60">
                          <span>Assigned Config</span>
                          <span className="font-semibold text-orange-600 flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-slate-300"
                              style={{ backgroundColor: activeSubCfg.colorHex }}
                            />
                            <span>{activeSubCfg.material.toUpperCase()} · {activeSubCfg.colorName}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ender-3 V3 SE Fit Badge */}
                    {isFit ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs flex items-center justify-between text-emerald-800">
                        <span className="flex items-center gap-2 font-bold">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          Fits Ender-3 V3 SE Bed
                        </span>
                        <span className="text-xs text-emerald-600 font-mono font-medium">Max 220×220×250mm</span>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs flex items-start gap-2.5 text-amber-900">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Object exceeds Ender-3 V3 SE print volume</p>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            This object is {displayDimensions.x}×{displayDimensions.y}×{displayDimensions.z}mm. Max is 220×220×250mm. You can scale it down, rotate it using the toolbar on the 3D preview, or request our studio to slice into interlocking parts.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Parameters & Checkout */}
              <div className="lg:col-span-5 xl:col-span-5 space-y-5">
                {/* Multi-Part Customization Switcher */}
                {activePreviewItem?.subObjects && activePreviewItem.subObjects.length > 1 && (
                  <div className="bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-slate-50 border border-orange-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-orange-500" />
                        <span>Part Color & Material</span>
                      </span>
                      <span className="text-[10px] font-semibold text-orange-600 bg-orange-100/70 px-2 py-0.5 rounded-full">
                        {activePreviewItem.subObjects.length} Independent Parts
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">
                      Select which part to configure with its own filament material and color:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveConfigPartId('all')
                          setSelectedSubObjectMap((prev) => ({ ...prev, [activePreviewItem.id]: 'all' }))
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          activeConfigPartId === 'all'
                            ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>All (Synced)</span>
                      </button>

                      {activePreviewItem.subObjects.map((sub, idx) => {
                        const isTarget = activeConfigPartId === sub.id
                        const cfg = partConfigs[sub.id] || {
                          material: selectedMaterial,
                          colorHex: selectedColorHex,
                          colorName: selectedColorName,
                        }
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setActiveConfigPartId(sub.id)
                              setSelectedSubObjectMap((prev) => ({ ...prev, [activePreviewItem.id]: sub.id }))
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs transition flex items-center gap-2 ${
                              isTarget
                                ? 'bg-orange-500 text-white font-bold shadow-sm ring-1 ring-orange-400'
                                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                            }`}
                          >
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0 shadow-inner"
                              style={{ backgroundColor: cfg.colorHex }}
                            />
                            <div className="text-left min-w-0 flex-1">
                              <p className="truncate text-[11px] leading-tight font-bold">Part {idx + 1}</p>
                              <p className={`text-[9px] uppercase tracking-wider font-semibold ${isTarget ? 'text-orange-100' : 'text-slate-400'}`}>
                                {cfg.material}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {isPerPartConfig && configTargetSub && (
                      <div className="flex items-center justify-between pt-1 border-t border-orange-200/50 text-[11px]">
                        <span className="text-slate-600">
                          Now customizing: <strong>{configTargetSub.name}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyPartToAll(configTargetSub.id)}
                          className="text-orange-600 hover:text-orange-700 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <span>⚡ Apply to all parts</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Material Toggle Buttons */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Material {isPerPartConfig && configTargetSub ? `(For ${configTargetSub.name})` : '(All Parts)'}
                    </label>
                    <span className="text-[10px] font-semibold text-orange-600 uppercase">
                      {activeCustomMaterial}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableMaterials.map((mat) => (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => handleMaterialClick(mat)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                          activeCustomMaterial === mat
                            ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {MATERIAL_LABELS[mat] ?? mat.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Color Swatch Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Color ({activeCustomColorName})
                    </label>
                    <span className="text-[10px] font-semibold text-orange-600 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" /> Live 3D Update
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {dynamicColorList.map((c) => {
                      const isSelected = activeCustomColorHex.toLowerCase() === c.hex.toLowerCase()
                      return (
                        <button
                          key={c.name + c.hex}
                          type="button"
                          onClick={() => handleColorClick(c)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 text-slate-900 font-bold'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0 shadow-inner"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs truncate">{c.name}</span>
                        </button>
                      )
                    })}
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

              {/* Print Quantity Selector */}
              <div className="pt-3 border-t border-slate-150 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Print Quantity
                  </label>
                  {estimate.batchDiscountPct > 0 ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-pulse">
                      🔥 {estimate.batchDiscountPct}% Batch Discount
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Order 3+ for batch discount
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Stepper */}
                  <div className="flex items-center border border-slate-200 bg-slate-50 rounded-xl overflow-hidden p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => activePreviewItem && updateItemQuantity(activePreviewItem.id, (activePreviewItem.quantity || 1) - 1)}
                      disabled={(activePreviewItem?.quantity || 1) <= 1}
                      className="h-8 w-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition font-bold text-base shadow-xs"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={activePreviewItem?.quantity || 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        if (activePreviewItem) updateItemQuantity(activePreviewItem.id, val)
                      }}
                      className="w-14 text-center text-sm font-black font-mono text-slate-900 bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => activePreviewItem && updateItemQuantity(activePreviewItem.id, (activePreviewItem.quantity || 1) + 1)}
                      className="h-8 w-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition font-bold text-base shadow-xs"
                    >
                      +
                    </button>
                  </div>

                  {/* Multi-part total breakdown note */}
                  <div className="text-xs text-slate-500 leading-tight">
                    {activePreviewItem?.subObjects && activePreviewItem.subObjects.length > 1 ? (
                      <div>
                        <span className="font-bold text-slate-800 font-mono">
                          {(activePreviewItem.quantity || 1)} set{(activePreviewItem.quantity || 1) !== 1 ? 's' : ''}
                        </span>
                        <span className="text-slate-400"> · </span>
                        <span className="font-bold text-orange-600 font-mono">
                          {(activePreviewItem.quantity || 1) * activePreviewItem.subObjects.length} parts total
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          ({activePreviewItem.subObjects.length} parts per set)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-800 font-mono">
                          {(activePreviewItem?.quantity || 1)} unit{(activePreviewItem?.quantity || 1) !== 1 ? 's' : ''}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Identical precision prints</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { qty: 1, label: '1x' },
                    { qty: 2, label: '2x' },
                    { qty: 3, label: '3x (5% off)' },
                    { qty: 5, label: '5x (10% off)' },
                    { qty: 10, label: '10x (15% off)' },
                  ].map((preset) => (
                    <button
                      key={preset.qty}
                      type="button"
                      onClick={() => activePreviewItem && updateItemQuantity(activePreviewItem.id, preset.qty)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                        (activePreviewItem?.quantity || 1) === preset.qty
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
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
                  <span className="font-semibold text-slate-700 font-mono">
                    {estimate.weight} grams
                    {estimate.totalUnits > 1 && (
                      <span className="text-slate-400 font-normal ml-1 font-sans">({estimate.totalUnits} copies)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Est. Print Time (Total)</span>
                  <span className="font-semibold text-slate-700 font-mono">
                    {estimate.hours} hour{estimate.hours !== 1 ? 's' : ''}
                  </span>
                </div>

                {estimate.batchDiscountPct > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-600 font-medium">
                    <span className="flex items-center gap-1">
                      <span>🔥 Batch Volume Discount ({estimate.batchDiscountPct}%)</span>
                    </span>
                    <span className="font-bold font-mono">
                      Applied
                    </span>
                  </div>
                )}

                {estimate.discountAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-xs border-t border-dashed border-orange-100/50 pt-2">
                      <span className="text-slate-500 font-medium">Base Price</span>
                      <span className="font-semibold text-slate-500 font-mono line-through">
                        RM {estimate.rawPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-emerald-600 font-medium">
                      <span className="flex items-center gap-0.5">Total Discounts</span>
                      <span className="font-bold font-mono">
                        - RM {estimate.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}

                <div className="border-t border-orange-100/50 pt-2.5 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                      {estimate.discountAmount > 0 ? 'Discounted Total' : 'Estimated Cost'}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-black text-orange-600 font-mono leading-none">
                        RM {estimate.price.toFixed(2)}
                      </p>
                      {estimate.totalUnits > 1 && (
                        <span className="text-[11px] font-bold text-slate-500 font-mono">
                          (RM {estimate.unitPrice.toFixed(2)} / set)
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400">Excludes delivery</span>
                </div>

                {estimate.price <= MINIMUM_ORDER_PRICE && (
                  <div className="text-[10px] text-amber-600 font-semibold mt-1 bg-amber-50 rounded-lg px-2 py-1 flex items-center gap-1 border border-amber-100/70">
                    <Info className="h-3 w-3 shrink-0 text-amber-500" /> Note: RM {MINIMUM_ORDER_PRICE.toFixed(2)} minimum order price applied.
                  </div>
                )}

                {/* Multi-Part Itemized Breakdown */}
                {activePreviewItem?.subObjects && activePreviewItem.subObjects.length > 1 && (
                  <div className="pt-2 border-t border-orange-200/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Parts Breakdown ({activePreviewItem.subObjects.length * (activePreviewItem.quantity || 1)} parts across {activePreviewItem.quantity || 1} sets)
                      </span>
                      <span className="text-[10px] text-orange-600 font-medium">Click to select</span>
                    </div>
                    <div className="space-y-1">
                      {activePreviewItem.subObjects.map((sub, idx) => {
                        const subCfg = partConfigs[sub.id] || {
                          material: selectedMaterial,
                          colorHex: selectedColorHex,
                          colorName: selectedColorName,
                        }
                        const isPartSelected = currentSubId === sub.id
                        const qty = activePreviewItem.quantity || 1
                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              setSelectedSubObjectMap((prev) => ({ ...prev, [activePreviewItem.id]: sub.id }))
                              setActiveConfigPartId(sub.id)
                            }}
                            className={`flex items-center justify-between text-xs p-1.5 rounded-lg border transition cursor-pointer ${
                              isPartSelected
                                ? 'bg-orange-100/70 border-orange-300 shadow-2xs'
                                : 'bg-white/80 hover:bg-white border-orange-100/60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: subCfg.colorHex }}
                              />
                              <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                                Part {idx + 1}: {sub.name}
                              </span>
                              {qty > 1 && (
                                <span className="text-[10px] font-bold text-orange-700 bg-orange-200/70 px-1 rounded">
                                  ×{qty}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-slate-600">
                              <span className="font-bold text-orange-600 uppercase">{subCfg.material}</span>
                              <span>·</span>
                              <span className="truncate max-w-[80px]">{subCfg.colorName}</span>
                              <span>·</span>
                              <span>{(sub.volumeCc * qty).toFixed(1)} cm³</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Proceed to Order / WhatsApp Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleProceedToOrder}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/15 hover:bg-orange-600 transition hover:shadow-orange-500/25 active:scale-98"
                >
                  Proceed to Request <ChevronRight className="h-4 w-4" />
                </button>
                {printer.whatsapp && (
                  <a
                    href={`https://wa.me/${printer.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hi Qid3D Studio! I configured a 3D print:\n• File: ${activePreviewItem?.file.name || 'Custom Model'}\n• Quantity: ${activePreviewItem?.quantity || 1} ${activePreviewItem?.subObjects && activePreviewItem.subObjects.length > 1 ? `sets (${(activePreviewItem.quantity || 1) * activePreviewItem.subObjects.length} parts total)` : 'units'}\n• Dimensions: ${activePreviewItem?.dimensions.x || 0} × ${activePreviewItem?.dimensions.y || 0} × ${activePreviewItem?.dimensions.z || 0} mm\n• Material: ${selectedMaterial.toUpperCase()}\n• Color: ${selectedColorName}\n• Est. Total Cost: RM ${estimate.price.toFixed(2)}${estimate.batchDiscountPct > 0 ? ` (Includes ${estimate.batchDiscountPct}% Batch Discount)` : ''}\n\nCan you review my order?`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition whitespace-nowrap"
                  >
                    <span>💬 Chat on WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    })()}

      {estimate && (
        <RequestCheckoutModal
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          files={slicedItems.map((item) => item.file)}
          quantity={activePreviewItem?.quantity || 1}
          dimensions={activePreviewItem?.dimensions}
          volumeCc={activePreviewItem?.volumeCc}
          subObjects={activePreviewItem?.subObjects}
          partConfigs={partConfigs}
          material={selectedMaterial}
          colorName={selectedColorName}
          colorHex={selectedColorHex}
          infill={infill}
          nozzle={nozzle}
          estimate={estimate}
          printer={printer}
          activePromo={activePromo}
        />
      )}
    </div>
  )
}
