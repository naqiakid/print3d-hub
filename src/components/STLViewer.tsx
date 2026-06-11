'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type Props = {
  urls?: string[]
  colors?: string[]
  file?: File
  highlightIndex?: number   // which mesh to spotlight (-1 or undefined = all normal)
  className?: string
}

export default function STLViewer({ urls: urlsProp, colors: colorsProp, file, highlightIndex, className }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const meshesRef   = useRef<THREE.Mesh[]>([])
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef    = useRef<THREE.Scene | null>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // ── Scene setup ──────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    meshesRef.current = []

    let blobUrl: string | null = null
    const urls   = file ? ((blobUrl = URL.createObjectURL(file)), [blobUrl]) : (urlsProp ?? [])
    const colors = colorsProp ?? []

    if (!mount || urls.length === 0) return

    setLoading(true)
    setError('')

    const w = mount.clientWidth  || 480
    const h = mount.clientHeight || 320

    const scene  = new THREE.Scene()
    scene.background = new THREE.Color(0xf8f9fa)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    // Cap at 2× to avoid 4× GPU work on HiDPI displays
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2)
    dir1.position.set(1, 2, 3)
    scene.add(dir1)
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.6)
    dir2.position.set(-2, -1, -1)
    scene.add(dir2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate    = false

    const stlLoader = new STLLoader()
    const group     = new THREE.Group()
    let loaded   = 0
    let hasError = false

    urls.forEach((url, i) => {
      const mat = new THREE.MeshPhongMaterial({
        color:       new THREE.Color(colors[i] || '#cccccc'),
        specular:    new THREE.Color(0x222222),
        shininess:   30,
        transparent: false,
        opacity:     1,
      })

      stlLoader.load(
        url,
        (geometry) => {
          geometry.computeVertexNormals()
          const mesh = new THREE.Mesh(geometry, mat)
          mesh.userData.index = i

          geometry.computeBoundingBox()
          const centre = new THREE.Vector3()
          geometry.boundingBox!.getCenter(centre)
          geometry.translate(-centre.x, -centre.y, -centre.z)

          group.add(mesh)
          meshesRef.current[i] = mesh
          loaded++

          if (loaded === urls.length && !hasError) {
            if (urls.length > 1) {
              const extents = meshesRef.current.map((m) => {
                const box = new THREE.Box3().setFromObject(m)
                return box.getSize(new THREE.Vector3()).x
              })
              const maxExtent = Math.max(...extents)
              const spacing   = maxExtent * 1.4
              const totalW    = spacing * (urls.length - 1)
              meshesRef.current.forEach((m, j) => {
                m.position.x = -totalW / 2 + j * spacing
              })
            }

            const box     = new THREE.Box3().setFromObject(group)
            const size    = box.getSize(new THREE.Vector3())
            const centre2 = box.getCenter(new THREE.Vector3())
            const maxDim  = Math.max(size.x, size.y, size.z)
            const fov     = camera.fov * (Math.PI / 180)
            const dist    = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5

            group.position.sub(centre2)
            camera.position.set(0, dist * 0.4, dist)
            camera.near = dist / 100
            camera.far  = dist * 100
            camera.updateProjectionMatrix()
            controls.target.set(0, 0, 0)
            controls.update()

            scene.add(group)
            renderer.render(scene, camera)   // one-shot initial render
            setLoading(false)
          }
        },
        undefined,
        () => {
          if (!hasError) {
            hasError = true
            setError('Could not load 3D model')
            setLoading(false)
          }
        },
      )
    })

    // ── Render on demand ─────────────────────────────────────────
    // Only run the animation loop while the user is interacting.
    // OrbitControls fires 'change' on every frame during damping, so the
    // loop runs until damping fully settles, then stops automatically.
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, (urlsProp ?? []).join(','), (colorsProp ?? []).join(',')])

  // ── Highlight effect ─────────────────────────────────────────────
  useEffect(() => {
    const meshes = meshesRef.current.filter(Boolean)
    if (meshes.length === 0) return

    const active = highlightIndex !== undefined && highlightIndex >= 0

    meshes.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshPhongMaterial
      if (!active) {
        mat.opacity = 1; mat.transparent = false; mat.emissive.set(0x000000)
      } else if (i === highlightIndex) {
        mat.opacity = 1; mat.transparent = false; mat.emissive.set(0x555555)
      } else {
        mat.opacity = 0.12; mat.transparent = true; mat.emissive.set(0x000000)
      }
      mat.needsUpdate = true
    })

    const r = rendererRef.current
    const s = sceneRef.current
    const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  }, [highlightIndex])

  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-50 ${className ?? ''}`}>
      <div ref={mountRef} className="w-full h-full" />
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
