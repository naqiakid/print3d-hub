'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { NOZZLE_SIZES, NOZZLE_HINTS, BED_TYPES, bedLabel } from '@/lib/equipment'
import { toggleNozzle, addNozzleSize, removeNozzleSize, updateBedTypes, updatePrinterCapabilities } from '@/lib/actions'
import type { PrintProfile } from '@/lib/types'

export default function EquipmentManager({
  profiles: initial,
  bedTypes: initialBedTypes,
  printerId,
}: {
  profiles: PrintProfile[]
  bedTypes: string[]
  printerId: string
}) {
  const [profiles, setProfiles] = useState(initial)
  const [bedTypes, setBedTypes] = useState(initialBedTypes)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Aggregate current capability state from all profiles
  const [caps, setCaps] = useState({
    supports_available:         initial.some((p) => p.supports_available),
    ironing_available:          initial.some((p) => p.ironing_available),
    color_change_available:     initial.some((p) => p.color_change_available),
    pause_insert_available:     initial.some((p) => p.pause_insert_available),
    fuzzy_skin_available:       initial.some((p) => p.fuzzy_skin_available),
    text_on_surface_available:  initial.some((p) => p.text_on_surface_available),
  })

  // ── Nozzle helpers ───────────────────────────────────────────

  function handleToggleNozzle(profileId: string, current: boolean) {
    const next = !current
    setProfiles((prev) => prev.map((p) => p.id === profileId ? { ...p, is_active: next } : p))
    startTransition(async () => {
      const res = await toggleNozzle(profileId, next)
      if (res?.error) setError(res.error)
    })
  }

  function handleAddNozzle(nozzleMm: number) {
    startTransition(async () => {
      const res = await addNozzleSize(printerId, nozzleMm)
      if (res?.error) { setError(res.error); return }
      // Optimistically add a placeholder — server revalidates the page data
      setProfiles((prev) => [
        ...prev,
        {
          id: `temp-${nozzleMm}`,
          printer_id: printerId,
          name: `${nozzleMm}mm nozzle`,
          nozzle_mm: nozzleMm,
          infill_draft: 15,
          infill_standard: 25,
          infill_premium: 40,
          supports_available: true,
          ironing_available: false,
          color_change_available: false,
          pause_insert_available: false,
          fuzzy_skin_available: false,
          text_on_surface_available: false,
          is_default: false,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ])
    })
  }

  function handleRemoveNozzle(profileId: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== profileId))
    startTransition(async () => {
      const res = await removeNozzleSize(profileId)
      if (res?.error) setError(res.error)
    })
  }

  // ── Bed type helpers ─────────────────────────────────────────

  function handleToggleBed(value: string) {
    const next = bedTypes.includes(value)
      ? bedTypes.filter((b) => b !== value)
      : [...bedTypes, value]
    setBedTypes(next)
    startTransition(async () => {
      const res = await updateBedTypes(printerId, next)
      if (res?.error) setError(res.error)
    })
  }

  // ── Capability helpers ───────────────────────────────────────

  function handleToggleCap(key: keyof typeof caps) {
    const next = { ...caps, [key]: !caps[key] }
    setCaps(next)
    startTransition(async () => {
      const res = await updatePrinterCapabilities(printerId, next)
      if (res?.error) setError(res.error)
    })
  }

  // ── Derived ──────────────────────────────────────────────────

  const usedNozzles = new Set(profiles.map((p) => p.nozzle_mm))
  const availableToAdd = NOZZLE_SIZES.filter((s) => !usedNozzles.has(s))

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {/* ── Nozzle sizes ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Nozzle sizes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Toggle a nozzle off if it's broken or unavailable. Remove it to delete permanently.
            Add a size when you get a new nozzle.
          </p>
        </div>

        <div className="space-y-2">
          {profiles.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
              <p className="text-sm text-slate-400">No nozzle sizes configured yet.</p>
            </div>
          )}

          {profiles
            .slice()
            .sort((a, b) => a.nozzle_mm - b.nozzle_mm)
            .map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                  p.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${p.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                    {p.nozzle_mm}mm
                  </span>
                  <span className={`text-xs ${p.is_active ? 'text-slate-400' : 'text-slate-300'}`}>
                    {NOZZLE_HINTS[p.nozzle_mm] ?? ''}
                  </span>
                  {!p.is_active && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                      Disabled
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleNozzle(p.id, p.is_active)}
                    disabled={isPending}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                      p.is_active ? 'bg-orange-500' : 'bg-slate-200'
                    }`}
                    title={p.is_active ? 'Disable nozzle' : 'Enable nozzle'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        p.is_active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => handleRemoveNozzle(p.id)}
                    disabled={isPending}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50"
                    title="Remove nozzle"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {availableToAdd.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-slate-400">Add a nozzle size:</p>
            <div className="flex flex-wrap gap-2">
              {availableToAdd.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleAddNozzle(size)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-500 hover:bg-orange-50 transition disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> {size}mm
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Bed surfaces ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Bed surfaces</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select all the build surfaces you have available. Tick to add, untick to remove.
          </p>
        </div>

        <div className="space-y-2">
          {BED_TYPES.map((bed) => {
            const active = bedTypes.includes(bed.value)
            return (
              <button
                key={bed.value}
                type="button"
                onClick={() => handleToggleBed(bed.value)}
                disabled={isPending}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${
                  active ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${active ? 'text-orange-700' : 'text-slate-800'}`}>
                    {bed.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{bed.desc}</p>
                </div>
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                  active ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
                }`}>
                  {active && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {bedTypes.length === 0 && (
          <p className="mt-2 text-xs text-amber-600">Select at least one bed surface.</p>
        )}

        {bedTypes.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Active: {bedTypes.map(bedLabel).join(' · ')}
          </p>
        )}
      </section>

      {/* ── Capabilities ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Capabilities</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tick the special print features your printer can do. These are shown to customers on your listing.
          </p>
        </div>

        {profiles.length === 0 ? (
          <p className="text-sm text-slate-400">Add a nozzle size first to enable capabilities.</p>
        ) : (
          <div className="space-y-2">
            {([
              { key: 'supports_available'        as const, label: 'Support structures', desc: 'Can print overhangs and bridges with supports' },
              { key: 'ironing_available'         as const, label: 'Ironing',            desc: 'Extra smooth top surface finish (+15% print time)' },
              { key: 'color_change_available'    as const, label: 'Multi-colour / AMS', desc: 'Swap filament mid-print — manual pause or AMS system' },
              { key: 'pause_insert_available'    as const, label: 'Embedded inserts',   desc: 'Pause to press-fit nuts, magnets, or other parts' },
              { key: 'fuzzy_skin_available'      as const, label: 'Fuzzy skin',         desc: 'Textured outer surface for a rough/fabric look' },
              { key: 'text_on_surface_available' as const, label: 'Text on surface',    desc: 'Emboss or engrave custom text onto the model surface via the slicer' },
            ] as const).map(({ key, label, desc }) => {
              const active = caps[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleToggleCap(key)}
                  disabled={isPending}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${
                    active ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${active ? 'text-orange-700' : 'text-slate-800'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                    active ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
                  }`}>
                    {active && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
