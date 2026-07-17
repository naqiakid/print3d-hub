'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { PartAssembly, getDirectDownloadUrl, isPreviewFile, parseUrlRotation } from '@/lib/types'

type Props = {
  urls?: string[]
  fileNames?: string[]      // original file names — used to pick the right loader per URL
  colors?: string[]         // one colour per URL (whole-object fallback)
  partColors?: string[][]   // per-URL array of per-part colours (for multi-object 3MF)
  assemblyOffsets?: PartAssembly[]
  meshMapping?: Record<number, number>
  textMeshIndex?: number | null
  file?: File
  highlightIndex?: number   // which slot to spotlight (-1 or undefined = all normal)
  highlightMeshIndex?: number // which specific sub-mesh to spotlight inside a group
  customText?: string         // customer's custom text input to display on text meshes
  className?: string
  onMeshNamesLoaded?: (names: string[]) => void
}

function setMaterialColor(material: THREE.Material | THREE.Material[], color: string | THREE.Color) {
  if (!material) return
  const col = typeof color === 'string' ? new THREE.Color(color) : color
  if (Array.isArray(material)) {
    material.forEach((m) => {
      if (m && 'color' in m) {
        (m as any).color.set(col)
        m.needsUpdate = true
      }
    })
  } else {
    if (material && 'color' in material) {
      (material as any).color.set(col)
      material.needsUpdate = true
    }
  }
}

function applyHighlightToMaterial(
  material: THREE.Material | THREE.Material[],
  opacity: number,
  transparent: boolean,
  emissiveHex: number
) {
  if (!material) return
  if (Array.isArray(material)) {
    material.forEach((m) => {
      if (m) {
        m.opacity = opacity
        m.transparent = transparent
        if ('emissive' in m) {
          (m as any).emissive.set(emissiveHex)
        }
        m.needsUpdate = true
      }
    })
  } else {
    material.opacity = opacity
    material.transparent = transparent
    if ('emissive' in material) {
      (material as any).emissive.set(emissiveHex)
    }
    material.needsUpdate = true
  }
}

function applyBumpTextureToMaterial(
  material: THREE.Material | THREE.Material[],
  texture: THREE.CanvasTexture | null
) {
  if (!material) return
  if (Array.isArray(material)) {
    material.forEach((m) => {
      const mat = m as THREE.MeshPhongMaterial
      if (mat) {
        if (mat.bumpMap && mat.bumpMap !== texture) mat.bumpMap.dispose()
        mat.bumpMap = texture
        mat.bumpScale = 0.8
        mat.needsUpdate = true
      }
    })
  } else {
    const mat = material as THREE.MeshPhongMaterial
    if (mat) {
      if (mat.bumpMap && mat.bumpMap !== texture) mat.bumpMap.dispose()
      mat.bumpMap = texture
      mat.bumpScale = 0.8
      mat.needsUpdate = true
    }
  }
}


const STL_WORKER_CODE = `
self.onmessage = function(e) {
  const { buffer } = e.data;
  try {
    const view = new DataView(buffer);
    
    // Determine if it is binary or ASCII using exact mathematical byte length check
    let isBinary = false;
    if (buffer.byteLength >= 84) {
      const faceCount = view.getUint32(80, true);
      if (84 + faceCount * 50 === buffer.byteLength) {
        isBinary = true;
      }
    }

    if (isBinary) {
      const faceCount = view.getUint32(80, true);
      const positions = new Float32Array(faceCount * 9);
      const normals = new Float32Array(faceCount * 9);
      
      let offset = 84;
      let pIdx = 0;
      
      for (let i = 0; i < faceCount; i++) {
        if (offset + 50 > buffer.byteLength) break;
        
        // Normal
        const nx = view.getFloat32(offset, true);
        const ny = view.getFloat32(offset + 4, true);
        const nz = view.getFloat32(offset + 8, true);
        offset += 12;
        
        // Vertices
        const v1x = view.getFloat32(offset, true);
        const v1y = view.getFloat32(offset + 4, true);
        const v1z = view.getFloat32(offset + 8, true);
        offset += 12;
        
        const v2x = view.getFloat32(offset, true);
        const v2y = view.getFloat32(offset + 4, true);
        const v2z = view.getFloat32(offset + 8, true);
        offset += 12;
        
        const v3x = view.getFloat32(offset, true);
        const v3y = view.getFloat32(offset + 4, true);
        const v3z = view.getFloat32(offset + 8, true);
        offset += 12;
        
        offset += 2; // attribute byte count
        
        positions[pIdx] = v1x; positions[pIdx + 1] = v1y; positions[pIdx + 2] = v1z;
        positions[pIdx + 3] = v2x; positions[pIdx + 4] = v2y; positions[pIdx + 5] = v2z;
        positions[pIdx + 6] = v3x; positions[pIdx + 7] = v3y; positions[pIdx + 8] = v3z;
        
        normals[pIdx] = nx; normals[pIdx + 1] = ny; normals[pIdx + 2] = nz;
        normals[pIdx + 3] = nx; normals[pIdx + 4] = ny; normals[pIdx + 5] = nz;
        normals[pIdx + 6] = nx; normals[pIdx + 7] = ny; normals[pIdx + 8] = nz;
        
        pIdx += 9;
      }
      
      self.postMessage({ success: true, positions, normals }, [positions.buffer, normals.buffer]);
    } else {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      
      const lines = text.split('\n');
      const positionsList = [];
      const normalsList = [];
      
      let currentNormal = [0, 0, 0];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (line.startsWith('facet normal')) {
          const parts = line.split(/[ \t]+/);
          const nx = parseFloat(parts[2]) || 0;
          const ny = parseFloat(parts[3]) || 0;
          const nz = parseFloat(parts[4]) || 0;
          currentNormal = [nx, ny, nz];
        } else if (line.startsWith('vertex')) {
          const parts = line.split(/[ \t]+/);
          const vx = parseFloat(parts[1]) || 0;
          const vy = parseFloat(parts[2]) || 0;
          const vz = parseFloat(parts[3]) || 0;
          positionsList.push(vx, vy, vz);
          normalsList.push(currentNormal[0], currentNormal[1], currentNormal[2]);
        }
      }
      
      const positions = new Float32Array(positionsList);
      const normals = new Float32Array(normalsList);
      self.postMessage({ success: true, positions, normals }, [positions.buffer, normals.buffer]);
    }
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
`

function parseStlWithWorker(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([STL_WORKER_CODE], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      const worker = new Worker(workerUrl)

      worker.onmessage = (e) => {
        const { success, positions, normals, error } = e.data
        worker.terminate()
        URL.revokeObjectURL(workerUrl)

        if (success) {
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
          resolve(geometry)
        } else {
          reject(new Error(error || 'Worker parsing failed'))
        }
      }

      worker.onerror = (err) => {
        worker.terminate()
        URL.revokeObjectURL(workerUrl)
        reject(err)
      }

      worker.postMessage({ buffer })
    } catch (err) {
      reject(err)
    }
  })
}

export default function STLViewer({
  urls: urlsProp,
  fileNames: fileNamesProp,
  colors: colorsProp,
  partColors: partColorsProp,
  assemblyOffsets,
  meshMapping,
  textMeshIndex,
  file,
  highlightIndex,
  highlightMeshIndex,
  customText,
  className,
  onMeshNamesLoaded,
}: Props) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const objectsRef  = useRef<THREE.Object3D[]>([])
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef    = useRef<THREE.Scene | null>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [dims, setDims]       = useState<{ x: number; y: number; z: number } | null>(null)

  const previewUrls = (urlsProp ?? []).filter(url => isPreviewFile(url))
  const printableUrls = (urlsProp ?? []).filter(url => !isPreviewFile(url))
  const hasPreview = previewUrls.length > 0

  const [subTab, setSubTab] = useState<'assembled' | 'parts'>(hasPreview ? 'assembled' : 'parts')

  useEffect(() => {
    setSubTab(hasPreview ? 'assembled' : 'parts')
  }, [urlsProp?.join(',')])

  const isAssembled = subTab === 'assembled'

  // Refs so the scene-setup effect can read current colours without them being deps
  const colorsRef     = useRef<string[]>([])
  const partColorsRef = useRef<string[][]>([])
  colorsRef.current     = colorsProp     ?? []
  partColorsRef.current = partColorsProp ?? []

  const customTextRef = useRef<string>('')
  customTextRef.current = customText ?? ''

  const textMeshIndexRef = useRef<number | null | undefined>(null)
  textMeshIndexRef.current = textMeshIndex

  const baseUrlsKey = (urlsProp ?? []).map(url => url.split('#')[0]).join(',')

  // ── Scene setup (re-runs only when base URLs or file names change) ────
  useEffect(() => {
    const mount = mountRef.current
    objectsRef.current = []
    setDims(null)

    let blobUrl: string | null = null
    const activeUrls = subTab === 'assembled' ? previewUrls : printableUrls
    const urls      = file ? ((blobUrl = URL.createObjectURL(file)), [blobUrl]) : activeUrls
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
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    mount.style.position = 'relative'
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

    function createBumpTexture(text: string, engraved = false): THREE.CanvasTexture {
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 256
      const ctx = canvas.getContext('2d')!

      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (text) {
        ctx.fillStyle = engraved ? '#000000' : '#ffffff'
        ctx.font = 'bold 120px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 4
        ctx.fillText(text, canvas.width / 2, canvas.height / 2)
      }

      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.needsUpdate = true
      return texture
    }

    function applyTextToMesh(mesh: THREE.Mesh, text: string) {
      const material = mesh.material
      if (!material) return
      if (Array.isArray(material)) {
        material.forEach((m) => {
          const mat = m as THREE.MeshPhongMaterial
          if (mat) {
            if (mat.bumpMap) mat.bumpMap.dispose()
            if (text) {
              mat.bumpMap = createBumpTexture(text)
              mat.bumpScale = 0.8
            } else {
              mat.bumpMap = null
            }
            mat.needsUpdate = true
          }
        })
      } else {
        const mat = material as THREE.MeshPhongMaterial
        if (mat) {
          if (mat.bumpMap) mat.bumpMap.dispose()
          if (text) {
            mat.bumpMap = createBumpTexture(text)
            mat.bumpScale = 0.8
          } else {
            mat.bumpMap = null
          }
          mat.needsUpdate = true
        }
      }
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

      if (onMeshNamesLoaded && isAssembled) {
        const names: string[] = []
        objectsRef.current.forEach((obj) => {
          if (obj instanceof THREE.Mesh) {
            names.push(obj.name || `Mesh ${names.length + 1}`)
          } else {
            obj.traverse((c) => {
              if (c instanceof THREE.Mesh) {
                names.push(c.name || `Mesh ${names.length + 1}`)
              }
            })
          }
        })
        onMeshNamesLoaded(names)
      }

      setLoading(false)
    }

    function onError() {
      if (!hasError) {
        hasError = true
        setError('Could not load 3D model')
        setLoading(false)
      }
    }

    (urls ?? []).forEach((urlWithHash, i) => {
      const url = urlWithHash.split('#')[0]
      const name = fileNames[i] ?? url
      let ext = 'stl'
      const cleanName = name.toLowerCase()
      if (cleanName.includes('.3mf')) {
        ext = '3mf'
      } else if (cleanName.includes('.obj')) {
        ext = 'obj'
      } else if (cleanName.includes('.stl')) {
        ext = 'stl'
      } else if (isPreviewFile(urlWithHash)) {
        ext = '3mf'
      } else {
        ext = 'stl'
      }

      // ── STL: loader returns BufferGeometry ────────────────────────
      function onGeometry(geometry: THREE.BufferGeometry) {
        geometry.computeVertexNormals()

        // Generate planar UV coordinates if missing (STL files have no UVs by default)
        if (!geometry.attributes.uv) {
          geometry.computeBoundingBox()
          const box = geometry.boundingBox!
          const size = new THREE.Vector3()
          box.getSize(size)

          const posAttr = geometry.attributes.position
          const count = posAttr.count
          const uvs = new Float32Array(count * 2)

          for (let idx = 0; idx < count; idx++) {
            const x = posAttr.getX(idx)
            const y = posAttr.getY(idx)
            const u = size.x > 0 ? (x - box.min.x) / size.x : 0.5
            const v = size.y > 0 ? (y - box.min.y) / size.y : 0.5
            uvs[idx * 2] = u
            uvs[idx * 2 + 1] = v
          }
          geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        }

        const mesh = new THREE.Mesh(geometry, makeMat(colorsRef.current[i] || '#cccccc'))
        mesh.userData.index = i

        geometry.computeBoundingBox()
        const centre = new THREE.Vector3()
        geometry.boundingBox!.getCenter(centre)
        mesh.userData.originalCentre = centre.clone()
        
        // Center the part first if in exploded view OR if custom assembly offsets exist
        const shouldCenter = !isAssembled || !!(assemblyOffsets && assemblyOffsets[i])
        if (shouldCenter) {
          geometry.translate(-centre.x, -centre.y, -centre.z)
        }

        // Apply URL-specific rotation first
        const urlRot = parseUrlRotation(urlWithHash)
        mesh.rotation.set(
          THREE.MathUtils.degToRad(urlRot.rx),
          THREE.MathUtils.degToRad(urlRot.ry),
          THREE.MathUtils.degToRad(urlRot.rz)
        )

        // Apply custom position and rotation offsets
        if (isAssembled && assemblyOffsets && assemblyOffsets[i]) {
          const offset = assemblyOffsets[i]
          mesh.position.set(offset.x, offset.y, offset.z)
          mesh.rotation.x += THREE.MathUtils.degToRad(offset.rx ?? 0)
          mesh.rotation.y += THREE.MathUtils.degToRad(offset.ry ?? 0)
          mesh.rotation.z += THREE.MathUtils.degToRad(offset.rz ?? 0)
        }

        mesh.name = name
        const isTextMesh =
          textMeshIndexRef.current !== undefined && textMeshIndexRef.current !== null
            ? i === textMeshIndexRef.current
            : name.toLowerCase().includes('text') || printableUrls.length === 1
        if (isTextMesh && customTextRef.current) {
          applyTextToMesh(mesh, customTextRef.current)
        }

        group.add(mesh)
        objectsRef.current[i] = mesh
        loaded++
        onAllLoaded()
      }

      // ── 3MF / OBJ: loader returns Group ──────────────────────────
      function onGroupLoaded(obj: THREE.Group) {
        const meshes: THREE.Mesh[] = []
        obj.traverse((c) => { if (c instanceof THREE.Mesh) meshes.push(c) })

        const parts = partColorsRef.current[i]
        if (parts && parts.length > 0) {
          meshes.forEach((mesh, j) => {
            mesh.material = makeMat(parts[j] || colorsRef.current[i] || '#cccccc')
          })
        } else {
          // If this is a multi-part container (e.g. 3MF assembly) but has no custom part colors assigned directly,
          // make it inherit the colors of the other files loaded in the viewer!
          // We try to match each mesh by the owner's manual mapping first, then by name, and finally fallback to index.
          meshes.forEach((mesh, j) => {
            let matchedColor: string | null = null

            // 1. Manual mapping
            if (meshMapping && meshMapping[j] !== undefined) {
              const mappedStlIdx = meshMapping[j]
              const url = printableUrls[mappedStlIdx]
              if (url) {
                const fullIdx = (urlsProp ?? []).indexOf(url)
                matchedColor = colorsRef.current[fullIdx]
              }
            }

            // 2. Name-based matching
            if (!matchedColor) {
              const meshName = (mesh.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
              for (let idx = 0; idx < printableUrls.length; idx++) {
                const url = printableUrls[idx]
                const filename = url.split('/').pop()?.toLowerCase() || ''
                const cleanFilename = filename.replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]/g, '')
                
                if (meshName && cleanFilename && (cleanFilename.includes(meshName) || meshName.includes(cleanFilename))) {
                  const fullIdx = (urlsProp ?? []).indexOf(url)
                  matchedColor = colorsRef.current[fullIdx]
                  break
                }
              }
            }

            const inheritedColor = matchedColor || colorsRef.current[j] || colorsRef.current[i] || '#cccccc'
            mesh.material = makeMat(inheritedColor)
          })
        }

        meshes.forEach((mesh, j) => {
          const isTextMesh =
            textMeshIndexRef.current !== undefined && textMeshIndexRef.current !== null
              ? j === textMeshIndexRef.current
              : (mesh.name || '').toLowerCase().includes('text') || name.toLowerCase().includes('text') || meshes.length === 1
          if (isTextMesh && customTextRef.current) {
            applyTextToMesh(mesh, customTextRef.current)
          }
        })

        const box    = new THREE.Box3().setFromObject(obj)
        const centre = box.getCenter(new THREE.Vector3())
        obj.userData.originalCentre = centre.clone()
        
        // Center the part first if in exploded view OR if custom assembly offsets exist
        const shouldCenter = !isAssembled || !!(assemblyOffsets && assemblyOffsets[i])
        if (shouldCenter) {
          obj.position.sub(centre)
        }

        // Apply URL-specific rotation first
        const urlRot = parseUrlRotation(urlWithHash)
        obj.rotation.set(
          THREE.MathUtils.degToRad(urlRot.rx),
          THREE.MathUtils.degToRad(urlRot.ry),
          THREE.MathUtils.degToRad(urlRot.rz)
        )

        // Apply custom position and rotation offsets
        if (isAssembled && assemblyOffsets && assemblyOffsets[i]) {
          const offset = assemblyOffsets[i]
          obj.position.set(offset.x, offset.y, offset.z)
          obj.rotation.x += THREE.MathUtils.degToRad(offset.rx ?? 0)
          obj.rotation.y += THREE.MathUtils.degToRad(offset.ry ?? 0)
          obj.rotation.z += THREE.MathUtils.degToRad(offset.rz ?? 0)
        }

        obj.userData.index = i
        group.add(obj)
        objectsRef.current[i] = obj
        loaded++
        onAllLoaded()
      }

      const downloadUrl = getDirectDownloadUrl(url)
      const isGoogleOrDropbox = url.includes('drive.google.com') || url.includes('dropbox.com') || url.startsWith('/')

      if (ext === 'stl') {
        fetch(downloadUrl)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP error ${res.status}`)
            return res.arrayBuffer()
          })
          .then((buffer) => {
            return parseStlWithWorker(buffer)
              .then(onGeometry)
              .catch((err) => {
                console.warn("Web Worker parsing failed, falling back to main thread:", err)
                const loader = new STLLoader()
                const geometry = loader.parse(buffer)
                onGeometry(geometry)
              })
          })
          .catch((err) => {
            console.error("Loader error:", err)
            onError()
          })
      } else {
        if (isGoogleOrDropbox) {
          fetch(downloadUrl)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP error ${res.status}`)
              return res.arrayBuffer()
            })
            .then((buffer) => {
              const view = new DataView(buffer)
              // Check ZIP / 3MF magic bytes 'PK\x03\x04' (0x504B0304)
              const isZip = buffer.byteLength >= 4 && view.getUint32(0, false) === 0x504B0304

              if (isZip) {
                const loader = new ThreeMFLoader()
                const obj = loader.parse(buffer)
                onGroupLoaded(obj)
              } else {
                try {
                  const loader = new OBJLoader()
                  const decoder = new TextDecoder('utf-8')
                  const text = decoder.decode(buffer)
                  const obj = loader.parse(text)
                  onGroupLoaded(obj)
                } catch (objErr) {
                  throw new Error('Unsupported 3D file format signature.')
                }
              }
            })
            .catch((err) => {
              console.error("Loader error:", err)
              onError()
            })
        } else {
          if (ext === '3mf') {
            new ThreeMFLoader().load(downloadUrl, onGroupLoaded, undefined, onError)
          } else if (ext === 'obj') {
            new OBJLoader().load(downloadUrl, onGroupLoaded, undefined, onError)
          } else {
            new STLLoader().load(downloadUrl, onGeometry, undefined, onError)
          }
        }
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

    let lastW = 0
    let lastH = 0
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w === 0 || h === 0 || (w === lastW && h === lastH)) return
      lastW = w
      lastH = h

      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
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
  }, [file, baseUrlsKey, (fileNamesProp ?? []).join(','), subTab])

  // ── Live position and rotation updates (no scene rebuild) ────────
  useEffect(() => {
    const objects = objectsRef.current
    if (!objects || objects.length === 0) return

    objects.forEach((obj, i) => {
      if (!obj) return
      const url = (urlsProp ?? [])[i]
      if (!url) return

      const urlRot = parseUrlRotation(url)
      let rx = THREE.MathUtils.degToRad(urlRot.rx)
      let ry = THREE.MathUtils.degToRad(urlRot.ry)
      let rz = THREE.MathUtils.degToRad(urlRot.rz)

      let px = 0
      let py = 0
      let pz = 0

      if (isAssembled && assemblyOffsets && assemblyOffsets[i]) {
        const offset = assemblyOffsets[i]
        px = offset.x
        py = offset.y
        pz = offset.z
        rx += THREE.MathUtils.degToRad(offset.rx ?? 0)
        ry += THREE.MathUtils.degToRad(offset.ry ?? 0)
        rz += THREE.MathUtils.degToRad(offset.rz ?? 0)
      }

      obj.rotation.set(rx, ry, rz)

      const shouldCenter = !isAssembled || !!(assemblyOffsets && assemblyOffsets[i])
      if (obj instanceof THREE.Group) {
        const originalCentre = obj.userData.originalCentre as THREE.Vector3
        if (shouldCenter && originalCentre) {
          obj.position.set(px - originalCentre.x, py - originalCentre.y, pz - originalCentre.z)
        } else {
          obj.position.set(px, py, pz)
        }
      } else {
        if (shouldCenter) {
          obj.position.set(px, py, pz)
        } else {
          obj.position.set(0, 0, 0)
        }
      }
    })

    const r = rendererRef.current
    const s = sceneRef.current
    const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  }, [
    (urlsProp ?? []).join(','),
    JSON.stringify(assemblyOffsets),
    isAssembled,
  ])

  // ── Live colour updates (no scene rebuild) ───────────────────────
  useEffect(() => {
    const objects = objectsRef.current.filter(Boolean)
    if (objects.length === 0) return

    objects.forEach((obj, i) => {
      const parts    = (partColorsProp ?? [])[i]
      const objColor = (colorsProp ?? [])[i] || '#cccccc'

      if (obj instanceof THREE.Group) {
        const meshes: THREE.Mesh[] = []
        obj.traverse((c) => { if (c instanceof THREE.Mesh) meshes.push(c) })

        if (parts && parts.length > 0) {
          meshes.forEach((mesh, j) => {
            const color = parts[j] || objColor
            setMaterialColor(mesh.material, color)
          })
        } else {
          // If this is a group (e.g. 3MF assembly) but has no custom part colors assigned directly,
          // make it inherit the colors of the other files loaded in the viewer!
          // We try to match each mesh by the owner's manual mapping first, then by name, and finally fallback to index.
          meshes.forEach((mesh, j) => {
            let matchedColor: string | null = null

            // 1. Manual mapping
            if (meshMapping && meshMapping[j] !== undefined) {
              const mappedStlIdx = meshMapping[j]
              const url = printableUrls[mappedStlIdx]
              if (url) {
                const fullIdx = (urlsProp ?? []).indexOf(url)
                if (fullIdx !== -1 && colorsProp && colorsProp[fullIdx]) {
                  matchedColor = colorsProp[fullIdx]
                }
              }
            }

            // 2. Name-based matching
            if (!matchedColor) {
              const meshName = (mesh.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
              for (let idx = 0; idx < printableUrls.length; idx++) {
                const url = printableUrls[idx]
                const filename = url.split('/').pop()?.toLowerCase() || ''
                const cleanFilename = filename.replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]/g, '')
                
                if (meshName && cleanFilename && (cleanFilename.includes(meshName) || meshName.includes(cleanFilename))) {
                  const fullIdx = (urlsProp ?? []).indexOf(url)
                  if (fullIdx !== -1 && colorsProp && colorsProp[fullIdx]) {
                    matchedColor = colorsProp[fullIdx]
                    break
                  }
                }
              }
            }

            const color = matchedColor || (colorsProp ?? [])[j] || objColor
            setMaterialColor(mesh.material, color)
          })
        }
      } else {
        obj.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            setMaterialColor(c.material, objColor)
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
    JSON.stringify(meshMapping),
  ])

  // ── Highlight effect ─────────────────────────────────────────────
  useEffect(() => {
    const objects = objectsRef.current.filter(Boolean)
    if (objects.length === 0) return

    const activeFile = highlightIndex !== undefined && highlightIndex >= 0
    const activeMesh = highlightMeshIndex !== undefined && highlightMeshIndex >= 0

    objects.forEach((obj, i) => {
      if (obj instanceof THREE.Group) {
        const meshes: THREE.Mesh[] = []
        obj.traverse((c) => { if (c instanceof THREE.Mesh) meshes.push(c) })
        
        meshes.forEach((mesh, j) => {
          if (!activeFile && !activeMesh) {
            applyHighlightToMaterial(mesh.material, 1, false, 0x000000)
          } else if (activeMesh && j === highlightMeshIndex) {
            applyHighlightToMaterial(mesh.material, 1, false, 0xff4500)
          } else if (activeFile && i === highlightIndex) {
            applyHighlightToMaterial(mesh.material, 1, false, 0x555555)
          } else {
            applyHighlightToMaterial(mesh.material, 0.15, true, 0x000000)
          }
        })
      } else if (obj instanceof THREE.Mesh) {
        if (!activeFile && !activeMesh) {
          applyHighlightToMaterial(obj.material, 1, false, 0x000000)
        } else if (activeMesh && meshMapping && meshMapping[highlightMeshIndex] === i) {
          applyHighlightToMaterial(obj.material, 1, false, 0xff4500) // Mapped part glows red-orange!
        } else if (activeFile && i === highlightIndex) {
          applyHighlightToMaterial(obj.material, 1, false, 0x555555)
        } else {
          applyHighlightToMaterial(obj.material, 0.15, true, 0x000000)
        }
      }
    })

    const r = rendererRef.current
    const s = sceneRef.current
    const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  }, [highlightIndex, highlightMeshIndex, meshMapping])

  // ── Live custom text updates (no scene rebuild) ──────────────────
  useEffect(() => {
    const objects = objectsRef.current.filter(Boolean)
    if (objects.length === 0) return

    objects.forEach((obj, i) => {
      const name = (fileNamesProp ?? [])[i] ?? (urlsProp ?? [])[i] ?? ''
      
      if (obj instanceof THREE.Group) {
        const meshes: THREE.Mesh[] = []
        obj.traverse((c) => { if (c instanceof THREE.Mesh) meshes.push(c) })

        meshes.forEach((c, j) => {
          const isTextMesh =
            textMeshIndex !== undefined && textMeshIndex !== null
              ? j === textMeshIndex
              : (c.name || '').toLowerCase().includes('text') || name.toLowerCase().includes('text') || meshes.length === 1

          if (isTextMesh) {
            if (customText) {
              const canvas = document.createElement('canvas')
              canvas.width = 1024
              canvas.height = 256
              const ctx = canvas.getContext('2d')!
              ctx.fillStyle = '#808080'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              ctx.fillStyle = '#ffffff'
              ctx.font = 'bold 120px sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
              ctx.shadowBlur = 4
              ctx.fillText(customText, canvas.width / 2, canvas.height / 2)
              
              const texture = new THREE.CanvasTexture(canvas)
              texture.wrapS = THREE.RepeatWrapping
              texture.wrapT = THREE.RepeatWrapping
              texture.needsUpdate = true
              applyBumpTextureToMaterial(c.material, texture)
            } else {
              applyBumpTextureToMaterial(c.material, null)
            }
          } else {
            applyBumpTextureToMaterial(c.material, null)
          }
        })
      } else if (obj instanceof THREE.Mesh) {
        const isTextMesh =
          textMeshIndex !== undefined && textMeshIndex !== null
            ? i === textMeshIndex
            : (obj.name || '').toLowerCase().includes('text') || name.toLowerCase().includes('text') || printableUrls.length === 1
        
        if (isTextMesh) {
          if (customText) {
            const canvas = document.createElement('canvas')
            canvas.width = 1024
            canvas.height = 256
            const ctx = canvas.getContext('2d')!
            ctx.fillStyle = '#808080'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 120px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
            ctx.shadowBlur = 4
            ctx.fillText(customText, canvas.width / 2, canvas.height / 2)
            
            const texture = new THREE.CanvasTexture(canvas)
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            texture.needsUpdate = true
            applyBumpTextureToMaterial(obj.material, texture)
          } else {
            applyBumpTextureToMaterial(obj.material, null)
          }
        } else {
          applyBumpTextureToMaterial(obj.material, null)
        }
      }
    })

    const r = rendererRef.current
    const s = sceneRef.current
    const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  }, [customText, textMeshIndex, (urlsProp ?? []).join(','), (fileNamesProp ?? []).join(',')])

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
      {hasPreview && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-xl bg-slate-900/80 p-0.5 border border-white/10 backdrop-blur-sm shadow-md select-none">
          <button
            type="button"
            onClick={() => setSubTab('assembled')}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition active:scale-95 ${
              subTab === 'assembled'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🧩 Assembled
          </button>
          <button
            type="button"
            onClick={() => setSubTab('parts')}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition active:scale-95 ${
              subTab === 'parts'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📦 Parts
          </button>
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
