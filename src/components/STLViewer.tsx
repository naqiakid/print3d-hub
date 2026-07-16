'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { PartAssembly, getDirectDownloadUrl } from '@/lib/types'

type Props = {
  urls?: string[]
  fileNames?: string[]      // original file names — used to pick the right loader per URL
  colors?: string[]         // one colour per URL (whole-object fallback)
  partColors?: string[][]   // per-URL array of per-part colours (for multi-object 3MF)
  assemblyOffsets?: PartAssembly[]
  file?: File
  highlightIndex?: number   // which slot to spotlight (-1 or undefined = all normal)
  className?: string
}

export default function STLViewer({
  urls: urlsProp,
  fileNames: fileNamesProp,
  colors: colorsProp,
  partColors: partColorsProp,
  assemblyOffsets,
  file,
  highlightIndex,
  className,
}: Props) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const objectsRef  = useRef<THREE.Object3D[]>([])
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef    = useRef<THREE.Scene | null>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [dims, setDims]       = useState<{ x: number; y: number; z: number } | null>(null)
  const isAssembled = false

  // Refs so the scene-setup effect can read current colours without them being deps
  const colorsRef     = useRef<string[]>([])
  const partColorsRef = useRef<string[][]>([])
  colorsRef.current     = colorsProp     ?? []
  partColorsRef.current = partColorsProp ?? []

  // ── Scene setup (re-runs only when URLs / file names change) ────
  useEffect(() => {
    const mount = mountRef.current
    objectsRef.current = []
    setDims(null)

    let blobUrl: string | null = null
    const urls      = file ? ((blobUrl = URL.createObjectURL(file)), [blobUrl]) : (urlsProp ?? [])
    const fileNames = fileNamesProp ?? []

    if (!mount || urls.length === 0) return

    setLoading(true)
    setError('')

    const w = mount.clientWidth  || 480
    const h = mount.clientHeight || 320

    const scene  = new THREE.Scene()
    // Gradient background: light blue-gray at top → medium slate at bottom.
    // Gives contrast against both dark and light print colors.
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width  = 2
    bgCanvas.height = 512
    const bgCtx = bgCanvas.getContext('2d')!
    const grad  = bgCtx.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, '#dde5ef')
    grad.addColorStop(1, '#7a92a8')
    bgCtx.fillStyle = grad
    bgCtx.fillRect(0, 0, 2, 512)
    scene.background = new THREE.CanvasTexture(bgCanvas)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Hemisphere light provides sky (warm white) + ground (cool blue) fill so
    // dark-colored objects still show 3D form instead of going fully black.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8faabf, 0.8))
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.0)
    dir1.position.set(2, 3, 4)
    scene.add(dir1)
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.4)
    dir2.position.set(-2, -1, -1)
    scene.add(dir2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate    = false

    const group   = new THREE.Group()
    let loaded    = 0
    let hasError  = false

    function makeMat(color: string) {
      return new THREE.MeshPhongMaterial({
        color:       new THREE.Color(color || '#cccccc'),
        specular:    new THREE.Color(0x222222),
        shininess:   30,
        transparent: false,
        opacity:     1,
      })
    }

    function onAllLoaded() {
      if (loaded !== urls.length || hasError) return

      if (urls.length > 1 && !isAssembled) {
        const extents = objectsRef.current.map((obj) =>
          new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).x
        )
        const maxExtent = Math.max(...extents)
        const spacing   = maxExtent * 1.4
        const totalW    = spacing * (urls.length - 1)
        objectsRef.current.forEach((obj, j) => {
          obj.position.x = -totalW / 2 + j * spacing
        })
      }

      const box     = new THREE.Box3().setFromObject(group)
      const size    = box.getSize(new THREE.Vector3())
      const centre2 = box.getCenter(new THREE.Vector3())
      const maxDim  = Math.max(size.x, size.y, size.z)
      const fov     = camera.fov * (Math.PI / 180)
      const dist    = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5

      group.position.sub(centre2)

      // Add a grid helper representing the print bed
      const gridW = maxDim * 2.5
      const gridHelper = new THREE.GridHelper(gridW, 20, 0xf97316, 0xcbd5e1)
      gridHelper.position.y = -size.y / 2 - 0.05
      scene.add(gridHelper)

      // Save dimensions (in mm)
      setDims({
        x: Math.round(size.x * 10) / 10,
        y: Math.round(size.y * 10) / 10,
        z: Math.round(size.z * 10) / 10,
      })

      camera.position.set(0, dist * 0.4, dist)
      camera.near = dist / 100
      camera.far  = dist * 100
      camera.updateProjectionMatrix()
      controls.target.set(0, 0, 0)
      controls.update()

      scene.add(group)
      renderer.render(scene, camera)
      setLoading(false)
    }

    function onError() {
      if (!hasError) {
        hasError = true
        setError('Could not load 3D model')
        setLoading(false)
      }
    }

    urls.forEach((url, i) => {
      const name = fileNames[i] ?? url
      const ext  = name.split('.').pop()?.toLowerCase() ?? 'stl'

      // ── STL: loader returns BufferGeometry ────────────────────────
      function onGeometry(geometry: THREE.BufferGeometry) {
        geometry.computeVertexNormals()
        const mesh = new THREE.Mesh(geometry, makeMat(colorsRef.current[i] || '#cccccc'))
        mesh.userData.index = i

        geometry.computeBoundingBox()
        const centre = new THREE.Vector3()
        geometry.boundingBox!.getCenter(centre)
        
        // Center the part first if in exploded view OR if custom assembly offsets exist
        const shouldCenter = !isAssembled || !!(assemblyOffsets && assemblyOffsets[i])
        if (shouldCenter) {
          geometry.translate(-centre.x, -centre.y, -centre.z)
        }

        // Apply custom position and rotation offsets
        if (isAssembled && assemblyOffsets && assemblyOffsets[i]) {
          const offset = assemblyOffsets[i]
          mesh.position.set(offset.x, offset.y, offset.z)
          mesh.rotation.set(
            THREE.MathUtils.degToRad(offset.rx ?? 0),
            THREE.MathUtils.degToRad(offset.ry ?? 0),
            THREE.MathUtils.degToRad(offset.rz ?? 0)
          )
        }

        group.add(mesh)
        objectsRef.current[i] = mesh
        loaded++
        onAllLoaded()
      }

      // ── 3MF / OBJ: loader returns Group ──────────────────────────
      function onGroupLoaded(obj: THREE.Group) {
        const parts = partColorsRef.current[i]
        if (parts && parts.length > 0) {
          // Apply a distinct colour to each top-level child (one per 3MF object)
          obj.children.forEach((child, j) => {
            const mat = makeMat(parts[j] || colorsRef.current[i] || '#cccccc')
            child.traverse((c) => { if (c instanceof THREE.Mesh) c.material = mat })
          })
        } else {
          // Single colour for the whole model
          const mat = makeMat(colorsRef.current[i] || '#cccccc')
          obj.traverse((child) => { if (child instanceof THREE.Mesh) child.material = mat })
        }

        const box    = new THREE.Box3().setFromObject(obj)
        const centre = box.getCenter(new THREE.Vector3())
        
        // Center the part first if in exploded view OR if custom assembly offsets exist
        const shouldCenter = !isAssembled || !!(assemblyOffsets && assemblyOffsets[i])
        if (shouldCenter) {
          obj.position.sub(centre)
        }

        // Apply custom position and rotation offsets
        if (isAssembled && assemblyOffsets && assemblyOffsets[i]) {
          const offset = assemblyOffsets[i]
          obj.position.set(offset.x, offset.y, offset.z)
          obj.rotation.set(
            THREE.MathUtils.degToRad(offset.rx ?? 0),
            THREE.MathUtils.degToRad(offset.ry ?? 0),
            THREE.MathUtils.degToRad(offset.rz ?? 0)
          )
        }

        obj.userData.index = i
        group.add(obj)
        objectsRef.current[i] = obj
        loaded++
        onAllLoaded()
      }

      const downloadUrl = getDirectDownloadUrl(url)
      if (ext === '3mf') {
        new ThreeMFLoader().load(downloadUrl, onGroupLoaded, undefined, onError)
      } else if (ext === 'obj') {
        new OBJLoader().load(downloadUrl, onGroupLoaded, undefined, onError)
      } else {
        new STLLoader().load(downloadUrl, onGeometry, undefined, onError)
      }
    })

    // ── Render on demand ─────────────────────────────────────────
    let animId: number | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    function stopLoop() {
      if (animId !== null) { cancelAnimationFrame(animId); animId = null }
    }

    function startLoop() {
      if (animId !== null) return
      function loop() {
        // eslint-disable-next-line no-restricted-syntax
        animId = requestAnimationFrame(loop)
        controls.update()
        renderer.render(scene, camera)
      }
      loop()
    }

    function onControlsChange() {
      if (idleTimer) clearTimeout(idleTimer)
      startLoop()
      idleTimer = setTimeout(stopLoop, 1000)
    }

    controls.addEventListener('change', onControlsChange)

    const ro = new ResizeObserver(() => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      controls.update()
      renderer.render(scene, camera)
    })
    ro.observe(mount)

    return () => {
      stopLoop()
      if (idleTimer) clearTimeout(idleTimer)
      controls.removeEventListener('change', onControlsChange)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current    = null
      cameraRef.current   = null
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [file, (urlsProp ?? []).join(','), (fileNamesProp ?? []).join(','), JSON.stringify(assemblyOffsets)])

  // ── Live colour updates (no scene rebuild) ───────────────────────
  useEffect(() => {
    const objects = objectsRef.current.filter(Boolean)
    if (objects.length === 0) return

    objects.forEach((obj, i) => {
      const parts    = (partColorsProp ?? [])[i]
      const objColor = (colorsProp ?? [])[i] || '#cccccc'

      if (parts && parts.length > 0 && obj instanceof THREE.Group) {
        obj.children.forEach((child, j) => {
          const color = parts[j] || objColor
          child.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              const mat = c.material as THREE.MeshPhongMaterial
              mat.color.set(new THREE.Color(color))
              mat.needsUpdate = true
            }
          })
        })
      } else {
        obj.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            const mat = c.material as THREE.MeshPhongMaterial
            mat.color.set(new THREE.Color(objColor))
            mat.needsUpdate = true
          }
        })
      }
    })

    const r = rendererRef.current
    const s = sceneRef.current
    const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    (colorsProp ?? []).join(','),
    (partColorsProp ?? []).map((a) => (a ?? []).join(',')).join('|'),
  ])

  // ── Highlight effect ─────────────────────────────────────────────
  useEffect(() => {
    const objects = objectsRef.current.filter(Boolean)
    if (objects.length === 0) return

    const active = highlightIndex !== undefined && highlightIndex >= 0

    objects.forEach((obj, i) => {
      const applyToMesh = (m: THREE.Mesh) => {
        const mat = m.material as THREE.MeshPhongMaterial
        if (!active) {
          mat.opacity = 1; mat.transparent = false; mat.emissive.set(0x000000)
        } else if (i === highlightIndex) {
          mat.opacity = 1; mat.transparent = false; mat.emissive.set(0x555555)
        } else {
          mat.opacity = 0.12; mat.transparent = true; mat.emissive.set(0x000000)
        }
        mat.needsUpdate = true
      }

      if (obj instanceof THREE.Mesh) {
        applyToMesh(obj)
      } else {
        obj.traverse((child) => { if (child instanceof THREE.Mesh) applyToMesh(child) })
      }
    })

    const r = rendererRef.current
    const s = sceneRef.current
    const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  }, [highlightIndex])

  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-50 ${className ?? ''}`}>
      <div ref={mountRef} className="w-full h-full" />
      {dims && (
        <div className="absolute left-3 top-3 rounded-xl bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm shadow-md select-none border border-white/10 pointer-events-none">
          <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Scale / Dimensions</p>
          <p className="font-mono">
            {dims.x} × {dims.y} × {dims.z} mm
          </p>
        </div>
      )}

      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
            <span className="text-xs text-slate-400">Loading 3D model…</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      )}
      {!loading && !error && (
        <p className="absolute bottom-2 right-3 text-[10px] text-slate-300 select-none pointer-events-none">
          Drag to rotate · scroll to zoom
        </p>
      )}
    </div>
  )
}
