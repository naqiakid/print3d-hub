'use client'

import { useState, useTransition, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { Pencil, Check, X, MapPin, Truck, Search, Loader2, Map } from 'lucide-react'
import type { Printer } from '@/lib/types'
import { updateListing } from '@/lib/actions'
import { getPresetById } from '@/lib/printer-models'

const MapPicker = lazy(() => import('./MapPicker'))

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const labelClass = 'block text-xs text-slate-400 mb-1'

type PlaceSuggestion = {
  display_name: string
  place_id: string
  source: 'google' | 'nominatim'
  lat?: string
  lon?: string
}

function AddressSearch({
  onSelect,
}: {
  onSelect: (address: string, lat: number, lng: number) => void
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`)
      const data: PlaceSuggestion[] = await res.json()
      setSuggestions(data)
      setOpen(data.length > 0)
    } catch {
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  async function handlePick(s: PlaceSuggestion) {
    setOpen(false)
    setSuggestions([])
    setQuery('')

    if (s.source === 'nominatim' && s.lat && s.lon) {
      onSelect(s.display_name, parseFloat(s.lat), parseFloat(s.lon))
      return
    }

    if (s.source === 'google') {
      try {
        const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(s.place_id)}`)
        const detail = await res.json() as { lat: number; lng: number; address: string }
        onSelect(detail.address || s.display_name, detail.lat, detail.lng)
      } catch {
        onSelect(s.display_name, 0, 0)
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 animate-spin" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
          placeholder="Search street or area to find location…"
          className={`${inputClass} pl-8 ${loading ? 'pr-8' : ''}`}
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(s)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-xs hover:bg-orange-50 transition border-b border-slate-100 last:border-b-0"
              >
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-orange-400" />
                <span className="text-slate-700 leading-relaxed">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'print3d-hub/1.0', 'Accept-Language': 'en' },
    })
    const data = await res.json() as { display_name?: string }
    return data.display_name ?? null
  } catch {
    return null
  }
}

export default function ListingEditor({ printer }: { printer: Printer }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]               = useState(printer.name)
  const [description, setDescription] = useState(printer.description)
  const [turnaround, setTurnaround]   = useState(printer.turnaround)
  const [contactPhone, setContactPhone] = useState(printer.contact_phone)
  const [electricityRate, setElectricityRate] = useState(String(printer.electricity_rate ?? 0.516))
  const [markupPercent, setMarkupPercent]     = useState(String(printer.markup_percent ?? 30))
  const [unitNo, setUnitNo]           = useState('')
  const [streetAddress, setStreetAddress] = useState(printer.pickup_address ?? '')
  const [lat, setLat] = useState<number | null>(printer.lat ?? null)
  const [lng, setLng] = useState<number | null>(printer.lng ?? null)
  const [reverseLoading, setReverseLoading] = useState(false)
  const [deliveryAvailable, setDeliveryAvailable] = useState(printer.delivery_available ?? false)
  const [deliveryRatePerKm, setDeliveryRatePerKm] = useState(String(printer.delivery_rate_per_km ?? '1.00'))
  const [saveError, setSaveError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Combined address for saving: "Unit, Street" or just "Street"
  const fullAddress = [unitNo.trim(), streetAddress.trim()].filter(Boolean).join(', ')

  function handleCancel() {
    setName(printer.name)
    setDescription(printer.description)
    setTurnaround(printer.turnaround)
    setContactPhone(printer.contact_phone)
    setElectricityRate(String(printer.electricity_rate ?? 0.516))
    setMarkupPercent(String(printer.markup_percent ?? 30))
    setUnitNo('')
    setStreetAddress(printer.pickup_address ?? '')
    setLat(printer.lat ?? null)
    setLng(printer.lng ?? null)
    setDeliveryAvailable(printer.delivery_available ?? false)
    setDeliveryRatePerKm(String(printer.delivery_rate_per_km ?? '1.00'))
    setSaveError('')
    setEditing(false)
  }

  function handleSave() {
    setSaveError('')
    startTransition(async () => {
      const result = await updateListing({
        printer_id: printer.id,
        name: name.trim(),
        description: description.trim(),
        turnaround: turnaround.trim(),
        contact_phone: contactPhone.trim(),
        electricity_rate: parseFloat(electricityRate) || 0.516,
        markup_percent: parseFloat(markupPercent) || 30,
        pickup_address: fullAddress,
        lat: lat ?? null,
        lng: lng ?? null,
        delivery_available: deliveryAvailable,
        delivery_rate_per_km: deliveryAvailable ? (parseFloat(deliveryRatePerKm) || 1.00) : null,
      })
      if (result?.error) {
        setSaveError(result.error)
      } else {
        setEditing(false)
      }
    })
  }

  async function handleMapPick(newLat: number, newLng: number) {
    setLat(newLat)
    setLng(newLng)
    setReverseLoading(true)
    const address = await reverseGeocode(newLat, newLng)
    setReverseLoading(false)
    if (address) setStreetAddress(address)
  }

  function handleSearchSelect(address: string, selLat: number, selLng: number) {
    setStreetAddress(address)
    setLat(selLat)
    setLng(selLng)
  }

  if (!editing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{name}</h2>
            <p className="text-sm text-slate-500">{printer.printer_model}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>

        <p className="text-sm text-slate-600">{description}</p>

        <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-4">
          <div>
            <span className="block text-xs text-slate-400">Turnaround</span>
            <span className="font-medium text-slate-900">{turnaround}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">WhatsApp</span>
            <span className="font-medium text-slate-900">{contactPhone}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Printer peak power</span>
            <span className="font-medium text-slate-900">
              {getPresetById(printer.printer_model_id ?? '')?.power_watts ?? '—'} W
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Electricity rate</span>
            <span className="font-medium text-slate-900">RM{electricityRate}/kWh</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Markup</span>
            <span className="font-medium text-slate-900">{markupPercent}%</span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pickup & Delivery</p>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            {printer.pickup_address
              ? <span className="text-slate-700">{printer.pickup_address}</span>
              : <span className="text-slate-400 italic">No pickup address set</span>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-slate-400 shrink-0" />
            {deliveryAvailable
              ? <span className="text-slate-700">
                  Delivery available · RM{parseFloat(deliveryRatePerKm || '1.00').toFixed(2)}/km
                </span>
              : <span className="text-slate-400">Pickup only</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900">Edit listing</p>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Listing name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Turnaround time</label>
          <input
            value={turnaround}
            onChange={(e) => setTurnaround(e.target.value)}
            placeholder="e.g. 2–3 days"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>WhatsApp number</label>
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+60 12 345 6789"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Electricity rate (RM/kWh)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={electricityRate}
            onChange={(e) => setElectricityRate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Markup (%)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={markupPercent}
            onChange={(e) => setMarkupPercent(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Pickup & Delivery ── */}
      <div className="border-t border-slate-100 pt-4 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pickup & Delivery</p>

        {/* Address fields */}
        <div className="space-y-3">
          {/* Unit / house number */}
          <div>
            <label className={labelClass}>Unit / House No. <span className="text-slate-300">(optional)</span></label>
            <input
              value={unitNo}
              onChange={(e) => setUnitNo(e.target.value)}
              placeholder="e.g. No. 12  or  Unit 3A, Block B"
              className={inputClass}
            />
          </div>

          {/* Street address with search */}
          <div>
            <label className={labelClass}>Street / Area</label>
            <input
              value={streetAddress}
              onChange={(e) => { setStreetAddress(e.target.value); setLat(null); setLng(null) }}
              placeholder="e.g. Jalan Ampang, 50450 Kuala Lumpur"
              className={inputClass}
            />
          </div>

          {/* Address search helper */}
          <div>
            <label className={labelClass}>
              <Search className="inline h-3 w-3 mr-1" />
              Search to find your street
            </label>
            <AddressSearch onSelect={handleSearchSelect} />
          </div>

          {/* Preview of saved address */}
          {fullAddress && (
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-orange-400" />
              <span>{fullAddress}</span>
            </div>
          )}
        </div>

        {/* Map pin */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Map className="h-3.5 w-3.5 text-slate-400" />
            <label className="text-xs text-slate-400">
              Pin your exact location on the map
              {reverseLoading && <Loader2 className="inline h-3 w-3 ml-1.5 animate-spin text-orange-400" />}
            </label>
          </div>
          <p className="mb-2 text-xs text-slate-400">
            Click anywhere on the map to drop a pin — it auto-fills the street address above. Drag the pin to fine-tune.
          </p>
          <Suspense fallback={
            <div className="h-[280px] w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
              Loading map…
            </div>
          }>
            <MapPicker lat={lat} lng={lng} onPick={handleMapPick} />
          </Suspense>
          {lat != null && lng != null && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" />
              Location pinned ({lat.toFixed(5)}, {lng.toFixed(5)})
            </p>
          )}
        </div>

        {/* Delivery toggle */}
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deliveryAvailable}
              onChange={(e) => setDeliveryAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-orange-500"
            />
            <span className="text-sm font-medium text-slate-700">Offer delivery to customers</span>
          </label>
          <p className="mt-1 ml-6.5 text-xs text-slate-400">
            Customers can request delivery and you&apos;ll add the fee to their quote.
          </p>
        </div>

        {deliveryAvailable && (
          <div>
            <label className={labelClass}>Delivery rate (RM per km)</label>

            <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Malaysia market rates: RM 0.70/km (Lalamove motorcycle) · RM 1.00/km (standard) · RM 1.50/km (car/van)
            </div>

            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {['0.70', '1.00', '1.30', '1.50'].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setDeliveryRatePerKm(rate)}
                  className={`rounded-lg border py-1.5 text-center text-xs font-medium transition ${
                    deliveryRatePerKm === rate
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                  }`}
                >
                  RM {rate}
                  {rate === '1.00' && <span className="ml-0.5 text-orange-400">★</span>}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">RM</span>
              <input
                type="number"
                step="0.10"
                min="0"
                value={deliveryRatePerKm}
                onChange={(e) => setDeliveryRatePerKm(e.target.value)}
                placeholder="1.00"
                className={`${inputClass} pl-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">/km</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Customers see an estimated fee based on their distance from you. You can adjust the final amount in your quote.
            </p>
          </div>
        )}
      </div>

      {saveError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</p>
      )}
    </div>
  )
}
