'use client'

import { useState, lazy, Suspense } from 'react'
import { Locate, MapPin } from 'lucide-react'
import type { Printer } from '@/lib/types'
import PrinterCard from './PrinterCard'

const PrinterMap = lazy(() => import('./PrinterMap'))

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type GeoStatus = 'idle' | 'loading' | 'granted' | 'denied'

export default function PrintersBrowse({ printers }: { printers: Printer[] }) {
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')

  function requestLocation() {
    if (!navigator.geolocation) { setGeoStatus('denied'); return }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setGeoStatus('granted')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // Compute distances and sort
  type WithDist = { printer: Printer; distanceKm: number | undefined }
  const sorted: WithDist[] = printers
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

  const available = sorted.filter((x) => x.printer.available)
  const busy = sorted.filter((x) => !x.printer.available)

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Browse Printers</h1>
          <p className="mt-1 text-slate-600">
            {printers.length} printing service{printers.length !== 1 ? 's' : ''}
            {geoStatus === 'granted' ? ' · sorted by distance' : ''}
          </p>
        </div>

        <button
          onClick={requestLocation}
          disabled={geoStatus === 'loading' || geoStatus === 'granted'}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            geoStatus === 'granted'
              ? 'border border-green-200 bg-green-50 text-green-700'
              : geoStatus === 'denied'
              ? 'border border-red-200 bg-red-50 text-red-600'
              : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
          } disabled:cursor-default`}
        >
          {geoStatus === 'loading' ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : geoStatus === 'granted' ? (
            <MapPin className="h-4 w-4" />
          ) : (
            <Locate className="h-4 w-4" />
          )}
          {geoStatus === 'loading'
            ? 'Getting location…'
            : geoStatus === 'granted'
            ? 'Location active'
            : geoStatus === 'denied'
            ? 'Location denied'
            : 'Near me'}
        </button>
      </div>

      {geoStatus === 'denied' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Location access was denied. Enable it in your browser settings and try again.
        </div>
      )}

      {/* Map + List */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Listing — scrollable on desktop */}
        <div className="order-2 lg:order-1 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:max-h-[75vh] space-y-8 lg:pr-1">
          {available.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                Available now
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {available.length}
                </span>
              </h2>
              <div className="space-y-4">
                {available.map(({ printer, distanceKm }) => (
                  <PrinterCard key={printer.id} printer={printer} distanceKm={distanceKm} />
                ))}
              </div>
            </section>
          )}

          {busy.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-medium text-slate-400">
                Currently busy
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {busy.length}
                </span>
              </h2>
              <div className="space-y-4">
                {busy.map(({ printer, distanceKm }) => (
                  <PrinterCard key={printer.id} printer={printer} distanceKm={distanceKm} />
                ))}
              </div>
            </section>
          )}

          {printers.length === 0 && (
            <div className="flex flex-col items-center py-24 text-center">
              <p className="text-lg font-medium text-slate-500">No printers listed yet</p>
              <p className="mt-1 text-sm text-slate-400">Be the first to list your 3D printer!</p>
            </div>
          )}
        </div>

        {/* Map — sticky on desktop */}
        <div className="order-1 lg:order-2 relative flex-1 h-[360px] lg:h-[75vh] lg:sticky lg:top-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Loading map…
              </div>
            }
          >
            <PrinterMap printers={printers} userLat={userLat} userLng={userLng} />
          </Suspense>

          {/* "Near me" hint overlay shown when location not yet requested */}
          {geoStatus === 'idle' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <div className="rounded-xl bg-white/90 px-4 py-2 text-xs text-slate-600 shadow backdrop-blur-sm">
                Click <strong>Near me</strong> to find printers closest to you
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
