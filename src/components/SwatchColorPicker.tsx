'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Check, Eye } from 'lucide-react'

type Props = {
  onPickColor: (hex: string) => void
  onClose: () => void
}

export default function SwatchColorPicker({ onPickColor, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('upload')
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
        video: { facingMode: 'environment' }, // prefer rear camera on mobile
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

  // Handle click on live video
  function handleVideoClick(e: React.MouseEvent<HTMLVideoElement>) {
    const video = videoRef.current
    if (!video || !stream) return

    const rect = video.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * video.videoWidth
    const y = ((e.clientY - rect.top) / rect.height) * video.videoHeight

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = video.videoWidth
    tempCanvas.height = video.videoHeight
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight)
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
    setSelectedColor(hex)
  }

  // Handle video hover (live color preview under cursor)
  function handleVideoMouseMove(e: React.MouseEvent<HTMLVideoElement>) {
    const video = videoRef.current
    if (!video || !stream) return

    const rect = video.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * video.videoWidth
    const y = ((e.clientY - rect.top) / rect.height) * video.videoHeight

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = video.videoWidth
    tempCanvas.height = video.videoHeight
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight)
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
    setHoverColor(hex)
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

        // Scale canvas to fit image while maintaining aspect ratio
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

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 shadow-inner">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Physical Swatch Color Picker</span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-slate-200/60 p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
            activeTab === 'upload' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Upload Photo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
            activeTab === 'camera' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Camera className="h-3.5 w-3.5" /> Live Camera
        </button>
      </div>

      {/* Media container */}
      <div className="relative flex items-center justify-center rounded-xl bg-slate-900 overflow-hidden shadow-inner" style={{ minHeight: 240, maxHeight: 320 }}>
        {activeTab === 'camera' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onClick={handleVideoClick}
              onMouseMove={handleVideoMouseMove}
              className="w-full h-full max-h-[300px] object-contain cursor-crosshair"
            />
            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-450">
                Starting camera…
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

        {/* Floating crosshair cursor color indicator */}
        {hoverColor && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white backdrop-blur shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full border border-white/40 shrink-0" style={{ backgroundColor: hoverColor }} />
            <span className="font-mono">{hoverColor}</span>
          </div>
        )}
      </div>

      {/* Selected Color Section & Action Buttons */}
      <div className="flex items-center justify-between border-t border-slate-200/50 pt-3">
        <div className="flex items-center gap-2">
          {selectedColor ? (
            <>
              <div className="h-8 w-8 rounded-lg border border-slate-300 shadow-sm" style={{ backgroundColor: selectedColor }} />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Selected</span>
                <p className="font-mono text-sm font-semibold text-slate-800 leading-none mt-0.5">{selectedColor}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {activeTab === 'camera'
                ? 'Aim at 3D sample print and click video frame to pick color'
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => onPickColor(selectedColor)}
              className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 shadow-sm transition"
            >
              <Check className="h-3.5 w-3.5" /> Save Swatch
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
