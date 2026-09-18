'use client'

import { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import JSZip from 'jszip'
import { Box, Layers, AlertCircle, RotateCw } from 'lucide-react'
import type { FilamentMaterial } from '@/lib/types'
import Ender3BedViewer, { type PartColorMaterial } from './Ender3BedViewer'

export interface SubObjectItem {
  id: string
  name: string
  dimensions: { x: number; y: number; z: number }
  volumeCc: number
  group: THREE.Group
}

interface Props {
  urls: string[]
  colorHex?: string
  materialType?: FilamentMaterial
  partMaterials?: Record<string, PartColorMaterial>
  fileName?: string
  dimensions?: { x: number; y: number; z: number } | null
  volumeCc?: number
  quantity?: number
  className?: string
  canvasHeight?: string
}

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

    volume +=
      (x1 * (y2 * z3 - y3 * z2) +
        x2 * (y3 * z1 - y1 * z3) +
        x3 * (y1 * z2 - y2 * z1)) /
      6.0
  }

  if (needsDispose) {
    nonIndexed.dispose()
  }

  return Math.abs(volume)
}

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
    clone.position.sub(center)

    const size = new THREE.Vector3()
    box.getSize(size)
    const subId = subObjects ? subObjects[idx]?.id : undefined
    clone.userData = { subObjectId: subId, partIndex: idx }
    centeredItems.push({ obj: clone, size, subId, idx })
  })

  const gap = 12
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

export default function Ender3BedViewerFromUrls({
  urls,
  colorHex = '#f97316',
  materialType = 'pla',
  partMaterials,
  fileName,
  dimensions: initialDimensions,
  volumeCc: initialVolumeCc,
  quantity = 1,
  className = '',
  canvasHeight = 'h-[320px] sm:h-[360px] lg:h-[390px]',
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [group, setGroup] = useState<THREE.Group | null>(null)
  const [subObjects, setSubObjects] = useState<SubObjectItem[]>([])
  const [activeSubId, setActiveSubId] = useState<'all' | string>('all')
  const [computedDims, setComputedDims] = useState<{ x: number; y: number; z: number } | null>(
    initialDimensions || null
  )
  const [computedVolume, setComputedVolume] = useState<number | null>(initialVolumeCc || null)

  const activeUrl = urls && urls.length > 0 ? urls[0] : null
  const urlsKey = (urls || []).join(',')

  useEffect(() => {
    if (!activeUrl) {
      setLoading(false)
      return
    }

    let isCancelled = false
    setLoading(true)
    setError(null)

    async function loadModel() {
      try {
        const res = await fetch(activeUrl!)
        if (!res.ok) {
          throw new Error(`Failed to download 3D file (${res.status} ${res.statusText})`)
        }
        const arrayBuffer = await res.arrayBuffer()
        if (isCancelled) return

        const urlPath = activeUrl!.split('?')[0].toLowerCase()
        const is3MF = urlPath.endsWith('.3mf')
        const isOBJ = urlPath.endsWith('.obj')

        if (is3MF) {
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
          } catch {}

          const loader = new ThreeMFLoader()
          const parsedGroup = loader.parse(arrayBuffer)

          parsedGroup.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              child.geometry.computeVertexNormals()
            }
          })

          const subList: SubObjectItem[] = []
          const rawChildren = parsedGroup.children.length > 0 ? [...parsedGroup.children] : [parsedGroup]
          let totalVol = 0

          rawChildren.forEach((child, idx) => {
            const childClone = child.clone()
            const childRawBox = new THREE.Box3().setFromObject(childClone)
            const childRawSize = new THREE.Vector3()
            childRawBox.getSize(childRawSize)
            const maxDim = Math.max(childRawSize.x, childRawSize.y, childRawSize.z)

            let scaleMult = 1
            if (maxDim > 0 && maxDim < 1.0) scaleMult = 1000
            else if (maxDim > 2500) scaleMult = 0.001
            if (scaleMult !== 1) childClone.scale.multiplyScalar(scaleMult)

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
            totalVol += childVol

            const subId = `sub_${idx}`
            const partName = extractedNames[idx] || `Part ${idx + 1}`

            const partContainer = new THREE.Group()
            partContainer.userData = { subObjectId: subId, partIndex: idx }
            partContainer.add(childClone)

            subList.push({
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

          const arrangedGroup = rawChildren.length > 1 ? createArrangedGroup(rawChildren, subList) : parsedGroup
          const totalBox = new THREE.Box3().setFromObject(arrangedGroup)
          const totalSize = new THREE.Vector3()
          totalBox.getSize(totalSize)

          if (!isCancelled) {
            setGroup(arrangedGroup)
            setGeometry(null)
            setSubObjects(subList.length > 1 ? subList : [])
            setComputedDims({
              x: Math.round(totalSize.x * 10) / 10,
              y: Math.round(totalSize.y * 10) / 10,
              z: Math.round(totalSize.z * 10) / 10,
            })
            setComputedVolume(Math.max(Math.round((totalVol / 1000) * 10) / 10, 0.5))
            setLoading(false)
          }
        } else if (isOBJ) {
          const text = new TextDecoder().decode(arrayBuffer)
          const loader = new OBJLoader()
          const parsedGroup = loader.parse(text)

          parsedGroup.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              child.geometry.computeVertexNormals()
            }
          })

          const box = new THREE.Box3().setFromObject(parsedGroup)
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z)
          let scaleMult = 1
          if (maxDim > 0 && maxDim < 1.0) scaleMult = 1000
          else if (maxDim > 2500) scaleMult = 0.001
          if (scaleMult !== 1) {
            parsedGroup.scale.multiplyScalar(scaleMult)
            box.setFromObject(parsedGroup)
            box.getSize(size)
          }

          if (!isCancelled) {
            setGroup(parsedGroup)
            setGeometry(null)
            setSubObjects([])
            setComputedDims({
              x: Math.round(size.x * 10) / 10,
              y: Math.round(size.y * 10) / 10,
              z: Math.round(size.z * 10) / 10,
            })
            setLoading(false)
          }
        } else {
          // Default to STL
          const loader = new STLLoader()
          const geo = loader.parse(arrayBuffer)
          geo.computeVertexNormals()
          geo.computeBoundingBox()

          const box = geo.boundingBox || new THREE.Box3()
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z)
          let scaleMult = 1
          if (maxDim > 0 && maxDim < 1.0) scaleMult = 1000
          else if (maxDim > 2500) scaleMult = 0.001
          if (scaleMult !== 1) {
            geo.scale(scaleMult, scaleMult, scaleMult)
            geo.computeBoundingBox()
            geo.boundingBox?.getSize(size)
          }

          const vol = calculateGeometryVolume(geo)
          const volumeCc = Math.max(Math.round((vol / 1000) * 10) / 10, 0.5)

          if (!isCancelled) {
            setGeometry(geo)
            setGroup(null)
            setSubObjects([])
            setComputedDims({
              x: Math.round(size.x * 10) / 10,
              y: Math.round(size.y * 10) / 10,
              z: Math.round(size.z * 10) / 10,
            })
            setComputedVolume(volumeCc)
            setLoading(false)
          }
        }
      } catch (err: any) {
        console.error('Error loading 3D model for Ender3BedViewer:', err)
        if (!isCancelled) {
          setError(err?.message || 'Failed to load 3D model')
          setLoading(false)
        }
      }
    }

    loadModel()

    return () => {
      isCancelled = true
    }
  }, [activeUrl, urlsKey])

  const activeSubObject = subObjects.find((s) => s.id === activeSubId)
  const displayGroup = activeSubObject ? activeSubObject.group : group
  const displayGeometry = activeSubObject ? null : geometry
  const displayDimensions = activeSubObject ? activeSubObject.dimensions : (computedDims || initialDimensions || undefined)
  const displayVolume = activeSubObject ? activeSubObject.volumeCc : (computedVolume || initialVolumeCc || undefined)

  const resolvedFileName = fileName || (activeUrl ? activeUrl.split('/').pop()?.split('?')[0]?.replace(/^\d+_/, '') : '3D Model')

  return (
    <div className="space-y-2.5">
      {/* 3MF Sub-Object Tab Selector (if multiple objects exist in package) */}
      {subObjects.length > 1 && (
        <div className="bg-slate-100/90 rounded-2xl p-2 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs px-1 mb-1.5">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
              <Layers className="h-3.5 w-3.5 text-orange-500" />
              <span>{subObjects.length} Parts in this Package:</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Click to inspect on bed</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveSubId('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubId === 'all'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>All Parts Arranged</span>
            </button>
            {subObjects.map((sub, idx) => {
              const isSelected = activeSubId === sub.id
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubId(sub.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-orange-500 text-white shadow-xs font-bold'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <span>{sub.name || `Part ${idx + 1}`}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                    ({sub.dimensions.x}×{sub.dimensions.y}mm)
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* The Authentic Ender-3 V3 SE Bed 3D Viewer (Reused directly from homepage) */}
      <Ender3BedViewer
        geometry={displayGeometry}
        group={displayGroup}
        colorHex={colorHex}
        materialType={materialType}
        partMaterials={partMaterials}
        fileName={activeSubObject ? `${resolvedFileName} · ${activeSubObject.name}` : resolvedFileName}
        dimensions={displayDimensions}
        volumeCc={displayVolume}
        quantity={quantity}
        className={className}
        canvasHeight={canvasHeight}
        isLoading={loading}
      />

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Notice: {error}. Model geometry is safely preserved in cloud storage for studio slicing.</span>
        </div>
      )}
    </div>
  )
}
