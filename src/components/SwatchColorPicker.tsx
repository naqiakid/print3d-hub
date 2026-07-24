'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Check, Eye, Lock, RefreshCw } from 'lucide-react'

type Props = {
  onPickColor: (hex: string, suggestedName: string) => void
  onClose: () => void
}

const COLOR_CATALOG = [
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#F5F0E8', name: 'Natural' },
  { hex: '#D4D4D4', name: 'Light Gray' },
  { hex: '#737373', name: 'Gray' },
  { hex: '#1A1A1A', name: 'Black' },
  { hex: '#DC2626', name: 'Red' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#FACC15', name: 'Yellow' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#38BDF8', name: 'Sky Blue' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#F43F5E', name: 'Rose' },
  { hex: '#92400E', name: 'Brown' },
  { hex: '#D4A574', name: 'Beige' },
  { hex: '#C0C0C0', name: 'Silver' },
  { hex: '#FFD700', name: 'Gold' },
  { hex: '#1E3A8A', name: 'Navy Blue' },
  { hex: '#E6E6FA', name: 'Lavender' },
]

export function getClosestColorName(hex: string): string {
  const r1 = parseInt(hex.slice(1, 3), 16)
  const g1 = parseInt(hex.slice(3, 5), 16)
  const b1 = parseInt(hex.slice(5, 7), 16)

  let closestName = 'Custom Color'
  let minDiff = Infinity

  for (const c of COLOR_CATALOG) {
    const r2 = parseInt(c.hex.slice(1, 3), 16)
    const g2 = parseInt(c.hex.slice(3, 5), 16)
    const b2 = parseInt(c.hex.slice(5, 7), 16)

    const diff = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
    if (diff < minDiff) {
      minDiff = diff
      closestName = c.name
    }
  }
  return closestName
}

export default function SwatchColorPicker({ onPickColor, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [hoverColor, setHoverColor] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // Upload Photo Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stream])

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  async function startCamera() {
    stopCamera()
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error('Webcam access error:', err)
      alert('Could not access camera. Please make sure permissions are granted or upload a photo instead.')
      setActiveTab('upload')
    }
  }

  // Handle tab switching
  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
  }, [activeTab])

  // Convert RGB array to hex string
  function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => {
      const hex = c.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
  }

  // Live center-reticle scanner animation loop
  useEffect(() => {
    let animId: number
    const checkCenterColor = () => {
      const video = videoRef.current
      if (video && stream && activeTab === 'camera' && !selectedColor && video.readyState === video.HAVE_ENOUGH_DATA) {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = 10
        tempCanvas.height = 10
        const ctx = tempCanvas.getContext('2d')
        if (ctx) {
          // Sample a tiny pixel at the exact center of the video feed
          const sx = video.videoWidth / 2
          const sy = video.videoHeight / 2
          ctx.drawImage(video, sx, sy, 1, 1, 0, 0, 1, 1)
          const pixel = ctx.getImageData(0, 0, 1, 1).data
          const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
          setHoverColor(hex)
        }
      }
      animId = requestAnimationFrame(checkCenterColor)
    }

    if (activeTab === 'camera' && stream) {
      animId = requestAnimationFrame(checkCenterColor)
    }

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [activeTab, stream, selectedColor])

  // Lock center color in camera mode
  function handleLockCenterColor() {
    if (hoverColor) {
      setSelectedColor(hoverColor)
    }
  }

  // Handle photo upload
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const maxWidth = 480
        const scale = Math.min(maxWidth / img.width, 1)
        canvas.width = img.width * scale
        canvas.height = img.height * scale

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setImageLoaded(true)
        setSelectedColor(null)
        setHoverColor(null)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Handle click on canvas photo
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || !imageLoaded) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
    setSelectedColor(hex)
  }

  // Handle hover on canvas photo
  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || !imageLoaded) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
    setHoverColor(hex)
  }

  const suggestedName = selectedColor ? getClosestColorName(selectedColor) : ''

  return (
    <div className="rounded-xl border border-slate-205 bg-slate-50 p-4 space-y-4 shadow-inner">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Physical Swatch Scanner</span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-650 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-slate-200/60 p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
            activeTab === 'camera' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Camera className="h-3.5 w-3.5" /> Aim Scanner
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
            activeTab === 'upload' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Upload Photo
        </button>
      </div>

      {/* Media container */}
      <div className="relative flex items-center justify-center rounded-xl bg-slate-900 overflow-hidden shadow-inner" style={{ minHeight: 280, maxHeight: 320 }}>
        {activeTab === 'camera' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full max-h-[300px] object-contain"
            />
            
            {stream && !selectedColor && (
              <>
                {/* QR-style dark mask overlay with center circle cutout */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Central target aim ring */}
                  <div 
                    className="h-16 w-16 rounded-full border-4 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] transition-colors duration-200"
                    style={{ borderColor: hoverColor || '#ffffff' }}
                  />
                  <div className="absolute h-1.5 w-1.5 rounded-full bg-white shadow" />
                </div>
                
                {/* Aim helper text */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-[10px] text-white backdrop-blur font-medium">
                  Center physical swatch card in ring
                </div>

                {/* Big scan button */}
                <button
                  type="button"
                  onClick={handleLockCenterColor}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition active:scale-95"
                >
                  <Lock className="h-3.5 w-3.5" /> Lock Color
                </button>
              </>
            )}

            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                Connecting camera stream…
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6">
            {!imageLoaded ? (
              <label className="flex flex-col items-center gap-2 cursor-pointer hover:text-orange-500 transition text-slate-400">
                <Upload className="h-8 w-8" />
                <span className="text-xs font-semibold">Click to upload photo of swatch print</span>
                <span className="text-[10px] text-slate-500">Supports JPG, PNG, WebP</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            ) : (
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  className="max-w-full max-h-[280px] object-contain cursor-crosshair border border-slate-700 rounded-lg shadow-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageLoaded(false)
                    setSelectedColor(null)
                    setHoverColor(null)
                  }}
                  className="absolute -top-2 -right-2 rounded-full bg-slate-800 text-slate-200 border border-slate-700 p-1 hover:bg-slate-700 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live center scanning dynamic indicator (when not locked) */}
        {hoverColor && !selectedColor && activeTab === 'camera' && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white backdrop-blur shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full border border-white/40 shrink-0 animate-pulse" style={{ backgroundColor: hoverColor }} />
            <span className="font-mono">{hoverColor}</span>
          </div>
        )}
      </div>

      {/* Selected Color Section & Action Buttons */}
      <div className="flex items-center justify-between border-t border-slate-200/50 pt-3">
        <div className="flex items-center gap-3">
          {selectedColor ? (
            <>
              <div className="h-9 w-9 rounded-lg border border-slate-300 shadow-sm" style={{ backgroundColor: selectedColor }} />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Scanned Swatch</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="font-mono text-sm font-bold text-slate-800 leading-none">{selectedColor}</p>
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5">
                    {suggestedName}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {activeTab === 'camera'
                ? 'Align swatch card in target and click "Lock Color"'
                : imageLoaded
                ? 'Click anywhere on photo to extract exact color hex'
                : 'Upload a sample photo to begin'}
            </p>
          )}
        </div>

        {selectedColor && (
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedColor(null)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              title="Rescan"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPickColor(selectedColor, suggestedName)}
              className="flex items-center gap-1 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-600 shadow-sm transition"
            >
              <Check className="h-3.5 w-3.5" /> Save Swatch
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
