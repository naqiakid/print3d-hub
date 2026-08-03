'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { PrintRequest } from '@/lib/types'
import { MATERIAL_LABELS, QUALITY_LABELS, parseAssemblyMetadata, parseMeshMapping, parseTextMeshIndex, isPreviewFile, cleanDescription, stripHtml, getColorHexByName } from '@/lib/types'

const STLViewer = dynamic(() => import('@/components/STLViewerWrapper'), { ssr: false })

interface TrackingSummaryProps {
  request: PrintRequest
  pickupAddress: string | null
  catalogItemStlUrls?: string[] | null
}

export default function TrackingSummary({ request, pickupAddress, catalogItemStlUrls }: TrackingSummaryProps) {
  const [activeIdx, setActiveIdx] = useState(0)

  const sourceUrls = catalogItemStlUrls && catalogItemStlUrls.length > 0
    ? catalogItemStlUrls
    : (request.stl_urls ?? [])

  const printableParts = sourceUrls.filter((url) => !isPreviewFile(url))

  // Parser helper
  const parsed = (() => {
    const notesStr = request.notes ?? ''
    if (!notesStr.includes('Item Customisations (Multiple Copies):')) {
      return null
    }

    const copies: { name?: string; color?: string; partColors?: { partName: string; color: string }[] }[] = []
    let customerNotes = ''

    // Split by "Copy #"
    const parts = notesStr.split(/Copy #\d+:/g)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i] || ''
      let nameVal: string | undefined
      let colorVal: string | undefined
      const partColors: { partName: string; color: string }[] = []

      const lines = part.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('- Color:')) {
          colorVal = trimmed.replace('- Color:', '').trim()
        } else if (trimmed.includes('to engrave:') || trimmed.includes('to emboss:') || trimmed.includes('text:')) {
          const match = trimmed.match(/"([^"]+)"/)
          if (match) {
            nameVal = match[1]
          } else {
            const parts = trimmed.split(':')
            nameVal = parts[1]?.trim()
          }
        } else if (trimmed.startsWith('-') && trimmed.includes(':')) {
          const cleanLine = trimmed.slice(1).trim()
          const colonIdx = cleanLine.indexOf(':')
          if (colonIdx !== -1) {
            const partName = cleanLine.slice(0, colonIdx).trim()
            const color = cleanLine.slice(colonIdx + 1).trim()
            partColors.push({ partName, color })
          }
        }
      }
      copies.push({ name: nameVal, color: colorVal, partColors })
    }

    const customerNotesMatch = notesStr.match(/Customer Notes:\s*([\s\S]*)$/i)
    if (customerNotesMatch) {
      customerNotes = customerNotesMatch[1].trim()
    } else {
      const clean = notesStr
        .replace(/Item Customisations [\s\S]*?(Copy #\d+:[\s\S]*?)+/i, '')
        .replace(/Customer Notes:[\s\S]*/i, '')
        .trim()
      if (clean) customerNotes = clean
    }

    return { copies, customerNotes }
  })()

  const cleanNotes = parsed ? parsed.customerNotes : (request.notes ?? '')

  // Assembly metadata parsing
  const assemblyOffsets = parseAssemblyMetadata(request.description)
  const meshMapping = parseMeshMapping(request.description)
  const textMeshIndex = parseTextMeshIndex(request.description)

  // Compute active colors for 3D preview
  const activeColors = sourceUrls.map((url, idx) => {
    const isPreview = isPreviewFile(url)
    if (isPreview) return '#ffffff' // preview file fallback color

    const printableIdx = printableParts.indexOf(url)
    if (printableIdx === -1) return '#ffffff'

    if (parsed && parsed.copies[activeIdx]) {
      const copy = parsed.copies[activeIdx]
      if (copy.partColors && copy.partColors[printableIdx]) {
        return getColorHexByName(copy.partColors[printableIdx].color)
      }
      if (copy.color) {
        return getColorHexByName(copy.color)
      }
    }
    
    // Fallback to request base colors
    const baseColors = request.color ? request.color.split('|') : []
    const baseHexes = request.color_hex ? request.color_hex.split('|') : []
    
    if (printableParts.length > 1) {
      return baseHexes[printableIdx] || getColorHexByName(baseColors[printableIdx] || 'Any')
    }
    return request.color_hex || getColorHexByName(request.color || 'Any')
  })

  // Compute custom text for 3D preview
  const activeText = parsed && parsed.copies[activeIdx]
    ? (parsed.copies[activeIdx].name ?? '')
    : (() => {
        const surfaceTextMatch = (request.notes ?? '').match(/Surface text: "([^"]+)"/) || (request.notes ?? '').match(/text: "([^"]+)"/)
        return surfaceTextMatch?.[1] ?? ''
      })()

  const viewerUrls = catalogItemStlUrls && catalogItemStlUrls.length > 0
    ? catalogItemStlUrls
    : (request.stl_urls?.length > 0 ? request.stl_urls : [request.stl_url!])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Order summary</h2>
          <p className="text-sm text-slate-650 mt-1">{stripHtml(request.description?.replace(/Catalog order: /, ''))}</p>
        </div>
      </div>

      {/* 3D Preview Panel */}
      {viewerUrls.length > 0 && (
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-100 bg-slate-900 shadow-inner flex flex-col justify-end" style={{ height: 260 }}>
          <STLViewer
            urls={viewerUrls}
            colors={activeColors}
            assemblyOffsets={assemblyOffsets}
            meshMapping={meshMapping}
            textMeshIndex={textMeshIndex}
            customText={activeText || undefined}
            className="h-full w-full"
          />
          <div className="absolute top-2 left-2 pointer-events-none bg-slate-950/60 rounded-xl px-2.5 py-1 text-[10px] font-semibold text-white/90 backdrop-blur-sm shadow-sm">
            Interactive 3D Preview
          </div>
        </div>
      )}

      {/* Copy Tabs Selector */}
      {parsed && parsed.copies.length > 1 && (
        <div className="space-y-2 border-b border-slate-100 pb-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Copy to Preview:</p>
          <div className="flex flex-wrap gap-1.5">
            {parsed.copies.map((copy, idx) => {
              const label = copy.name ? `Copy #${idx + 1} (${copy.name})` : `Copy #${idx + 1}`
              
              // Get color hex for this tab
              const tabColorName = copy.color || copy.partColors?.[0]?.color || 'Any'
              const tabColorHex = getColorHexByName(tabColorName)
              const hasColor = tabColorName !== 'Any'

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    activeIdx === idx
                      ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
                  }`}
                >
                  {hasColor && (
                    <span className={`h-2.5 w-2.5 rounded-full border shrink-0 shadow-sm transition ${
                      activeIdx === idx ? 'border-white/50' : 'border-slate-200'
                    }`} style={{ background: tabColorHex }} />
                  )}
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* active configuration display */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-slate-400 block mb-0.5">Material</span>
          <span className="font-semibold text-slate-850">{MATERIAL_LABELS[request.material]}</span>
        </div>

        <div>
          <span className="text-slate-400 block mb-0.5">Quality</span>
          <span className="font-semibold text-slate-855">{QUALITY_LABELS[request.quality] ?? 'Basic'}</span>
        </div>

        {/* Color customisation display */}
        {(() => {
          if (parsed && parsed.copies[activeIdx]) {
            const copy = parsed.copies[activeIdx]
            if (copy.partColors && copy.partColors.length > 0) {
              return (
                <div className="col-span-2 bg-slate-50/50 border border-slate-100 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Part Colors (Copy #{activeIdx + 1}):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {copy.partColors.map((pc, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium truncate max-w-[60%]">{pc.partName}:</span>
                        <span className="font-semibold text-slate-700">{pc.color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            } else if (copy.color) {
              return (
                <div>
                  <span className="text-slate-400 block mb-0.5">Color</span>
                  <span className="font-semibold text-slate-855">{copy.color}</span>
                </div>
              )
            }
          } else {
            // Legacy/Single part colors
            if (request.color && request.color.includes('|')) {
              const colors = request.color.split('|')
              return (
                <div className="col-span-2 bg-slate-50/50 border border-slate-100 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Part Colors:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {printableParts.map((url, i) => {
                      const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${i + 1}`
                      return (
                        <div key={url} className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium truncate max-w-[60%]">{filename}:</span>
                          <span className="font-semibold text-slate-700">{colors[i] || 'Any'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            } else if (request.color) {
              return (
                <div>
                  <span className="text-slate-400 block mb-0.5">Color</span>
                  <span className="font-semibold text-slate-855">{request.color}</span>
                </div>
              )
            }
          }
          return null
        })()}

        {/* Text engraving display */}
        {(() => {
          if (parsed && parsed.copies[activeIdx]) {
            const copy = parsed.copies[activeIdx]
            if (copy.name) {
              return (
                <div className="col-span-2 bg-indigo-50/50 border border-indigo-100 px-3 py-2 rounded-xl text-[11px]">
                  <span className="font-semibold text-indigo-700">✏️ Custom Engraving:</span>{' '}
                  <span className="font-bold text-indigo-900">&ldquo;{copy.name}&rdquo;</span>
                </div>
              )
            }
          } else {
            // Legacy / Single text
            const surfaceTextMatch = (request.notes ?? '').match(/Surface text: "([^"]+)"/) || (request.notes ?? '').match(/text: "([^"]+)"/) || (request.notes ?? '').match(/: "([^"]+)"/)
            const surfaceText = surfaceTextMatch?.[1]
            if (surfaceText) {
              return (
                <div className="col-span-2 bg-indigo-50/50 border border-indigo-100 px-3 py-2 rounded-xl text-[11px]">
                  <span className="font-semibold text-indigo-700">✏️ Custom Engraving:</span>{' '}
                  <span className="font-bold text-indigo-900">&ldquo;{surfaceText}&rdquo;</span>
                </div>
              )
            }
          }
          return null
        })()}

        {/* Size */}
        {(() => {
          const m = request.notes?.match(/^\[(\d+\.?\d*)×(\d+\.?\d*)×(\d+\.?\d*)mm\]/)
          if (!m) return null
          return (
            <div>
              <span className="text-slate-400 block mb-0.5">Size</span>
              <span className="font-semibold text-slate-855">{m[1]} × {m[2]} × {m[3]} mm</span>
            </div>
          )
        })()}

        <div>
          <span className="text-slate-400 block mb-0.5">Deadline</span>
          <span className="font-semibold text-slate-855">
            {new Date(request.deadline).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        <div className="col-span-2 border-t border-slate-50 pt-2 mt-1">
          <span className="text-slate-400 block mb-0.5">Fulfillment</span>
          <span className="font-semibold text-slate-855">
            {request.fulfillment === 'delivery'
              ? `🚚 Delivery${request.delivery_address ? ` to ${request.delivery_address}` : ''}`
              : `🏠 Pickup${pickupAddress ? ` at ${pickupAddress}` : ''}`}
          </span>
        </div>

        {request.weight_g && (
          <div>
            <span className="text-slate-400 block mb-0.5">Weight</span>
            <span className="font-semibold text-slate-855">~{request.weight_g}g</span>
          </div>
        )}

        {request.print_hours && (
          <div>
            <span className="text-slate-400 block mb-0.5">Print time</span>
            <span className="font-semibold text-slate-855">~{request.print_hours}h</span>
          </div>
        )}
      </div>

      {/* STL File Links */}
      {(request.stl_urls?.length > 0 || request.stl_url) && (
        <div className="border-t border-slate-100 pt-2.5 flex flex-wrap gap-3">
          {(request.stl_urls?.length > 0 ? request.stl_urls : [request.stl_url!]).map((url, i) => (
            <Link
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition"
            >
              {request.stl_urls?.length > 1 ? `View Part File ${i + 1}` : 'View Model STL'} ↗
            </Link>
          ))}
        </div>
      )}

      {/* Customer notes */}
      {cleanNotes && cleanNotes.trim() && (
        <div className="border-t border-slate-100 pt-2.5">
          <span className="text-slate-400 block mb-0.5 text-xs font-medium">Customer Notes:</span>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 p-2.5 rounded-xl whitespace-pre-wrap">
            {cleanNotes}
          </p>
        </div>
      )}
    </div>
  )
}
