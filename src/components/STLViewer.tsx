'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default function STLViewer({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 10000)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(1, 2, 2)
    scene.add(dir)

    const loader = new STLLoader()
    const url = URL.createObjectURL(file)

    loader.load(url, (geometry) => {
      geometry.computeBoundingBox()
      geometry.computeVertexNormals()

      const box = geometry.boundingBox!
      const center = new THREE.Vector3()
      box.getCenter(center)
      geometry.translate(-center.x, -center.y, -center.z)

      const size = new THREE.Vector3()
      box.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 100 / maxDim
      geometry.scale(scale, scale, scale)

      const material = new THREE.MeshPhongMaterial({
        color: 0xf97316,
        specular: 0x444444,
        shininess: 40,
      })
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      camera.position.set(0, 80, 180)
      camera.lookAt(0, 0, 0)
      controls.update()
    })

    let rafId: number
    function animate() {
      rafId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      URL.revokeObjectURL(url)
      renderer.dispose()
    }
  }, [file])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-48 rounded-xl bg-slate-50"
      style={{ display: 'block' }}
    />
  )
}
