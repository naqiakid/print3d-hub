'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { FilamentMaterial } from '@/lib/types'
import {
  RotateCw,
  AlertTriangle,
  Play,
  Pause,
  Compass,
  RefreshCw,
  Sun,
  Moon,
  Ruler,
  Crosshair,
  CreditCard,
  Smartphone,
  Coffee,
  X,
  Sparkles,
  Info,
} from 'lucide-react'

// Ender-3 V3 SE Hardware Limits
export const ENDER3_BED_X = 220
export const ENDER3_BED_Z = 220 // Depth in Three.js is Z
export const ENDER3_BED_Y = 250 // Max height in Three.js is Y

export type ReferenceObjectType = 'none' | 'coin' | 'card' | 'phone' | 'can' | 'mug'
export type BackgroundTheme = 'light' | 'dark' | 'cad'

export interface PartColorMaterial {
  colorHex: string
  materialType: FilamentMaterial
}

interface Props {
  geometry?: THREE.BufferGeometry | null
  group?: THREE.Group | null
  colorHex?: string
  materialType?: FilamentMaterial
  partMaterials?: Record<string, PartColorMaterial>
  fileName?: string
  dimensions?: { x: number; y: number; z: number }
  volumeCc?: number
  quantity?: number
  className?: string
  canvasHeight?: string
  isLoading?: boolean
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof (ctx as any).roundRect === 'function') {
    ;(ctx as any).roundRect(x, y, w, h, r)
  } else {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
  }
}

// ── TEXT SPRITE FACTORY (Camera-facing CAD Badges) ──
function createTextSprite(
  text: string,
  bgColor = 'rgba(15, 23, 42, 0.88)',
  borderColor = '#f97316'
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 80
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Pill background
    ctx.fillStyle = bgColor
    ctx.beginPath()
    drawRoundRect(ctx, 6, 6, 372, 68, 16)
    ctx.fill()

    // Border
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 4
    ctx.beginPath()
    drawRoundRect(ctx, 6, 6, 372, 68, 16)
    ctx.stroke()

    // Text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 192, 40)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(38, 8, 1)
  return sprite
}

// ── REFERENCE OBJECT GENERATORS (Exact Real-World Scale in mm) ──
function buildReferenceGroup(
  type: ReferenceObjectType,
  modelBox: THREE.Box3,
  theme: BackgroundTheme
): THREE.Group | null {
  if (type === 'none') return null
  const group = new THREE.Group()

  const modelWidth = modelBox.max.x - modelBox.min.x
  const modelDepth = modelBox.max.z - modelBox.min.z

  // Placement strategy: place to the right of model if it fits on the 220mm bed,
  // otherwise place on left or front
  let offsetX = modelBox.max.x + 16
  let offsetZ = 0
  let labelHeight = 30
  let labelText = ''

  if (type === 'coin') {
    // Malaysian 50 Sen Coin: 22.65mm diameter, 1.9mm thickness
    const radius = 22.65 / 2
    const height = 1.9
    const geo = new THREE.CylinderGeometry(radius, radius, height, 32)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Gold brass
      metalness: 0.88,
      roughness: 0.22,
    })
    const coin = new THREE.Mesh(geo, mat)
    coin.position.y = height / 2
    coin.castShadow = true
    coin.receiveShadow = true
    group.add(coin)

    // Ribbed rim ring
    const ringGeo = new THREE.RingGeometry(radius * 0.75, radius * 0.92, 24)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xb8860b, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = height + 0.05
    group.add(ring)

    offsetX += radius
    labelHeight = 22
    labelText = '🪙 50¢ Coin (Ø22.7mm)'
  } else if (type === 'card') {
    // MyKad / Credit Card: 85.6mm width x 54.0mm height x 0.8mm depth
    const w = 85.6
    const h = 54.0
    const r = 3.5
    const cardShape = new THREE.Shape()
    cardShape.moveTo(-w / 2 + r, -h / 2)
    cardShape.lineTo(w / 2 - r, -h / 2)
    cardShape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false)
    cardShape.lineTo(w / 2, h / 2 - r)
    cardShape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false)
    cardShape.lineTo(-w / 2 + r, h / 2)
    cardShape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false)
    cardShape.lineTo(-w / 2, -h / 2 + r)
    cardShape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, (Math.PI * 3) / 2, false)

    const cardGeo = new THREE.ExtrudeGeometry(cardShape, { depth: 0.8, bevelEnabled: false })
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // MyKad Cyan / Ocean Blue
      metalness: 0.25,
      roughness: 0.45,
    })
    const card = new THREE.Mesh(cardGeo, cardMat)
    // Stand upright on its long edge on bed plate
    card.rotation.x = 0
    card.position.set(0, h / 2, 0)
    card.castShadow = true
    card.receiveShadow = true
    group.add(card)

    // Microchip detail
    const chipGeo = new THREE.BoxGeometry(11, 8.5, 0.9)
    const chipMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 })
    const chip = new THREE.Mesh(chipGeo, chipMat)
    chip.position.set(-w / 4, h / 2, 0.45)
    group.add(chip)

    offsetX += w / 2
    labelHeight = h + 14
    labelText = '💳 MyKad / Card (85.6×54mm)'
  } else if (type === 'phone') {
    // Smartphone (iPhone 6.1"): 71.5mm width x 147.0mm height x 7.8mm thickness
    const w = 71.5
    const h = 147.0
    const r = 8.5
    const phoneShape = new THREE.Shape()
    phoneShape.moveTo(-w / 2 + r, -h / 2)
    phoneShape.lineTo(w / 2 - r, -h / 2)
    phoneShape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false)
    phoneShape.lineTo(w / 2, h / 2 - r)
    phoneShape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false)
    phoneShape.lineTo(-w / 2 + r, h / 2)
    phoneShape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false)
    phoneShape.lineTo(-w / 2, -h / 2 + r)
    phoneShape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, (Math.PI * 3) / 2, false)

    const phoneGeo = new THREE.ExtrudeGeometry(phoneShape, { depth: 7.8, bevelEnabled: false })
    const phoneMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark Titanium Grey
      metalness: 0.65,
      roughness: 0.35,
    })
    const phone = new THREE.Mesh(phoneGeo, phoneMat)
    phone.position.set(0, h / 2, 0)
    phone.castShadow = true
    phone.receiveShadow = true
    group.add(phone)

    // Glossy OLED screen
    const screenGeo = new THREE.PlaneGeometry(w - 6, h - 8)
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.1, metalness: 0.5 })
    const screen = new THREE.Mesh(screenGeo, screenMat)
    screen.position.set(0, h / 2, 7.85)
    group.add(screen)

    offsetX += w / 2
    labelHeight = h + 14
    labelText = '📱 Smartphone (147×71.5mm)'
  } else if (type === 'can') {
    // 330ml Drink Can: 66mm diameter (radius 33mm), 115mm height
    const radius = 33
    const height = 115
    const canGeo = new THREE.CylinderGeometry(radius, radius, height, 32)
    const canMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Classic Red
      metalness: 0.6,
      roughness: 0.3,
    })
    const can = new THREE.Mesh(canGeo, canMat)
    can.position.y = height / 2
    can.castShadow = true
    can.receiveShadow = true
    group.add(can)

    // Silver Top Lid
    const lidGeo = new THREE.CylinderGeometry(radius * 0.95, radius, 3, 32)
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
    const lid = new THREE.Mesh(lidGeo, lidMat)
    lid.position.y = height
    group.add(lid)

    offsetX += radius
    labelHeight = height + 16
    labelText = '🥤 Drink Can (115mm)'
  } else if (type === 'mug') {
    // Coffee Mug: 82mm diameter (radius 41mm), 96mm height
    const radius = 41
    const height = 96
    const mugGeo = new THREE.CylinderGeometry(radius, radius * 0.92, height, 32)
    const mugMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Ceramic White
      metalness: 0.05,
      roughness: 0.25,
    })
    const mug = new THREE.Mesh(mugGeo, mugMat)
    mug.position.y = height / 2
    mug.castShadow = true
    mug.receiveShadow = true
    group.add(mug)

    // Handle
    const handleGeo = new THREE.TorusGeometry(18, 5, 16, 24, Math.PI)
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 })
    const handle = new THREE.Mesh(handleGeo, handleMat)
    handle.rotation.z = -Math.PI / 2
    handle.position.set(radius + 6, height * 0.52, 0)
    group.add(handle)

    offsetX += radius + 10
    labelHeight = height + 16
    labelText = '☕ Coffee Mug (96mm)'
  }

  // Ensure placement stays on bed (Ender-3 bed is [-110, +110])
  if (offsetX + 20 > ENDER3_BED_X / 2) {
    // Move to left side
    offsetX = modelBox.min.x - 16 - (offsetX - modelBox.max.x)
    if (offsetX - 20 < -ENDER3_BED_X / 2) {
      // Move to front
      offsetX = 0
      offsetZ = modelBox.max.z + 24
    }
  }

  group.position.set(offsetX, 0, offsetZ)

  // Floating label badge
  const labelSprite = createTextSprite(
    labelText,
    theme === 'light' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.92)',
    '#38bdf8'
  )
  labelSprite.position.set(offsetX, labelHeight, offsetZ)
  group.add(labelSprite)

  return group
}

// ── 3D CALIPER DIMENSION LINES (Width X, Depth Y, Height Z) ──
function buildDimensionRulers(modelBox: THREE.Box3): THREE.Group {
  const group = new THREE.Group()

  const minX = modelBox.min.x
  const maxX = modelBox.max.x
  const minY = modelBox.min.y
  const maxY = modelBox.max.y
  const minZ = modelBox.min.z
  const maxZ = modelBox.max.z

  const widthX = maxX - minX
  const depthZ = maxZ - minZ
  const heightY = maxY - minY

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  })

  // 1. Width Line (Front Bottom Edge)
  const zOffset = maxZ + 8
  const wPoints = [
    new THREE.Vector3(minX, 1, zOffset - 4),
    new THREE.Vector3(minX, 1, zOffset + 4),
    new THREE.Vector3(minX, 1, zOffset),
    new THREE.Vector3(maxX, 1, zOffset),
    new THREE.Vector3(maxX, 1, zOffset - 4),
    new THREE.Vector3(maxX, 1, zOffset + 4),
  ]
  const wGeo = new THREE.BufferGeometry().setFromPoints(wPoints)
  group.add(new THREE.LineSegments(wGeo, lineMat))
  const wSprite = createTextSprite(`⟷ W: ${widthX.toFixed(1)} mm`, 'rgba(15, 23, 42, 0.9)', '#f97316')
  wSprite.position.set((minX + maxX) / 2, 4, zOffset + 5)
  group.add(wSprite)

  // 2. Depth Line (Right Bottom Edge)
  const xOffset = maxX + 8
  const dPoints = [
    new THREE.Vector3(xOffset - 4, 1, minZ),
    new THREE.Vector3(xOffset + 4, 1, minZ),
    new THREE.Vector3(xOffset, 1, minZ),
    new THREE.Vector3(xOffset, 1, maxZ),
    new THREE.Vector3(xOffset - 4, 1, maxZ),
    new THREE.Vector3(xOffset + 4, 1, maxZ),
  ]
  const dGeo = new THREE.BufferGeometry().setFromPoints(dPoints)
  group.add(new THREE.LineSegments(dGeo, lineMat))
  const dSprite = createTextSprite(`⤢ D: ${depthZ.toFixed(1)} mm`, 'rgba(15, 23, 42, 0.9)', '#38bdf8')
  dSprite.position.set(xOffset + 5, 4, (minZ + maxZ) / 2)
  group.add(dSprite)

  // 3. Height Line (Back Right Vertical Edge)
  const hMat = new THREE.LineBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  })
  const hx = maxX + 8
  const hz = minZ - 4
  const hPoints = [
    new THREE.Vector3(hx - 4, minY, hz),
    new THREE.Vector3(hx + 4, minY, hz),
    new THREE.Vector3(hx, minY, hz),
    new THREE.Vector3(hx, maxY, hz),
    new THREE.Vector3(hx - 4, maxY, hz),
    new THREE.Vector3(hx + 4, maxY, hz),
  ]
  const hGeo = new THREE.BufferGeometry().setFromPoints(hPoints)
  group.add(new THREE.LineSegments(hGeo, hMat))
  const hSprite = createTextSprite(`↕ H: ${heightY.toFixed(1)} mm`, 'rgba(15, 23, 42, 0.9)', '#10b981')
  hSprite.position.set(hx + 8, (minY + maxY) / 2, hz)
  group.add(hSprite)

  return group
}

// ── HUMAN SCALE CONTEXT CALCULATOR ──
function getHumanScaleDescriptor(maxDim: number): string {
  if (maxDim <= 25) return '🪙 Coin-sized (Tiny)'
  if (maxDim <= 60) return '🔑 Key / Thumb-drive sized'
  if (maxDim <= 95) return '💳 Pocket-sized (Credit card)'
  if (maxDim <= 155) return '📱 Handheld (Smartphone size)'
  if (maxDim <= 210) return '🥤 Desktop object (Can / Mug size)'
  return '📦 Large print (Full build plate)'
}

export default function Ender3BedViewer({
  geometry,
  group,
  colorHex = '#1a1a1a',
  materialType = 'pla',
  partMaterials,
  fileName,
  dimensions,
  volumeCc,
  quantity = 1,
  className = '',
  canvasHeight,
  isLoading = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Viewer Preferences & Controls
  const [autoRotate, setAutoRotate] = useState(false)
  const [viewMode, setViewMode] = useState<'iso' | 'top' | 'front'>('iso')
  const [showWireframeBox, setShowWireframeBox] = useState(true)
  const [rotationStepsY, setRotationStepsY] = useState(0) // 90° turns around Y (horizontal)
  const [rotationStepsX, setRotationStepsX] = useState(0) // 90° turns around X (tilt / lay flat)
  const [liveDims, setLiveDims] = useState<{ x: number; y: number; z: number } | null>(null)

  // New Features: Background Theme, Everyday Reference Objects & Calipers
  const [bgTheme, setBgTheme] = useState<BackgroundTheme>('light') // Default to Light Studio for crisp contrast!
  const [refObject, setRefObject] = useState<ReferenceObjectType>('none')
  const [show3DDimensions, setShow3DDimensions] = useState(true)

  // Interactive Caliper Tool
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([])
  const [caliperDistance, setCaliperDistance] = useState<number | null>(null)

  // Internal Three.js handles
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const targetMeshRef = useRef<THREE.Object3D | null>(null)
  const caliperGroupRef = useRef<THREE.Group | null>(null)
  const defaultCamPos = useRef<THREE.Vector3>(new THREE.Vector3(260, 240, 320))
  const defaultTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 40, 0))

  // Compute model dimensions & bed fit
  const modelX = liveDims?.x ?? dimensions?.x ?? 0
  const modelY = liveDims?.y ?? dimensions?.y ?? 0
  const modelZ = liveDims?.z ?? dimensions?.z ?? 0
  const maxModelDimension = Math.max(modelX, modelY, modelZ)

  const fitsBed =
    modelX <= ENDER3_BED_X &&
    modelY <= ENDER3_BED_Z &&
    modelZ <= ENDER3_BED_Y

  const partMaterialsKey = JSON.stringify(partMaterials || {})

  // ── MAIN THREE.JS INITIALIZATION ──
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const width = container.clientWidth > 0 ? container.clientWidth : 600
    const height = container.clientHeight > 0 ? container.clientHeight : 460

    // ── 1. SCENE & BACKGROUND THEME ──
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Calibrate background color based on theme
    if (bgTheme === 'light') {
      scene.background = new THREE.Color(0xf1f5f9) // Soft warm studio light
      scene.fog = new THREE.Fog(0xf1f5f9, 700, 2400)
    } else if (bgTheme === 'dark') {
      scene.background = new THREE.Color(0x090d16) // Deep studio dark slate
      scene.fog = new THREE.Fog(0x090d16, 700, 2400)
    } else {
      scene.background = new THREE.Color(0x1e293b) // Neutral CAD slate
      scene.fog = new THREE.Fog(0x1e293b, 700, 2400)
    }

    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 8000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = bgTheme === 'light' ? 1.05 : 1.2
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap

    // ── 2. LIGHTING ──
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      bgTheme === 'light' ? 1.25 : 0.85
    )
    scene.add(ambientLight)

    const hemiLight = new THREE.HemisphereLight(
      0xffffff,
      bgTheme === 'light' ? 0x94a3b8 : 0x334155,
      bgTheme === 'light' ? 0.75 : 0.55
    )
    scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, bgTheme === 'light' ? 1.6 : 1.9)
    keyLight.position.set(220, 380, 240)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 1024
    keyLight.shadow.mapSize.height = 1024
    keyLight.shadow.bias = -0.001
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(
      bgTheme === 'light' ? 0xc7d2fe : 0x93c5fd,
      0.65
    )
    fillLight.position.set(-220, 160, -220)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xf97316, 0.35)
    rimLight.position.set(0, -80, 220)
    scene.add(rimLight)

    // ── 3. CREALITY ENDER-3 V3 SE BUILD PLATE ──
    const bedGroup = new THREE.Group()

    // Textured Steel PEI Bed Plate (220 x 2.5 x 220 mm)
    const bedGeo = new THREE.BoxGeometry(ENDER3_BED_X, 2.5, ENDER3_BED_Z)
    const bedMat = new THREE.MeshStandardMaterial({
      color: bgTheme === 'light' ? 0x1f2937 : 0x141822, // High-contrast matte charcoal
      roughness: 0.82,
      metalness: 0.12,
    })
    const bedMesh = new THREE.Mesh(bedGeo, bedMat)
    bedMesh.position.y = -1.25 // Top surface rests precisely at Y = 0
    bedMesh.receiveShadow = true
    bedGroup.add(bedMesh)

    // Front Grab Tab / Notch
    const notchGeo = new THREE.BoxGeometry(45, 2.4, 12)
    const notchMesh = new THREE.Mesh(notchGeo, bedMat)
    notchMesh.position.set(0, -1.25, ENDER3_BED_Z / 2 + 6)
    bedGroup.add(notchMesh)

    // Minor Grid (10mm subdivisions)
    const minorGrid = new THREE.GridHelper(
      ENDER3_BED_X,
      ENDER3_BED_X / 10,
      bgTheme === 'light' ? 0x38bdf8 : 0x3b82f6,
      bgTheme === 'light' ? 0x475569 : 0x334155
    )
    minorGrid.position.y = 0.05
    ;(minorGrid.material as THREE.Material).opacity = bgTheme === 'light' ? 0.45 : 0.32
    ;(minorGrid.material as THREE.Material).transparent = true
    bedGroup.add(minorGrid)

    // Major Grid (50mm blocks)
    const majorGrid = new THREE.GridHelper(
      ENDER3_BED_X,
      ENDER3_BED_X / 50,
      0x38bdf8,
      bgTheme === 'light' ? 0x64748b : 0x475569
    )
    majorGrid.position.y = 0.08
    ;(majorGrid.material as THREE.Material).opacity = 0.75
    ;(majorGrid.material as THREE.Material).transparent = true
    bedGroup.add(majorGrid)

    // Center Crosshair Marker
    const crosshairGeo = new THREE.RingGeometry(4, 5.5, 24)
    const crosshairMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
    const crosshair = new THREE.Mesh(crosshairGeo, crosshairMat)
    crosshair.rotation.x = Math.PI / 2
    crosshair.position.y = 0.1
    bedGroup.add(crosshair)

    // Build Volume Wireframe Box (220 x 250 x 220 mm)
    if (showWireframeBox) {
      const volumeBoxGeo = new THREE.BoxGeometry(ENDER3_BED_X, ENDER3_BED_Y, ENDER3_BED_Z)
      const volumeBoxEdges = new THREE.EdgesGeometry(volumeBoxGeo)
      const volumeBoxMat = new THREE.LineBasicMaterial({
        color: fitsBed ? (bgTheme === 'light' ? 0x0284c7 : 0x38bdf8) : 0xef4444,
        transparent: true,
        opacity: fitsBed ? 0.25 : 0.65,
      })
      const volumeBoxLines = new THREE.LineSegments(volumeBoxEdges, volumeBoxMat)
      volumeBoxLines.position.set(0, ENDER3_BED_Y / 2, 0)
      bedGroup.add(volumeBoxLines)
    }

    scene.add(bedGroup)

    // ── 4. LOAD & GROUND 3D MODEL ──
    const modelContainer = new THREE.Group()
    const allocatedMaterials: THREE.Material[] = []

    const getPbrParams = (mat: FilamentMaterial = 'pla') => {
      const isTPU = mat === 'tpu'
      const isPETG = mat === 'petg'
      return {
        roughness: isTPU ? 0.88 : isPETG ? 0.22 : 0.48,
        metalness: isPETG ? 0.14 : 0.03,
      }
    }

    const defaultPbr = getPbrParams(materialType)
    const modelMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: defaultPbr.roughness,
      metalness: defaultPbr.metalness,
    })
    allocatedMaterials.push(modelMaterial)

    let targetMesh: THREE.Object3D | null = null

    if (geometry) {
      const geo = geometry.clone()
      geo.computeVertexNormals()

      // Smart unit detection: meters vs mm vs um
      geo.computeBoundingBox()
      if (geo.boundingBox) {
        const rawSize = new THREE.Vector3()
        geo.boundingBox.getSize(rawSize)
        const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z)
        if (rawMax > 0 && rawMax < 1.0) {
          geo.scale(1000, 1000, 1000)
          geo.computeBoundingBox()
        } else if (rawMax > 2500) {
          geo.scale(0.001, 0.001, 0.001)
          geo.computeBoundingBox()
        }
      }

      const mesh = new THREE.Mesh(geo, modelMaterial)
      mesh.castShadow = true
      mesh.receiveShadow = true
      targetMesh = mesh
    } else if (group) {
      const groupClone = group.clone()

      // Smart unit detection for group
      const rawBox = new THREE.Box3().setFromObject(groupClone)
      const rawSize = new THREE.Vector3()
      rawBox.getSize(rawSize)
      const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z)
      if (rawMax > 0 && rawMax < 1.0) {
        groupClone.scale.multiplyScalar(1000)
      } else if (rawMax > 2500) {
        groupClone.scale.multiplyScalar(0.001)
      }

      const hasPartMaterials = partMaterials && Object.keys(partMaterials).length > 0

      if (hasPartMaterials && groupClone.children.length > 0) {
        groupClone.children.forEach((child, idx) => {
          let subId = child.userData?.subObjectId
          if (!subId) {
            child.traverse((c) => {
              if (!subId && c.userData?.subObjectId) {
                subId = c.userData.subObjectId
              }
            })
          }
          if (!subId && groupClone.userData?.subObjectId) {
            subId = groupClone.userData.subObjectId
          }

          const partCfg =
            (subId && partMaterials[subId]) ||
            partMaterials[String(idx)] ||
            partMaterials[`part_${idx}`]

          const partColor = partCfg ? partCfg.colorHex : colorHex
          const partMatType = partCfg ? partCfg.materialType : materialType
          const pbr = getPbrParams(partMatType)

          const partMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(partColor),
            roughness: pbr.roughness,
            metalness: pbr.metalness,
          })
          allocatedMaterials.push(partMat)

          child.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              if (c.geometry) {
                c.geometry.computeVertexNormals()
              }
              c.material = partMat
              c.castShadow = true
              c.receiveShadow = true
            }
          })
        })
      } else {
        groupClone.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.computeVertexNormals()
            }
            child.material = modelMaterial
            child.castShadow = true
            child.receiveShadow = true
          }
        })
      }

      targetMesh = groupClone
    }

    targetMeshRef.current = targetMesh

    if (targetMesh) {
      // Center mesh geometry locally so user rotations are balanced
      const localBox = new THREE.Box3().setFromObject(targetMesh)
      const localCenter = new THREE.Vector3()
      localBox.getCenter(localCenter)
      targetMesh.position.sub(localCenter)

      // Apply 90° Rotations
      targetMesh.rotation.y = rotationStepsY * (Math.PI / 2)
      targetMesh.rotation.x = rotationStepsX * (Math.PI / 2)

      modelContainer.add(targetMesh)

      // Ground model flush onto Ender-3 build plate (top surface at Y = 0)
      const boundsBox = new THREE.Box3().setFromObject(modelContainer)
      const boundsCenter = new THREE.Vector3()
      boundsBox.getCenter(boundsCenter)

      modelContainer.position.x = -boundsCenter.x
      modelContainer.position.z = -boundsCenter.z
      modelContainer.position.y = -boundsBox.min.y // Elevate so base sits on Y = 0

      scene.add(modelContainer)

      // Live oriented dimensions
      const finalPlacedBox = new THREE.Box3().setFromObject(modelContainer)
      const finalPlacedSize = new THREE.Vector3()
      finalPlacedBox.getSize(finalPlacedSize)

      setLiveDims({
        x: Math.round(finalPlacedSize.x * 10) / 10,
        y: Math.round(finalPlacedSize.z * 10) / 10, // Bed depth is Three.js Z
        z: Math.round(finalPlacedSize.y * 10) / 10, // Bed height is Three.js Y
      })

      // ── 5. OPTIONAL EVERYDAY REFERENCE OBJECT ──
      if (refObject !== 'none' && finalPlacedSize.x > 0) {
        const refGroup = buildReferenceGroup(refObject, finalPlacedBox, bgTheme)
        if (refGroup) scene.add(refGroup)
      }

      // ── 6. OPTIONAL 3D DIMENSION CALLOUT RULERS ──
      if (show3DDimensions && finalPlacedSize.x > 0) {
        const rulersGroup = buildDimensionRulers(finalPlacedBox)
        if (rulersGroup) scene.add(rulersGroup)
      }

      // Orange Bounding Box
      const boxGeo = new THREE.BoxGeometry(finalPlacedSize.x, finalPlacedSize.y, finalPlacedSize.z)
      const edges = new THREE.EdgesGeometry(boxGeo)
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.35,
      })
      const dimensionBox = new THREE.LineSegments(edges, lineMat)
      finalPlacedBox.getCenter(dimensionBox.position)
      scene.add(dimensionBox)
    }

    // ── 7. CALIPER MEASUREMENT GROUP CONTAINER ──
    const caliperGroup = new THREE.Group()
    caliperGroupRef.current = caliperGroup
    scene.add(caliperGroup)

    // ── 8. CAMERA POSITIONING & ORBIT CONTROLS ──
    const hasModel = !!(geometry || group) && targetMesh !== null
    const finalBox = hasModel
      ? new THREE.Box3().setFromObject(modelContainer)
      : new THREE.Box3(new THREE.Vector3(-110, 0, -110), new THREE.Vector3(110, 20, 110))
    const finalSize = new THREE.Vector3()
    finalBox.getSize(finalSize)

    const maxModelDim = hasModel ? Math.max(finalSize.x, finalSize.y, finalSize.z, 50) : 220
    const focusHeight = hasModel ? Math.min(finalSize.y * 0.45, 120) : 15

    const camDist = hasModel ? Math.max(maxModelDim * 1.65, 270) : 340
    defaultCamPos.current.set(camDist * 0.85, camDist * 0.75, camDist * 0.95)
    defaultTarget.current.set(0, focusHeight, 0)

    camera.position.copy(defaultCamPos.current)
    camera.lookAt(defaultTarget.current)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 30
    controls.maxDistance = 2500
    controls.maxPolarAngle = Math.PI / 2 + 0.05
    controls.target.copy(defaultTarget.current)
    controlsRef.current = controls

    // ── 9. ANIMATION LOOP ──
    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)

      if (autoRotate && controls) {
        controls.autoRotate = true
        controls.autoRotateSpeed = 1.2
      } else if (controls) {
        controls.autoRotate = false
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ── 10. RESIZE OBSERVER ──
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w <= 0 || h <= 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(container)

    // ── CLEANUP ──
    return () => {
      cancelAnimationFrame(reqId)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      allocatedMaterials.forEach((m) => m.dispose())
      bedGeo.dispose()
      bedMat.dispose()
    }
  }, [
    geometry,
    group,
    colorHex,
    materialType,
    partMaterialsKey,
    showWireframeBox,
    rotationStepsY,
    rotationStepsX,
    bgTheme,
    refObject,
    show3DDimensions,
  ])

  // ── POINT-TO-POINT CALIPER MEASUREMENT HANDLER ──
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!measureMode || !cameraRef.current || !targetMeshRef.current || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current)

    const intersects = raycaster.intersectObjects([targetMeshRef.current], true)
    if (intersects.length === 0) return

    const hitPoint = intersects[0].point.clone()

    if (measurePoints.length === 0 || measurePoints.length >= 2) {
      // Start new measurement
      setMeasurePoints([hitPoint])
      setCaliperDistance(null)
      renderCaliperVisuals([hitPoint])
    } else if (measurePoints.length === 1) {
      // Lock point B
      const p1 = measurePoints[0]
      const p2 = hitPoint
      const dist = p1.distanceTo(p2)
      setMeasurePoints([p1, p2])
      setCaliperDistance(Math.round(dist * 10) / 10)
      renderCaliperVisuals([p1, p2], dist)
    }
  }

  const renderCaliperVisuals = (pts: THREE.Vector3[], dist?: number) => {
    const caliperGroup = caliperGroupRef.current
    if (!caliperGroup) return

    // Clear previous
    while (caliperGroup.children.length > 0) {
      caliperGroup.remove(caliperGroup.children[0])
    }

    // Draw markers
    pts.forEach((pt) => {
      const dotGeo = new THREE.SphereGeometry(2.2, 16, 16)
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, depthTest: false })
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.copy(pt)
      caliperGroup.add(dot)
    })

    // If 2 points, draw connecting laser line + distance badge
    if (pts.length === 2 && dist != null) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x06b6d4,
        dashSize: 3,
        gapSize: 2,
        depthTest: false,
      })
      const line = new THREE.Line(lineGeo, lineMat)
      line.computeLineDistances()
      caliperGroup.add(line)

      // Distance tag
      const mid = pts[0].clone().add(pts[1]).multiplyScalar(0.5)
      const tag = createTextSprite(`📐 ${dist.toFixed(1)} mm`, 'rgba(6, 182, 212, 0.95)', '#ffffff')
      tag.position.copy(mid).add(new THREE.Vector3(0, 6, 0))
      caliperGroup.add(tag)
    }
  }

  const handleClearCaliper = () => {
    setMeasurePoints([])
    setCaliperDistance(null)
    const caliperGroup = caliperGroupRef.current
    if (caliperGroup) {
      while (caliperGroup.children.length > 0) {
        caliperGroup.remove(caliperGroup.children[0])
      }
    }
  }

  // Camera Presets
  const handleSetView = (mode: 'iso' | 'top' | 'front') => {
    setViewMode(mode)
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    controls.reset()
    const dist = defaultCamPos.current.length()
    const target = defaultTarget.current

    if (mode === 'top') {
      camera.position.set(0, dist * 1.15, 0.1)
    } else if (mode === 'front') {
      camera.position.set(0, target.y + 15, dist * 0.95)
    } else {
      camera.position.copy(defaultCamPos.current)
    }
    camera.lookAt(target)
    controls.target.copy(target)
  }

  const handleResetView = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    camera.position.copy(defaultCamPos.current)
    controls.target.copy(defaultTarget.current)
    setViewMode('iso')
  }

  const humanScaleText = getHumanScaleDescriptor(maxModelDimension)

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border shadow-xl select-none group transition-colors duration-300 ${
        bgTheme === 'light'
          ? 'bg-slate-100 border-slate-300 shadow-slate-300/40'
          : bgTheme === 'dark'
          ? 'bg-slate-950 border-slate-800 shadow-slate-900/60'
          : 'bg-slate-900 border-slate-700 shadow-slate-900/50'
      } ${className}`}
    >
      <div
        ref={containerRef}
        className={`relative w-full ${canvasHeight || 'min-h-[360px] sm:min-h-[460px] lg:min-h-[520px]'}`}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`w-full h-full block ${measureMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        />

        {/* Top Header: Model File Name & Build Plate Label */}
        <div className="absolute top-3 left-3 right-16 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
            {fileName && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl backdrop-blur-md border text-xs font-bold shadow-sm ${
                  bgTheme === 'light'
                    ? 'bg-white/95 text-slate-800 border-slate-300'
                    : 'bg-slate-900/90 text-slate-100 border-slate-700'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="truncate max-w-[200px] sm:max-w-[320px]">{fileName}</span>
              </div>
            )}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl backdrop-blur-md border text-[11px] font-semibold ${
                bgTheme === 'light'
                  ? 'bg-white/80 text-slate-600 border-slate-300'
                  : 'bg-slate-900/75 text-slate-400 border-slate-800'
              }`}
            >
              <span>Ender-3 V3 SE Plate (220×220mm)</span>
            </div>
            {quantity > 1 && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl backdrop-blur-md border text-[11px] font-bold shadow-xs ${
                  bgTheme === 'light'
                    ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/20'
                    : 'bg-orange-500/90 text-white border-orange-400/50'
                }`}
              >
                <span>🏷️ {quantity}× Batch</span>
              </div>
            )}
          </div>

          {/* Fit Status Badge */}
          <div
            className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border backdrop-blur-md shadow-sm ${
              fitsBed
                ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                : 'bg-red-500/15 text-red-500 border-red-500/30'
            }`}
          >
            {fitsBed ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Fits Bed</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                <span>Exceeds Bed Limit</span>
              </>
            )}
          </div>
        </div>

        {/* Caliper Measure Helper Alert (Visible when measure tool is ON) */}
        {measureMode && (
          <div className="absolute top-14 left-3 z-20 flex items-center gap-2 bg-cyan-950/90 border border-cyan-500/50 text-cyan-200 px-3 py-1.5 rounded-xl text-xs backdrop-blur-md shadow-lg animate-fade-in">
            <Crosshair className="h-4 w-4 text-cyan-400 shrink-0 animate-spin-slow" />
            <span>
              {measurePoints.length === 0 && 'Click any point on your 3D model to start measurement'}
              {measurePoints.length === 1 && 'Point 1 set. Click second point to measure distance'}
              {measurePoints.length === 2 && (
                <strong>
                  Distance: <span className="text-white font-mono">{caliperDistance} mm</span>
                </strong>
              )}
            </span>
            {measurePoints.length > 0 && (
              <button
                type="button"
                onClick={handleClearCaliper}
                className="ml-1 px-1.5 py-0.5 bg-cyan-800/80 hover:bg-cyan-700 text-white rounded text-[10px] font-bold transition"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMeasureMode(false)
                handleClearCaliper()
              }}
              className="ml-1 text-cyan-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Top-Right Control Toolbar */}
        <div className="absolute right-3 top-14 flex flex-col gap-1.5 z-10">
          {/* Background Studio Theme Switcher */}
          <button
            type="button"
            onClick={() => {
              setBgTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'cad' : 'light'))
            }}
            title={`Studio Background: ${bgTheme.toUpperCase()} (Click to change)`}
            className={`h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border transition active:scale-90 ${
              bgTheme === 'light'
                ? 'bg-white/95 text-amber-600 border-amber-300 shadow-md ring-1 ring-amber-300/40'
                : bgTheme === 'dark'
                ? 'bg-slate-900/90 text-indigo-300 border-slate-700 shadow-md'
                : 'bg-slate-800/90 text-cyan-400 border-cyan-800 shadow-md'
            }`}
          >
            {bgTheme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* 3D Measurement Rulers Toggle */}
          <button
            type="button"
            onClick={() => setShow3DDimensions((v) => !v)}
            title={show3DDimensions ? 'Hide 3D Dimension Rulers' : 'Show 3D Dimension Rulers'}
            className={`h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border transition active:scale-90 ${
              show3DDimensions
                ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/25'
                : bgTheme === 'light'
                ? 'bg-white/90 text-slate-500 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Ruler className="h-4 w-4" />
          </button>

          {/* Point-to-Point Caliper Measurement Tool */}
          <button
            type="button"
            onClick={() => {
              setMeasureMode((v) => !v)
              if (measureMode) handleClearCaliper()
            }}
            title={measureMode ? 'Close Point-to-Point Caliper' : 'Measure Point-to-Point Distance'}
            className={`h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border transition active:scale-90 ${
              measureMode
                ? 'bg-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/25 ring-2 ring-cyan-300'
                : bgTheme === 'light'
                ? 'bg-white/90 text-slate-500 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Crosshair className="h-4 w-4" />
          </button>

          <div className="h-[1px] w-6 mx-auto bg-slate-400/30 my-0.5" />

          {/* Auto Rotation */}
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            title={autoRotate ? 'Pause Rotation' : 'Start Auto-Rotation'}
            className={`h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border transition active:scale-90 ${
              autoRotate
                ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/25'
                : bgTheme === 'light'
                ? 'bg-white/90 text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          {/* Rotate 90° horizontally on bed */}
          <button
            type="button"
            onClick={() => setRotationStepsY((v) => (v + 1) % 4)}
            title="Rotate 90° on Bed (Horizontal)"
            className={`h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border transition active:scale-90 ${
              bgTheme === 'light'
                ? 'bg-white/90 text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <RotateCw className="h-4 w-4" />
          </button>

          {/* Tilt / Lay Flat 90° on X axis */}
          <button
            type="button"
            onClick={() => setRotationStepsX((v) => (v + 1) % 4)}
            title="Tilt / Lay Flat 90°"
            className={`h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border transition active:scale-90 ${
              bgTheme === 'light'
                ? 'bg-white/90 text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <div className="h-[1px] w-6 mx-auto bg-slate-400/30 my-0.5" />

          {/* 3D Isometric View */}
          <button
            type="button"
            onClick={() => handleSetView('iso')}
            title="Isometric 3D View"
            className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-bold backdrop-blur-md border transition active:scale-90 ${
              viewMode === 'iso'
                ? 'bg-slate-900 text-white border-slate-700 shadow-sm'
                : bgTheme === 'light'
                ? 'bg-white/90 text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            3D
          </button>

          {/* Top View */}
          <button
            type="button"
            onClick={() => handleSetView('top')}
            title="Top Bed View"
            className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-bold backdrop-blur-md border transition active:scale-90 ${
              viewMode === 'top'
                ? 'bg-slate-900 text-white border-slate-700 shadow-sm'
                : bgTheme === 'light'
                ? 'bg-white/90 text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            TOP
          </button>

          {/* Front / Side View */}
          <button
            type="button"
            onClick={() => handleSetView('front')}
            title="Front Height View"
            className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-bold backdrop-blur-md border transition active:scale-90 ${
              viewMode === 'front'
                ? 'bg-slate-900 text-white border-slate-700 shadow-sm'
                : bgTheme === 'light'
                ? 'bg-white/90 text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            SIDE
          </button>

          {/* Reset Camera */}
          <button
            type="button"
            onClick={handleResetView}
            title="Reset Camera"
            className={`h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md border transition active:scale-90 ${
              bgTheme === 'light'
                ? 'bg-white/90 text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'bg-slate-800/85 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Compass className="h-4 w-4" />
          </button>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-950/40 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
            <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
            <p className="text-xs font-bold tracking-wide">Processing & Mounting Model...</p>
          </div>
        )}

        {/* Empty Build Plate Hint when no model is loaded */}
        {!geometry && !group && !isLoading && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center text-center pointer-events-none">
            <div
              className={`px-5 py-3 rounded-2xl border backdrop-blur-md shadow-xl max-w-xs ${
                bgTheme === 'light'
                  ? 'bg-white/95 text-slate-700 border-slate-300'
                  : 'bg-slate-900/90 text-slate-200 border-slate-700'
              }`}
            >
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto mb-2 text-lg">
                🖨️
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Ender-3 V3 SE Plate Ready
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Drop your STL, OBJ, or 3MF file to preview it live in 3D on the build plate.
              </p>
            </div>
          </div>
        )}

        {/* Everyday Reference Object Selector (Floating Above Bed) */}
        <div className="absolute left-3 bottom-3 z-10 flex items-center gap-1.5 max-w-[calc(100%-80px)] overflow-x-auto no-scrollbar py-1">
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border backdrop-blur-md shadow-sm shrink-0 ${
              bgTheme === 'light'
                ? 'bg-white/95 text-slate-700 border-slate-300'
                : 'bg-slate-900/90 text-slate-200 border-slate-700'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            <span className="hidden sm:inline">Compare Scale:</span>
            <span className="sm:hidden">Scale:</span>
          </div>

          {[
            { id: 'none', label: 'Off', icon: null },
            { id: 'coin', label: '50¢ Coin', icon: '🪙' },
            { id: 'card', label: 'MyKad', icon: '💳' },
            { id: 'phone', label: 'Phone', icon: '📱' },
            { id: 'can', label: 'Drink Can', icon: '🥤' },
            { id: 'mug', label: 'Mug', icon: '☕' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRefObject(item.id as ReferenceObjectType)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition backdrop-blur-md border active:scale-95 shrink-0 ${
                refObject === item.id
                  ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/20'
                  : bgTheme === 'light'
                  ? 'bg-white/85 text-slate-700 border-slate-300 hover:bg-white'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sleek Sub-Canvas Status Footer (Dimensions, Human Scale, Volume & Swatch) */}
      <div
        className={`px-3.5 py-2.5 border-t flex flex-wrap items-center justify-between gap-2.5 text-xs transition-colors duration-300 ${
          bgTheme === 'light'
            ? 'bg-white border-slate-200 text-slate-700'
            : bgTheme === 'dark'
            ? 'bg-slate-900/95 border-slate-800 text-slate-200'
            : 'bg-slate-800 border-slate-700 text-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <div
            className={`rounded-lg px-2.5 py-1 border flex items-center gap-1.5 shadow-2xs ${
              bgTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700'
            }`}
          >
            <span className="text-orange-500 font-bold">W:</span>
            <span className="font-mono">{modelX.toFixed(1)} mm</span>
          </div>
          <div
            className={`rounded-lg px-2.5 py-1 border flex items-center gap-1.5 shadow-2xs ${
              bgTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700'
            }`}
          >
            <span className="text-sky-500 font-bold">D:</span>
            <span className="font-mono">{modelY.toFixed(1)} mm</span>
          </div>
          <div
            className={`rounded-lg px-2.5 py-1 border flex items-center gap-1.5 shadow-2xs ${
              bgTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700'
            }`}
          >
            <span className="text-emerald-500 font-bold">H:</span>
            <span className="font-mono">{modelZ.toFixed(1)} mm</span>
          </div>

          {maxModelDimension > 0 && (
            <div
              className={`rounded-lg px-2.5 py-1 border flex items-center gap-1.5 text-[11px] font-bold shadow-2xs ${
                bgTheme === 'light'
                  ? 'bg-orange-50 text-orange-800 border-orange-200'
                  : 'bg-orange-950/70 text-orange-300 border-orange-700/60'
              }`}
            >
              <span>{humanScaleText}</span>
            </div>
          )}

          {volumeCc != null && volumeCc > 0 && (
            <div
              className={`hidden sm:flex rounded-lg px-2.5 py-1 border items-center gap-1.5 shadow-2xs ${
                bgTheme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
            >
              <span>Vol:</span>
              <span className="font-mono">{volumeCc.toFixed(1)} cm³</span>
            </div>
          )}
        </div>

        {/* Color & Material Indicator */}
        <div
          className={`rounded-lg px-2.5 py-1 border flex items-center gap-2 shadow-2xs ${
            bgTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700'
          }`}
        >
          <span
            className="h-3 w-3 rounded-full border border-slate-400 shadow-xs"
            style={{ backgroundColor: colorHex }}
          />
          <span className="text-xs font-bold uppercase tracking-wider">{materialType}</span>
        </div>
      </div>

      {/* Warning Banner if Model Exceeds Ender-3 V3 SE Volume */}
      {!fitsBed && (
        <div className="bg-red-500/20 border-t border-red-500/40 px-4 py-2.5 text-xs text-red-700 dark:text-red-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>
              This model ({modelX.toFixed(0)}×{modelY.toFixed(0)}×{modelZ.toFixed(0)} mm) exceeds the Ender-3 V3 SE envelope (220×220×250 mm).
            </span>
          </div>
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider shrink-0 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-500/40 px-2 py-0.5 rounded">
            Exceeds Limit
          </span>
        </div>
      )}
    </div>
  )
}
