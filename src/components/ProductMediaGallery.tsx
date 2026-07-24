'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Video, Box } from 'lucide-react'
import dynamic from 'next/dynamic'

const STLViewer = dynamic(() => import('@/components/STLViewerWrapper'), { ssr: false })

type Tab = 'photos' | 'video' | '3d'

function getYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    // youtu.be/ID
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`
    // youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      // youtube.com/embed/... already
      if (u.pathname.startsWith('/embed/')) return url
    }
  } catch {
    // not a URL
  }
  return null
}

import { PartAssembly } from '@/lib/types'

export default function ProductMediaGallery({
  photoUrls,
  videoUrl,
  stlUrls,
  name,
  colors,
  partColors,
  assemblyOffsets,
  meshMapping,
  textMeshIndex,
  customText,
  scale,
}: {
  photoUrls: string[]
  videoUrl: string | null
  stlUrls: string[]
  name: string
  colors?: string[]
  partColors?: string[][]
  assemblyOffsets?: PartAssembly[]
  meshMapping?: Record<number, number>
  textMeshIndex?: number | null
  customText?: string;
  scale?: number
}) {
  const hasPhotos = photoUrls.length > 0
  const hasVideo  = !!videoUrl
  const has3D     = stlUrls.length > 0
  const hasAny    = hasPhotos || hasVideo || has3D

  const defaultTab: Tab =
    hasPhotos ? 'photos' : hasVideo ? 'video' : '3d'

  const [tab, setTab]     = useState<Tab>(defaultTab)
  const [photoIdx, setPhotoIdx] = useState(0)

  if (!hasAny) return null

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    ...(hasPhotos ? [{ key: 'photos' as Tab, label: 'Photos', icon: <ImageIcon className="h-3.5 w-3.5" /> }] : []),
    ...(hasVideo  ? [{ key: 'video'  as Tab, label: 'Video',  icon: <Video      className="h-3.5 w-3.5" /> }] : []),
    ...(has3D     ? [{ key: '3d'    as Tab, label: '3D view', icon: <Box        className="h-3.5 w-3.5" /> }] : []),
  ]

  const embedUrl = videoUrl ? getYouTubeEmbed(videoUrl) : null

  return (
    <div>
      {/* Tab bar — only show if more than one media type */}
      {tabs.length > 1 && (
        <div className="flex border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
                tab === t.key
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Photos panel */}
      {tab === 'photos' && hasPhotos && (
        <div className="relative overflow-hidden bg-slate-100" style={{ aspectRatio: '16/9', maxHeight: '340px' }}>
          <img
            src={photoUrls[photoIdx]}
            alt={`${name} — photo ${photoIdx + 1}`}
            className="h-full w-full object-cover"
          />

          {/* Prev / Next */}
          {photoUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i - 1 + photoUrls.length) % photoUrls.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % photoUrls.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Dot indicators */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photoUrls.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === photoIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Video panel */}
      {tab === 'video' && hasVideo && (
        <div className="relative overflow-hidden bg-black" style={{ aspectRatio: '16/9', maxHeight: '340px' }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${name} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            /* Direct video file */
            <video
              src={videoUrl!}
              controls
              className="h-full w-full"
              style={{ maxHeight: '340px' }}
            />
          )}
        </div>
      )}

      {/* 3D viewer panel */}
      {tab === '3d' && has3D && (
        <div className="bg-slate-50 p-3" style={{ height: 340 }}>
          <STLViewer urls={stlUrls} colors={colors} partColors={partColors} assemblyOffsets={assemblyOffsets} meshMapping={meshMapping} textMeshIndex={textMeshIndex} customText={customText} scale={scale} className="h-full" />
        </div>
      )}

      {/* Thumbnail strip — only for photos with 2+ images */}
      {tab === 'photos' && photoUrls.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-slate-50">
          {photoUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setPhotoIdx(i)}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === photoIdx ? 'border-orange-500' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={url} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
