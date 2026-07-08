'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Trash2, Plus, X } from 'lucide-react'
import type { Printer, PrintProfile, FilamentMaterial } from '@/lib/types'
import { addPrinter, removePrinter } from '@/lib/actions'
import { PRINTER_MODELS } from '@/lib/printer-models'
import { NOZZLE_SIZES, BED_TYPES, bedLabel } from '@/lib/equipment'
import EquipmentManager from './EquipmentManager'

export default function PrinterList({
  printers: initialPrinters,
  profilesByPrinter,
}: {
  printers: Printer[]
  profilesByPrinter: Record<string, PrintProfile[]>
}) {
  const [printers, setPrinters] = useState(initialPrinters)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleRemove(id: string) {
    if (printers.length <= 1) return
    if (!confirm('Remove this printer? Its nozzle/bed settings will be deleted.')) return
    const previous = printers
    setPrinters((prev) => prev.filter((p) => p.id !== id))
    startTransition(async () => {
      const res = await removePrinter(id)
      if (res?.error) { setError(res.error); setPrinters(previous) }
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {printers.map((p) => {
        const isOpen = expanded === p.id
        return (
          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : p.id)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                <span className="text-sm font-semibold text-slate-900">{p.printer_model}</span>
              </button>
              {printers.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50"
                  title="Remove printer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-5">
                <EquipmentManager
                  profiles={profilesByPrinter[p.id] ?? []}
                  bedTypes={p.bed_type ?? []}
                  printerId={p.id}
                />
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <AddPrinterForm
          onDone={(printer) => { setPrinters((prev) => [...prev, printer]); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-500 hover:border-orange-300 hover:text-orange-600 transition"
        >
          <Plus className="h-4 w-4" /> Add another printer
        </button>
      )}
    </div>
  )
}

function AddPrinterForm({
  onDone,
  onCancel,
}: {
  onDone: (printer: Printer) => void
  onCancel: () => void
}) {
  const [modelId, setModelId] = useState('')
  const [nozzles, setNozzles] = useState<number[]>([0.4])
  const [beds, setBeds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const preset = PRINTER_MODELS.find((m) => m.id === modelId)

  function toggleNozzle(n: number) {
    setNozzles((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n])
  }
  function toggleBed(v: string) {
    setBeds((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }

  function handleSave() {
    if (!preset) { setError('Choose a printer model.'); return }
    if (nozzles.length === 0) { setError('Select at least one nozzle size.'); return }
    if (beds.length === 0) { setError('Select at least one bed surface.'); return }
    setError('')
    startTransition(async () => {
      const res = await addPrinter({
        printer_model: `${preset.brand} ${preset.name}`,
        printer_model_id: preset.id,
        materials: preset.materials as FilamentMaterial[],
        power_watts: preset.power_watts,
        machine_rate_per_hour: 1.5,
        nozzle_sizes: nozzles,
        bed_type: beds,
      })
      if ('error' in res) { setError(res.error); return }
      onDone({
        id: res.id,
        owner_id: '',
        printer_model: `${preset.brand} ${preset.name}`,
        printer_model_id: preset.id,
        materials: preset.materials as FilamentMaterial[],
        power_watts: preset.power_watts,
        machine_rate_per_hour: 1.5,
        filament_costs: null,
        grams_per_roll: null,
        bed_type: beds,
        available: true,
        created_at: new Date().toISOString(),
      })
    })
  }

  return (
    <div className="rounded-2xl border border-orange-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Add a printer</p>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-600">Printer model</label>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
        >
          <option value="">Choose a model…</option>
          {PRINTER_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.brand} {m.name}</option>
          ))}
        </select>
      </div>

      {preset && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Nozzle sizes</label>
            <div className="flex flex-wrap gap-2">
              {NOZZLE_SIZES.map((n) => (
                <button key={n} type="button" onClick={() => toggleNozzle(n)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    nozzles.includes(n) ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                  }`}>
                  {n}mm
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Bed surfaces</label>
            <div className="flex flex-wrap gap-2">
              {BED_TYPES.map((b) => (
                <button key={b.value} type="button" onClick={() => toggleBed(b.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    beds.includes(b.value) ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                  }`}>
                  {bedLabel(b.value)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 transition">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={isPending}
          className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
          {isPending ? 'Adding…' : 'Add printer'}
        </button>
      </div>
    </div>
  )
}
