'use client'

import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'
import { haversineKm, fmtDist } from '@/lib/geo'

interface Props {
  makerLat?: number | null
  makerLng?: number | null
}

export default function MakerDistanceBadge({ makerLat, makerLng }: Props) {
  const [distanceText, setDistanceText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (makerLat == null || makerLng == null) return

    // Try to get location automatically if permission was already granted
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (status.state === 'granted') {
          fetchDistance()
        }
      })
    }
  }, [makerLat, makerLng])

  const fetchDistance = () => {
    if (makerLat == null || makerLng == null) return
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineKm(
          pos.coords.latitude,
          pos.coords.longitude,
          makerLat,
          makerLng
        )
        setDistanceText(fmtDist(dist))
        setLoading(false)
      },
      () => {
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  if (makerLat == null || makerLng == null) return null

  return (
    <button
      type="button"
      onClick={distanceText ? undefined : fetchDistance}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 transition ${
        distanceText
          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
          : 'bg-white/10 text-white/70 ring-white/20 hover:bg-white/15 active:scale-95'
      }`}
    >
      <MapPin className={`h-3 w-3 shrink-0 ${distanceText ? 'text-emerald-400' : 'text-white/60'}`} />
      {loading ? (
        <span className="animate-pulse">Locating...</span>
      ) : distanceText ? (
        <span>{distanceText}</span>
      ) : (
        <span>Show distance</span>
      )}
    </button>
  )
}
