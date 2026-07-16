'use client'

import { useEffect, useRef } from 'react'
import type { Shop } from '@/lib/types'
import { haversineKm } from '@/lib/geo'
import { ensureLeafletCSS } from '@/lib/leaflet-utils'

interface Props {
  printers: Shop[]
  userLat: number | null
  userLng: number | null
}

export default function PrinterMap({ printers, userLat, userLng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const groupRef = useRef<import('leaflet').LayerGroup | null>(null)
  const hasFitRef = useRef(false)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    ensureLeafletCSS()

    import('leaflet').then((mod) => {
      const L = mod.default
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: [3.139, 101.6869],
        zoom: 10,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      groupRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      groupRef.current = null
      hasFitRef.current = false
    }
  }, [])

  // Re-draw markers whenever printers or user location changes
  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group) return

    import('leaflet').then((mod) => {
      const L = mod.default
      group.clearLayers()
      const bounds: [number, number][] = []

      // Printer markers
      printers.forEach((p) => {
        if (!p.lat || !p.lng) return
        bounds.push([p.lat, p.lng])

        const color = p.available ? '#f97316' : '#94a3b8'
        const icon = L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 9.94 14 22 14 22S28 23.94 28 14C28 6.27 21.73 0 14 0z" fill="${color}"/>
            <circle cx="14" cy="14" r="6" fill="white"/>
          </svg>`,
          iconSize: [28, 36],
          iconAnchor: [14, 36],
          popupAnchor: [0, -38],
          className: '',
        })

        const dist =
          userLat != null && userLng != null
            ? haversineKm(userLat, userLng, p.lat, p.lng)
            : null

        const distHtml = dist != null
          ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b">📍 ${
              dist < 1 ? `${Math.round(dist * 1000)}m away` : `${dist.toFixed(1)}km away`
            }</p>`
          : ''

        const badgeColor = p.available ? '#15803d' : '#64748b'
        const badgeBg = p.available ? '#dcfce7' : '#f1f5f9'

        L.marker([p.lat, p.lng], { icon })
          .bindPopup(
            `<div style="font-family:system-ui;min-width:180px;padding:2px 0">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:2px">
                <strong style="font-size:13px;line-height:1.3">${p.name}</strong>
                <span style="font-size:10px;font-weight:700;color:${badgeColor};background:${badgeBg};padding:2px 7px;border-radius:20px;white-space:nowrap;margin-top:1px">${p.available ? 'Available' : 'Busy'}</span>
              </div>
              ${distHtml}
              <a href="/printers/${p.id}" style="display:block;text-align:center;background:#f97316;color:white;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;text-decoration:none">
                View printer →
              </a>
            </div>`,
            { maxWidth: 240 }
          )
          .addTo(group)
      })

      // User location marker
      if (userLat != null && userLng != null) {
        const pulseIcon = L.divIcon({
          html: `<div style="position:relative;width:22px;height:22px">
            <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;animation:map-ping 1.5s ease-out infinite"></div>
            <div style="position:absolute;inset:4px;background:#3b82f6;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(59,130,246,.5)"></div>
          </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          className: '',
        })
        L.marker([userLat, userLng], { icon: pulseIcon })
          .bindPopup('<strong style="font-size:13px">Your location</strong>')
          .addTo(group)

        if (!hasFitRef.current && bounds.length > 0) {
          const allBounds: [number, number][] = [[userLat, userLng], ...bounds]
          map.fitBounds(allBounds as import('leaflet').LatLngBoundsLiteral, {
            padding: [50, 50],
            maxZoom: 14,
          })
          hasFitRef.current = true
        } else {
          map.flyTo([userLat, userLng], 13, { duration: 1.5 })
        }
      } else if (bounds.length > 0 && !hasFitRef.current) {
        map.fitBounds(bounds as import('leaflet').LatLngBoundsLiteral, {
          padding: [40, 40],
          maxZoom: 13,
        })
        hasFitRef.current = true
      }
    })
  }, [printers, userLat, userLng])

  return <div ref={containerRef} className="h-full w-full" />
}
