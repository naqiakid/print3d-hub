'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, MapPin, Truck } from 'lucide-react'
import type { Printer } from '@/lib/types'
import { updateListing } from '@/lib/actions'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const labelClass = 'block text-xs text-slate-400 mb-1'

export default function ListingEditor({ printer }: { printer: Printer }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]               = useState(printer.name)
  const [description, setDescription] = useState(printer.description)
  const [turnaround, setTurnaround]   = useState(printer.turnaround)
  const [contactPhone, setContactPhone] = useState(printer.contact_phone)
  const [electricityRate, setElectricityRate] = useState(String(printer.electricity_rate ?? 0.516))
  const [markupPercent, setMarkupPercent]     = useState(String(printer.markup_percent ?? 30))
  const [pickupAddress, setPickupAddress]     = useState(printer.pickup_address ?? '')
  const [deliveryAvailable, setDeliveryAvailable] = useState(printer.delivery_available ?? false)
  const [deliveryFeeRm, setDeliveryFeeRm]         = useState(String(printer.delivery_fee_rm ?? ''))
  const [saveError, setSaveError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    setName(printer.name)
    setDescription(printer.description)
    setTurnaround(printer.turnaround)
    setContactPhone(printer.contact_phone)
    setElectricityRate(String(printer.electricity_rate ?? 0.516))
    setMarkupPercent(String(printer.markup_percent ?? 30))
    setPickupAddress(printer.pickup_address ?? '')
    setDeliveryAvailable(printer.delivery_available ?? false)
    setDeliveryFeeRm(String(printer.delivery_fee_rm ?? ''))
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
        pickup_address: pickupAddress.trim(),
        delivery_available: deliveryAvailable,
        delivery_fee_rm: deliveryAvailable && deliveryFeeRm ? parseFloat(deliveryFeeRm) : null,
      })
      if (result?.error) {
        setSaveError(result.error)
      } else {
        setEditing(false)
      }
    })
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
            <span className="block text-xs text-slate-400">Electricity rate</span>
            <span className="font-medium text-slate-900">RM{electricityRate}/kWh</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Markup</span>
            <span className="font-medium text-slate-900">{markupPercent}%</span>
          </div>
        </div>

        {/* Pickup & Delivery summary */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pickup & Delivery</p>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            {pickupAddress
              ? <span className="text-slate-700">{pickupAddress}</span>
              : <span className="text-slate-400 italic">No pickup address set</span>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-slate-400 shrink-0" />
            {deliveryAvailable
              ? <span className="text-slate-700">
                  Delivery available
                  {deliveryFeeRm ? ` · RM${parseFloat(deliveryFeeRm).toFixed(2)} fee` : ' · fee not set'}
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

        <div>
          <label className={labelClass}>Pickup address</label>
          <textarea
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            rows={2}
            placeholder="e.g. No. 12, Jalan Ampang, 50450 Kuala Lumpur"
            className={`${inputClass} resize-none`}
          />
          <p className="mt-1 text-xs text-slate-400">
            Shown to customers so they know where to collect their print.
          </p>
        </div>

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
            Customers can request delivery and you'll add the fee to their quote.
          </p>
        </div>

        {deliveryAvailable && (
          <div>
            <label className={labelClass}>Delivery fee (RM)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">RM</span>
              <input
                type="number"
                step="0.50"
                min="0"
                value={deliveryFeeRm}
                onChange={(e) => setDeliveryFeeRm(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} pl-10`}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Flat rate shown to customers before they submit. Added on top of the print quote.
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
