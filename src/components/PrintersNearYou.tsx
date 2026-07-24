'use client'

import { useState, useEffect } from 'react'
import { MapPin, Locate, ArrowRight } from 'lucide-react'
import type { Shop } from '@/lib/types'
import { haversineKm } from '@/lib/geo'
import PrinterCard from './PrinterCard'
import Link from 'next/link'

type GeoStatus = 'idle' | 'loading' | 'granted' | 'denied'

export default function PrintersNearYou({ initialPrinters }: { initialPrinters: Shop[] }) {
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')

  useEffect(() => {
    // Attempt automatic geolocation check on mount
    if (navigator.geolocation) {
      navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          requestLocation()
        }
      })
    }
  }, [])

  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('denied')
      return
    }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setGeoStatus('granted')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Compute distances and sort
  type WithDist = { printer: Shop; distanceKm: number | undefined }
  const sorted: WithDist[] = initialPrinters
    .map((p) => ({
      printer: p,
      distanceKm:
        userLat != null && userLng != null && p.lat && p.lng
          ? haversineKm(userLat, userLng, p.lat, p.lng)
          : undefined,
    }))
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })

  // Limit to top 3 printers
  const displayedPrinters = sorted.slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Printers Near You</h2>
          <p className="mt-1 text-slate-500">
            {geoStatus === 'granted'
              ? 'Makers located closest to your current location'
              : 'Find local makers ready to take your order'}
          </p>
        </div>

        <button
          onClick={requestLocation}
          disabled={geoStatus === 'loading' || geoStatus === 'granted'}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm transition ${
            geoStatus === 'granted'
              ? 'border border-green-200 bg-green-50 text-green-700'
              : geoStatus === 'denied'
              ? 'border border-red-200 bg-red-50 text-red-600'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          } disabled:cursor-default disabled:opacity-90`}
        >
          {geoStatus === 'loading' ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : geoStatus === 'granted' ? (
            <MapPin className="h-3.5 w-3.5" />
          ) : (
            <Locate className="h-3.5 w-3.5" />
          )}
          {geoStatus === 'loading'
            ? 'Finding location…'
            : geoStatus === 'granted'
            ? 'Location active'
            : geoStatus === 'denied'
            ? 'Location access denied'
            : 'Find nearest'}
        </button>
      </div>

      {geoStatus === 'denied' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Location access is blocked or denied. Please enable location permissions in your browser settings to sort makers by distance.
        </div>
      )}

      {displayedPrinters.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <p className="text-sm text-slate-500">No active printers found on the network.</p>
          <Link href="/register" className="mt-3 text-xs font-semibold text-orange-500 hover:text-orange-655 transition">
            Be the first to list your printer →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayedPrinters.map(({ printer, distanceKm }) => (
            <PrinterCard key={printer.id} printer={printer} distanceKm={distanceKm} />
          ))}
        </div>
      )}

      {initialPrinters.length > 3 && (
        <div className="text-center">
          <Link
            href="/printers"
            className="inline-flex items-center gap-1 text-sm font-semibold text-orange-500 hover:text-orange-650 transition"
          >
            Browse all available printers ({initialPrinters.length}) <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
