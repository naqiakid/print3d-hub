'use client'

import { useState, useTransition } from 'react'
import type { FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS, MATERIAL_DESCRIPTIONS } from '@/lib/types'
import { updateRequest } from '@/lib/actions'
import { useRouter } from 'next/navigation'

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await updateRequest(requestId, {
        material,
        color,
        color_hex: colorHex,
        selected_addons: currentSelectedAddons,
        declined_addons: currentDeclinedAddons,
        notes: notes.trim() || undefined,
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

  // If neither material nor color can be changed on a catalog order, there's nothing to revise
  const canReviseAnything = allowMaterialChange || allowColorChange
  if (!canReviseAnything) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
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
          {/* Material — only shown when the catalog item (or non-catalog order) allows it */}
          {allowMaterialChange && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">Material</h3>
              <div className="space-y-2">
                {availableMaterials.map((mat) => (
                  <button key={mat} type="button" onClick={() => { setMaterial(mat); setColor('Any'); setColorHex('#888888') }}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${material === mat ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'}`}>
                    <p className={`text-sm font-medium ${material === mat ? 'text-orange-700' : 'text-slate-800'}`}>{MATERIAL_LABELS[mat]}</p>
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
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 transition">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
              {isPending ? 'Updating…' : 'Update request'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
