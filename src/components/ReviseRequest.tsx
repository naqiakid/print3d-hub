'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import type { FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS, MATERIAL_DESCRIPTIONS } from '@/lib/types'
import { updateRequest } from '@/lib/actions'
import { useRouter } from 'next/navigation'
import AddressInput from './AddressInput'

type FilamentColor = { id: string; material: string; color: string; color_hex: string }

export default function ReviseRequest({
  requestId,
  currentMaterial,
  currentColor,
  currentColorHex,
  currentSelectedAddons,
  currentDeclinedAddons,
  availableMaterials,
  filaments,
  status,
  allowMaterialChange = true,
  allowColorChange = true,
  currentQuantity = 1,
  currentFulfillment = 'pickup',
  currentDeliveryAddress = '',
  currentNotes = '',
  printer,
}: {
  requestId: string
  currentMaterial: string
  currentColor: string
  currentColorHex: string
  currentSelectedAddons: string[]
  currentDeclinedAddons: string[]
  availableMaterials: FilamentMaterial[]
  filaments: FilamentColor[]
  status: string
  allowMaterialChange?: boolean
  allowColorChange?: boolean
  currentQuantity?: number
  currentFulfillment?: 'pickup' | 'delivery'
  currentDeliveryAddress?: string | null
  currentNotes?: string
  printer: {
    pickup_address: string | null
    delivery_available: boolean
    delivery_rate_per_km: number | null
    lat: number | null
    lng: number | null
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [material, setMaterial] = useState<string>(currentMaterial)
  const [color, setColor] = useState(currentColor || 'Any')
  const [colorHex, setColorHex] = useState(currentColorHex || '#888888')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  // New renegotiation fields
  const [quantity, setQuantity] = useState(currentQuantity)
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>(currentFulfillment)
  const [deliveryAddress, setDeliveryAddress] = useState(currentDeliveryAddress || '')
  const [deliveryGeoLoading, setDeliveryGeoLoading] = useState(false)
  const [deliveryEstimate, setDeliveryEstimate] = useState<{ km: number; fee: number } | null>(null)
  const [deliveryGeoError, setDeliveryGeoError] = useState('')
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Listen for hashchange to auto-expand when routed from Decline dialog
  useEffect(() => {
    const checkHash = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#revise-request-section') {
        setOpen(true)
      }
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  // Geocoding and distance calculation logic
  const calculateDistanceAndFee = useCallback((cLat: number, cLng: number) => {
    if (!printer.lat || !printer.lng) return
    const printerLat = printer.lat
    const printerLng = printer.lng
    const R    = 6371
    const dLat = (cLat - printerLat) * Math.PI / 180
    const dLng = (cLng - printerLng) * Math.PI / 180
    const a    = Math.sin(dLat / 2) ** 2 + Math.cos(printerLat * Math.PI / 180) * Math.cos(cLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    const straight = R * 2 * Math.asin(Math.sqrt(a))
    const road  = straight * 1.3
    const rate  = printer.delivery_rate_per_km ?? 1.00
    const fee   = Math.ceil(road * rate * 10) / 10
    setDeliveryEstimate({ km: Math.round(road * 10) / 10, fee })
  }, [printer.lat, printer.lng, printer.delivery_rate_per_km])

  const handleSelectCoords = (coords: { lat: number; lng: number } | null) => {
    setSelectedCoords(coords)
    if (coords) {
      calculateDistanceAndFee(coords.lat, coords.lng)
      setDeliveryGeoError('')
      setDeliveryGeoLoading(false)
    } else {
      setDeliveryEstimate(null)
    }
  }

  // Geocode delivery address (debounced)
  useEffect(() => {
    if (fulfillment !== 'delivery' || !deliveryAddress.trim() || !printer.lat || !printer.lng) {
      setDeliveryEstimate(null)
      setDeliveryGeoError('')
      return
    }
    if (selectedCoords) return

    setDeliveryGeoLoading(true)
    setDeliveryGeoError('')
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(deliveryAddress)}&format=json&limit=1&countrycodes=my`,
          { headers: { 'User-Agent': 'Print3DHubApp/1.0' } },
        )
        const data = await res.json()
        if (!data?.[0]) { setDeliveryGeoError('Address not found — try adding postcode or city'); setDeliveryGeoLoading(false); return }
        const cLat = parseFloat(data[0].lat)
        const cLng = parseFloat(data[0].lon)
        calculateDistanceAndFee(cLat, cLng)
        setDeliveryGeoLoading(false)
      } catch {
        setDeliveryGeoError('Could not estimate distance')
        setDeliveryGeoLoading(false)
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [deliveryAddress, fulfillment, selectedCoords, calculateDistanceAndFee, printer.lat, printer.lng])

  const isDelivery = fulfillment === 'delivery'
  const addressReady = !isDelivery || (deliveryAddress.trim().length > 0 && !deliveryGeoLoading && !deliveryGeoError && !!deliveryEstimate)
  const canSubmit = addressReady && !isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    startTransition(async () => {
      let revisedNotes = (currentNotes ?? '').trim()
      const qtyPattern = /Quantity: \d+ copies/
      const qtyString = `Quantity: ${quantity} copies`

      if (qtyPattern.test(revisedNotes)) {
        revisedNotes = revisedNotes.replace(qtyPattern, qtyString)
      } else if (quantity > 1) {
        revisedNotes = revisedNotes ? `${revisedNotes}. ${qtyString}` : qtyString
      }

      if (notes.trim()) {
        revisedNotes = revisedNotes ? `${revisedNotes}\nRevision note: ${notes.trim()}` : notes.trim()
      }

      const result = await updateRequest(requestId, {
        material,
        color,
        color_hex: colorHex,
        selected_addons: currentSelectedAddons,
        declined_addons: currentDeclinedAddons,
        notes: revisedNotes || undefined,
        fulfillment,
        delivery_address: isDelivery ? deliveryAddress.trim() : null,
        delivery_cost: isDelivery ? (deliveryEstimate?.fee ?? null) : null,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        setDone(true)
        setTimeout(() => router.refresh(), 800)
      }
    })
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-semibold text-green-700">Request updated!</p>
        <p className="text-xs text-green-600 mt-1">The owner has been notified and will send a revised quote.</p>
      </div>
    )
  }

  if (!['new', 'quoted'].includes(status)) return null

  return (
    <div id="revise-request-section" className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <div>
          <p className="text-sm font-semibold text-slate-800">Want to change something?</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {status === 'quoted'
              ? 'Modifying will reset the quote — the owner will need to re-review.'
              : [
                  allowMaterialChange && 'material',
                  allowColorChange && 'color',
                ].filter(Boolean).join(' or ') + ' can still be updated before the owner quotes.'}
          </p>
        </div>
        <span className="text-slate-300 text-xs ml-4">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-slate-100 px-5 py-4 space-y-5">
          {/* Quantity */}
          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">Quantity</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-orange-300 transition text-lg font-medium"
              >
                −
              </button>
              <span className="text-lg font-semibold text-slate-900 min-w-[2ch] text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(20, quantity + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-orange-300 transition text-lg font-medium"
              >
                +
              </button>
            </div>
          </div>

          {/* Collection / Fulfillment Toggle */}
          {(printer.pickup_address || printer.delivery_available) && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">Collection</h3>
              <div className="grid grid-cols-2 gap-2">
                {printer.pickup_address && (
                  <button
                    type="button"
                    onClick={() => setFulfillment('pickup')}
                    className={`rounded-xl border px-3 py-2 text-center transition ${
                      fulfillment === 'pickup'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                    }`}
                  >
                    <p className="text-sm font-medium">Pickup</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{printer.pickup_address}</p>
                  </button>
                )}
                {printer.delivery_available && (
                  <button
                    type="button"
                    onClick={() => setFulfillment('delivery')}
                    className={`rounded-xl border px-3 py-2 text-center transition ${
                      fulfillment === 'delivery'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                    }`}
                  >
                    <p className="text-sm font-medium">Delivery</p>
                    <p className="text-xs text-slate-400 mt-0.5">RM {printer.delivery_rate_per_km?.toFixed(2)}/km</p>
                  </button>
                )}
              </div>

              {fulfillment === 'delivery' && (
                <div className="mt-3 space-y-2">
                  <AddressInput
                    value={deliveryAddress}
                    onChange={setDeliveryAddress}
                    onSelectCoords={handleSelectCoords}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
                  />
                  {deliveryGeoLoading && (
                    <p className="text-xs text-slate-400">Estimating distance…</p>
                  )}
                  {deliveryEstimate && !deliveryGeoLoading && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                      <span>📍</span>
                      <span>
                        ~{deliveryEstimate.km} km from owner ·{' '}
                        <strong>est. RM {deliveryEstimate.fee.toFixed(2)} delivery fee</strong>
                      </span>
                    </div>
                  )}
                  {deliveryGeoError && !deliveryGeoLoading && (
                    <p className="text-xs text-amber-600">{deliveryGeoError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Material — only shown when the catalog item (or non-catalog order) allows it */}
          {allowMaterialChange && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">Material</h3>
              <div className="space-y-2">
                {availableMaterials.map((mat) => (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => {
                      setMaterial(mat)
                      setColor('Any')
                      setColorHex('#888888')
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      material === mat
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <p className="text-sm font-medium">{MATERIAL_LABELS[mat]}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{MATERIAL_DESCRIPTIONS[mat]}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color — filtered to the currently selected material, from real filament stock */}
          {allowColorChange && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">Color</h3>
              {(() => {
                const colorsForMaterial = filaments.filter((f) => f.material === material)
                const colorOptions: { id: string; name: string; hex: string }[] =
                  colorsForMaterial.length > 0
                    ? [
                        { id: '__any__', name: 'Any / Owner decides', hex: '#888888' },
                        ...colorsForMaterial.map((f) => ({ id: f.id, name: f.color, hex: f.color_hex })),
                      ]
                    : [{ id: '__any__', name: 'Any / Owner decides', hex: '#888888' }]

                return (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map(({ id, name, hex }) => {
                        const isAny = id === '__any__'
                        const isSelected = isAny ? color === 'Any' : color === name
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setColor(isAny ? 'Any' : name)
                              setColorHex(hex)
                            }}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                              isSelected
                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                            }`}
                          >
                            {!isAny && (
                              <span
                                className="h-3 w-3 rounded-full border border-slate-200 shrink-0"
                                style={{ background: hex }}
                              />
                            )}
                            {name}
                          </button>
                        )
                      })}
                    </div>
                    {colorsForMaterial.length === 0 && (
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        No {MATERIAL_LABELS[material as FilamentMaterial] ?? material} filaments in stock — owner will choose.
                      </p>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Notes */}
          <div>
            <h3 className="mb-1 text-xs font-semibold text-slate-700 uppercase tracking-wide">Additional note to owner</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Changed to PETG for better heat resistance, please re-quote."
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {isPending ? 'Updating…' : 'Update request'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
