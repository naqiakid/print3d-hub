'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { Printer } from '@/lib/types'
import { updateListing } from '@/lib/actions'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const labelClass = 'block text-xs text-slate-400 mb-1'

export default function ListingEditor({ printer }: { printer: Printer }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(printer.name)
  const [description, setDescription] = useState(printer.description)
  const [turnaround, setTurnaround] = useState(printer.turnaround)
  const [contactPhone, setContactPhone] = useState(printer.contact_phone)
  const [electricityRate, setElectricityRate] = useState(String(printer.electricity_rate ?? 0.516))
  const [markupPercent, setMarkupPercent] = useState(String(printer.markup_percent ?? 30))
  const [saveError, setSaveError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    setName(printer.name)
    setDescription(printer.description)
    setTurnaround(printer.turnaround)
    setContactPhone(printer.contact_phone)
    setElectricityRate(String(printer.electricity_rate ?? 0.516))
    setMarkupPercent(String(printer.markup_percent ?? 30))
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

      {saveError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</p>
      )}
    </div>
  )
}
