'use client'

import { useEffect, useRef } from 'react'

interface MapPickerProps {
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
}

// Kuala Lumpur
const DEFAULT_CENTER: [number, number] = [3.139, 101.6869]
const DEFAULT_ZOOM = 12

export default function MapPicker({ lat, lng, onPick }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Leaflet CSS
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.setAttribute('data-leaflet-css', '1')
      document.head.appendChild(link)
    }

    import('leaflet').then((mod) => {
      const L = mod.default

      if (!containerRef.current || mapRef.current) return

      const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER
      const zoom = lat != null && lng != null ? 17 : DEFAULT_ZOOM

      const map = L.map(containerRef.current, { center, zoom })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Orange pin icon using SVG — avoids Leaflet default icon path issues
      const pinIcon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
          <path d="M14 0C6.27 0 0 6.27 0 14c0 9.94 14 22 14 22S28 23.94 28 14C28 6.27 21.73 0 14 0z" fill="#f97316"/>
          <circle cx="14" cy="14" r="6" fill="white"/>
        </svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        className: '',
      })

      function placeMarker(newLat: number, newLng: number) {
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng])
        } else {
          const marker = L.marker([newLat, newLng], { draggable: true, icon: pinIcon }).addTo(map)
          markerRef.current = marker
          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            onPick(pos.lat, pos.lng)
          })
        }
        onPick(newLat, newLng)
      }

      // Place marker at existing location
      if (lat != null && lng != null) {
        placeMarker(lat, lng)
      }

      // Click anywhere to move marker
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        placeMarker(e.latlng.lat, e.latlng.lng)
      })
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pan/zoom to new coordinates when they change externally (e.g. autocomplete pick)
  useEffect(() => {
    if (!mapRef.current) return
    if (lat == null || lng == null) return

    import('leaflet').then((mod) => {
      const L = mod.default
      const map = mapRef.current
      if (!map) return

      map.setView([lat, lng], 17, { animate: true })

      const pinIcon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
          <path d="M14 0C6.27 0 0 6.27 0 14c0 9.94 14 22 14 22S28 23.94 28 14C28 6.27 21.73 0 14 0z" fill="#f97316"/>
          <circle cx="14" cy="14" r="6" fill="white"/>
        </svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        className: '',
      })

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map)
        markerRef.current = marker
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          onPick(pos.lat, pos.lng)
        })
      }
    })
  // Only re-run when lat/lng change from outside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      style={{ height: 280, borderRadius: 12, overflow: 'hidden', zIndex: 0 }}
      className="w-full border border-slate-200"
    />
  )
}
