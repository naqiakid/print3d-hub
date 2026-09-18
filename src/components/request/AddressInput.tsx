'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Locate, Loader2 } from 'lucide-react'

type Suggestion = {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface AddressInputProps {
  value: string
  onChange: (value: string) => void
  onSelectCoords: (coords: { lat: number; lng: number } | null) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export default function AddressInput({
  value,
  onChange,
  onSelectCoords,
  placeholder = 'Full address including postcode and city',
  required = false,
  className = '',
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const isSelectedRef = useRef(false) // Prevents autocomplete trigger right after selection

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search suggestions
  useEffect(() => {
    if (isSelectedRef.current) {
      isSelectedRef.current = false
      return
    }

    const query = value.trim()
    if (query.length < 3) {
      setSuggestions([])
      setSuggestionsOpen(false)
      return
    }

    setLoading(true)
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=my`,
          { headers: { 'User-Agent': 'Print3DHubApp/1.0' } }
        )
        const data = await res.json()
        setSuggestions(data || [])
        setSuggestionsOpen((data || []).length > 0)
      } catch (err) {
        console.error('Autocomplete fetch error:', err)
      } finally {
        setLoading(false)
      }
    }, 600) // 600ms debounce to satisfy Nominatim rate limits

    return () => clearTimeout(delayDebounceFn)
  }, [value])

  // Select suggestion
  function handleSelect(suggestion: Suggestion) {
    isSelectedRef.current = true
    onChange(suggestion.display_name)
    onSelectCoords({
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
    })
    setSuggestions([])
    setSuggestionsOpen(false)
    setGeoError('')
  }

  // Detect current location
  async function handleDetectLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }

    setGeoLoading(true)
    setGeoError('')
    onSelectCoords(null) // Reset coords in parent during loading

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'Print3DHubApp/1.0' } }
          )
          const data = await res.json()
          
          if (data && data.display_name) {
            isSelectedRef.current = true
            onChange(data.display_name)
            onSelectCoords({ lat: latitude, lng: longitude })
          } else {
            setGeoError('Could not resolve your coordinates to a readable address.')
          }
        } catch (err) {
          console.error('Reverse geocoding error:', err)
          setGeoError('Could not resolve address from coordinates.')
        } finally {
          setGeoLoading(false)
        }
      },
      (err) => {
        console.error('Geolocation error:', err)
        let msg = 'Failed to retrieve your location.'
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please allow access in browser settings.'
        }
        setGeoError(msg)
        setGeoLoading(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-slate-600">
          Delivery address {required && <span className="text-red-500">*</span>}
        </label>
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={geoLoading}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-500 hover:text-orange-600 transition disabled:opacity-50"
        >
          {geoLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
              Pinpointing location…
            </>
          ) : (
            <>
              <Locate className="h-3 w-3" />
              Use current location
            </>
          )}
        </button>
      </div>

      <div className="relative">
        <textarea
          id="deliveryAddress"
          name="deliveryAddress"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            // Reset coords if they type manually so parent does its debounced geocoding
            onSelectCoords(null)
            setGeoError('')
          }}
          required={required}
          rows={2}
          placeholder={placeholder}
          className={`${className} resize-none pr-8`}
        />
        {loading && (
          <div className="absolute right-3.5 top-3.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {geoError && (
        <p className="mt-1 text-xs font-medium text-red-500">{geoError}</p>
      )}

      {/* Autocomplete Dropdown */}
      {suggestionsOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 transition"
              >
                <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                <span className="truncate">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
