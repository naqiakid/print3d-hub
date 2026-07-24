'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CatalogItem, RequestPrinterView, PrintProfile, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS, MATERIAL_DESCRIPTIONS, parseAssemblyMetadata, parseMeshMapping, parseAllowedFilaments, parseTextMeshIndex, cleanDescription, isPreviewFile, COLOR_PRESETS, parseGcodeStats } from '@/lib/types'
import { calculateEstimate } from '@/lib/pricing'
import { submitRequest } from '@/lib/actions'
import PhoneInput, { isValidMyPhoneDigits } from '@/components/PhoneInput'
import AddressInput from './AddressInput'
import ProductMediaGallery from '@/components/ProductMediaGallery'
import { ExternalLink } from 'lucide-react'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const FINAL_COLOR_PRESETS = [
  { name: 'Any / Owner decides', hex: '#888888' },
  ...COLOR_PRESETS
]

export default function CatalogOrderForm({
  item,
  printer,
  profiles,
  filaments,
  shopName,
}: {
  item: CatalogItem
  printer: RequestPrinterView
  profiles: PrintProfile[]
  filaments: Filament[]
  shopName: string
}) {
  const router = useRouter()

  // Order details
  const [quantity, setQuantity] = useState(1)
  const [scalePct, setScalePct] = useState(100)
  const [notes, setNotes] = useState('')
  const [deadlineType, setDeadlineType] = useState<'asap' | 'anytime' | 'date'>('anytime')
  const [deadlineDate, setDeadlineDate] = useState('')

  const printableParts = item.stl_urls?.filter((url) => !isPreviewFile(url)) ?? []

  // UnitConfig interface for copy-by-copy customisation
  interface UnitConfig {
    customText: string
    color: string
    colorHex: string
    partColors: string[]
    partColorHexes: string[]
  }

  // Initialize units config array
  const [unitsConfig, setUnitsConfig] = useState<UnitConfig[]>([])
  const [activeUnitIdx, setActiveUnitIdx] = useState(0)

  useEffect(() => {
    setUnitsConfig((prev) => {
      const next = [...prev]
      while (next.length < quantity) {
        const defaultValColor = item.color ? item.color.split('|') : []
        const defaultValColorHex = item.color_hex ? item.color_hex.split('|') : []
        
        const initialPartColors = [...defaultValColor]
        while (initialPartColors.length < printableParts.length) {
          initialPartColors.push('Any')
        }
        const initialPartColorHexes = [...defaultValColorHex]
        while (initialPartColorHexes.length < printableParts.length) {
          initialPartColorHexes.push('#888888')
        }

        next.push({
          customText: '',
          color: item.allow_color_choice ? 'Any' : (item.color ?? 'Any'),
          colorHex: item.allow_color_choice ? '#888888' : (item.color_hex ?? '#888888'),
          partColors: initialPartColors.slice(0, printableParts.length),
          partColorHexes: initialPartColorHexes.slice(0, printableParts.length),
        })
      }
      if (next.length > quantity) {
        next.length = quantity
      }
      return next
    })
    setActiveUnitIdx((prev) => (prev >= quantity ? 0 : prev))
  }, [quantity, item, printableParts.length])

  // Backward-compatible compatibility getters mapping to active unit
  const customText = unitsConfig[activeUnitIdx]?.customText ?? ''
  const color = unitsConfig[activeUnitIdx]?.color ?? 'Any'
  const colorHex = unitsConfig[activeUnitIdx]?.colorHex ?? '#888888'
  const partColors = unitsConfig[activeUnitIdx]?.partColors ?? []
  const partColorHexes = unitsConfig[activeUnitIdx]?.partColorHexes ?? []

  const availableMaterials = (
    item.allow_material_choice && item.available_materials.length > 0
      ? item.available_materials
      : item.material
      ? [item.material]
      : printer.materials ?? []
  ) as FilamentMaterial[]
  const [material, setMaterial] = useState<FilamentMaterial>(
    availableMaterials[0] ?? 'pla',
  )

  // Contact
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Fulfillment
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  // Color options — prefer actual filament stock for the selected material, fall back to presets.
  // Keyed by filament id (not color name) since two different materials can share a color name.
  const allowedFilaments = parseAllowedFilaments(item.description)
  const filamentsForMaterial = filaments.filter((f) => {
    const matchesMaterial = f.material === material
    if (!matchesMaterial) return false
    if (allowedFilaments.length > 0) {
      return allowedFilaments.includes(f.id)
    }
    return true
  })
  const filamentColors: { id: string; name: string; hex: string }[] = filamentsForMaterial.length > 0
    ? [
        { id: '__any__', name: 'Any / Owner decides', hex: '#888888' },
        ...filamentsForMaterial.map((f) => ({ id: f.id, name: f.color, hex: f.color_hex })),
      ]
    : FINAL_COLOR_PRESETS.map((c, i) => ({ id: `preset-${i}`, name: c.name, hex: c.hex }))

  // Dynamic Pricing Engine calculations
  const gcodeStats = parseGcodeStats(item.description)
  const activeFilament = filaments.find((f) => f.material === material && f.in_stock)
  const costPerKg = activeFilament?.cost_per_kg ?? 55
  const scaleMultiplier = Math.pow(scalePct / 100, 3)

  let baseUnitPrice = 0
  let isAutoCalculated = false
  let calculatedBreakdown: any = null

  if (gcodeStats) {
    isAutoCalculated = true
    const currentWeight = gcodeStats.weight_g * scaleMultiplier
    const currentHours = gcodeStats.hours * (scalePct / 100)

    calculatedBreakdown = calculateEstimate({
      size: 'medium',
      quality: 'basic',
      material,
      power_watts: printer.power_watts ?? 350,
      cost_per_kg: costPerKg,
      machine_rate_per_hour: printer.machine_rate_per_hour ?? 1.5,
      known_weight_g: currentWeight,
      known_hours: currentHours,
      markup_percent: printer.markup_percent ?? 30,
      waste_percent: printer.waste_percent ?? 8,
    })
    baseUnitPrice = calculatedBreakdown.suggested_price
  } else {
    const baseMatPrice = (item.allow_material_choice && item.material_prices?.[material])
      ? Number(item.material_prices[material])
      : null
    const baseItemPrice = baseMatPrice !== null ? baseMatPrice : (item.base_price ?? 0)
    baseUnitPrice = baseItemPrice * scaleMultiplier
  }

  const orderTotalPrice = baseUnitPrice * quantity

  // Check filament stock capacity
  const selectedFilamentRoll = filamentsForMaterial.find((f) => f.color === color)
  const totalWeightRequired = gcodeStats ? gcodeStats.weight_g * scaleMultiplier * quantity : 0
  const remainingG = selectedFilamentRoll?.grams_remaining
  const isLowStock = remainingG !== null && remainingG !== undefined && remainingG < totalWeightRequired

  const canSubmit = !!(
    name.trim() &&
    email.trim() &&
    isValidMyPhoneDigits(phone.replace(/^\+?60/, '')) &&
    (!item.allow_custom_text || unitsConfig.every(uc => uc.customText.trim().length > 0)) &&
    (fulfillment !== 'delivery' || deliveryAddress.trim().length > 0)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setPending(true)
    setError('')

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const farFuture = new Date(); farFuture.setDate(farFuture.getDate() + 180)
    const deadline =
      deadlineType === 'asap' ? tomorrow.toISOString().split('T')[0] :
      deadlineType === 'date' ? deadlineDate || farFuture.toISOString().split('T')[0] :
      farFuture.toISOString().split('T')[0]

    // Build notes from customisations
    const parts: string[] = []
    if (quantity === 1) {
      const config = unitsConfig[0]
      if (config) {
        if (printableParts.length > 1) {
          parts.push('Part Colors:')
          printableParts.forEach((url, i) => {
            const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${i + 1}`
            parts.push(`- ${filename}: ${config.partColors[i] || 'Any'}`)
          })
        } else if (item.allow_color_choice) {
          parts.push(`Color: ${config.color}`)
        }
        if (item.allow_custom_text && config.customText.trim()) {
          parts.push(`${item.text_prompt}: "${config.customText.trim()}"`)
        }
      }
    } else {
      parts.push('Item Customisations (Multiple Copies):')
      unitsConfig.forEach((config, idx) => {
        parts.push(`\nCopy #${idx + 1}:`)
        if (printableParts.length > 1) {
          printableParts.forEach((url, i) => {
            const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${i + 1}`
            parts.push(`  - ${filename}: ${config.partColors[i] || 'Any'}`)
          })
        } else if (item.allow_color_choice) {
          parts.push(`  - Color: ${config.color}`)
        }
        if (item.allow_custom_text && config.customText.trim()) {
          parts.push(`  - ${item.text_prompt}: "${config.customText.trim()}"`)
        }
      })
    }
    if (item.allow_resize && scalePct !== 100)
      parts.push(`\nScale: ${scalePct}%`)
    if (quantity > 1)
      parts.push(`\nQuantity: ${quantity} copies`)
    if (notes.trim())
      parts.push(`\nCustomer Notes:\n${notes.trim()}`)
    if (deadlineType === 'asap')
      parts.push('\nASAP — rush order.')

    const selectedAddons: string[] = []
    if (item.allow_custom_text && unitsConfig.some(u => u.customText.trim()))
      selectedAddons.push('text_on_surface')

    const result = await submitRequest({
      owner_id:        printer.id,
      customer_name:   name.trim(),
      customer_email:  email.trim(),
      customer_phone:  phone.trim(),
      description:     `Catalog order: ${item.name}${item.description ? `\n\n${item.description}` : ''}`,
      print_type:      ['abs', 'nylon', 'pc'].includes(material) ? 'strong' : 'everyday',
      material,
      color:           printableParts.length > 1 ? partColors.join('|') : color,
      color_hex:       printableParts.length > 1 ? partColorHexes.join('|') : colorHex,
      supports:        false,
      size:            'medium',
      quality:         'basic',
      deadline,
      notes:           parts.join('\n') || 'No additional notes.',
      model_url:       item.model_url ?? null,
      model_title:     item.name,
      model_image:     item.photo_url ?? null,
      stl_url:         null,
      stl_urls:        printableParts,
      weight_g:        gcodeStats ? Math.round(gcodeStats.weight_g * scaleMultiplier * quantity * 10) / 10 : null,
      print_hours:     gcodeStats ? Math.round(gcodeStats.hours * (scalePct / 100) * quantity * 10) / 10 : null,
      profile_id:      profiles.find((p) => p.is_default)?.id ?? profiles[0]?.id ?? null,
      selected_addons: selectedAddons,
      declined_addons: [],
      fulfillment,
      delivery_address: fulfillment === 'delivery' ? deliveryAddress.trim() || null : null,
      catalog_item_id: item.id,
      quantity,
      scale_pct:       scalePct,
    })

    setPending(false)
    if ('error' in result) { setError(result.error); return }
    router.push(`/track/${result.id}`)
  }

  const customisationBadges: string[] = []
  if (item.allow_custom_text)    customisationBadges.push(item.text_prompt)
  if (item.allow_color_choice)   customisationBadges.push('Color choice')
  if (item.allow_resize)         customisationBadges.push(`${item.resize_min_pct}–${item.resize_max_pct}% resize`)
  if (item.allow_material_choice) customisationBadges.push('Material choice')

  return (
    <div className="space-y-6">
      {/* Product header */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Photo gallery / video / 3D viewer with LIVE custom color updates */}
        <ProductMediaGallery
          photoUrls={item.photo_urls?.length ? item.photo_urls : (item.photo_url ? [item.photo_url] : [])}
          videoUrl={item.video_url ?? null}
          stlUrls={item.stl_urls ?? []}
          name={item.name}
          colors={item.stl_urls.map((url) => {
            const idx = printableParts.indexOf(url)
            if (idx !== -1) return partColorHexes[idx]
            return '#ffffff' // preview file fallback color
          })}
          assemblyOffsets={parseAssemblyMetadata(item.description)}
          meshMapping={parseMeshMapping(item.description)}
          textMeshIndex={parseTextMeshIndex(item.description)}
          customText={customText}
          scale={scalePct / 100}
        />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{item.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{shopName}</p>
            </div>
            {item.base_price && (
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400">From</p>
                <p className="text-xl font-bold text-orange-600">RM {item.base_price.toFixed(2)}</p>
              </div>
            )}
          </div>

          {item.description && cleanDescription(item.description) && (
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{cleanDescription(item.description)}</p>
          )}

          {customisationBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {customisationBadges.map((badge) => (
                <span key={badge} className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-xs font-medium text-orange-600">
                  {badge}
                </span>
              ))}
            </div>
          )}

          {item.model_url && (
            <a
              href={item.model_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-orange-500 transition"
            >
              <ExternalLink className="h-3 w-3" /> View original design
            </a>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900 border-t border-slate-100 pt-6 mt-2">Customise your order</h2>

      <form onSubmit={handleSubmit} className="space-y-6">

      {/* Copy selector tabs for quantity > 1 (only show if customization is possible) */}
      {quantity > 1 && (item.allow_custom_text || item.allow_color_choice) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
          <p className="text-xs font-bold text-slate-700">🎨 Customize each copy separately:</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: quantity }).map((_, idx) => {
              const config = unitsConfig[idx]
              const hasName = config?.customText?.trim()
              const hasColor = !!(config && config.color !== 'Any')
              const label = hasName ? `Copy #${idx + 1} (${config.customText})` : `Copy #${idx + 1}`
              
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveUnitIdx(idx)}
                  className={`relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    activeUnitIdx === idx
                      ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                  }`}
                >
                  {hasColor && activeUnitIdx !== idx && config && (
                    <span className="h-2 w-2 rounded-full border border-slate-200 shrink-0" style={{ background: config.colorHex || '#888888' }} />
                  )}
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Select a copy tab above to customize its colors/text and see it in the 3D preview.</p>
        </div>
      )}

      {/* ── Customisations ────────────────────────────────────── */}

      {item.allow_custom_text && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            {item.text_prompt} <span className="text-red-500">*</span>
          </h3>
          <p className="mb-2 text-xs text-slate-400">This text will be engraved or embossed on the print.</p>
          <input
            value={customText}
            onChange={(e) => {
              const val = e.target.value
              setUnitsConfig((prev) => {
                const next = [...prev]
                if (next[activeUnitIdx]) next[activeUnitIdx].customText = val
                return next
              })
            }}
            placeholder={`e.g. "Ahmad", "ACME Corp", "Love"`}
            maxLength={40}
            className={inputClass}
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">{customText.length}/40</p>
        </div>
      )}

      {item.allow_color_choice && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Color</h3>
          {printableParts.length <= 1 ? (
            <>
              <p className="mb-2 text-xs text-slate-400">Choose from what&apos;s in stock, or leave it to the owner.</p>
              <div className="flex flex-wrap gap-2">
                {filamentColors.map(({ id, name: n, hex }) => (
                  <button key={id} type="button"
                    onClick={() => {
                      const selectedColorName = n === 'Any / Owner decides' ? 'Any' : n
                      setUnitsConfig((prev) => {
                        const next = [...prev]
                        if (next[activeUnitIdx]) {
                          next[activeUnitIdx].color = selectedColorName
                          next[activeUnitIdx].colorHex = hex
                          next[activeUnitIdx].partColors = [selectedColorName]
                          next[activeUnitIdx].partColorHexes = [hex]
                        }
                        return next
                      })
                    }}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      (n === 'Any / Owner decides' ? color === 'Any' : color === n)
                        ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/20 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-slate-50'
                    }`}>
                    {n !== 'Any / Owner decides' && (
                      <span className={`h-3 w-3 rounded-full border shrink-0 transition-transform ${
                        (n === 'Any / Owner decides' ? color === 'Any' : color === n)
                          ? 'border-orange-500 scale-110 shadow-sm'
                          : 'border-slate-350'
                      }`} style={{ background: hex }} />
                    )}
                    {n}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs text-slate-400">This product has multiple parts. Select colors for each part below:</p>
              <div className="space-y-3">
                {item.stl_urls.map((url, i) => {
                  if (isPreviewFile(url)) return null
                  const printableIndex = printableParts.indexOf(url)
                  const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${printableIndex + 1}`
                  const currentPartColor = partColors[printableIndex] || 'Any'
                  return (
                    <div key={url} className="space-y-1.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[65%]">{filename}</span>
                        {(() => {
                          const ownerParts = item.color ? item.color.split('|') : []
                          const ownerPartHex = item.color_hex ? item.color_hex.split('|') : []
                          const ownerDef = ownerParts[i]
                          if (ownerDef && ownerDef !== 'Any') {
                            return (
                              <span className="text-[10px] text-slate-400 italic flex items-center gap-1">
                                Default: <span className="h-1.5 w-1.5 rounded-full border border-slate-250 shrink-0" style={{ background: ownerPartHex[i] || '#888' }} /> {ownerDef}
                              </span>
                            )
                          }
                          return null
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {filamentColors.map(({ id, name: n, hex }) => {
                          const selected = (n === 'Any / Owner decides' ? currentPartColor === 'Any' : currentPartColor === n)
                          return (
                            <button key={id} type="button"
                              onClick={() => {
                                setUnitsConfig((prev) => {
                                  const next = [...prev]
                                  if (next[activeUnitIdx]) {
                                    const newColors = [...next[activeUnitIdx].partColors]
                                    const newHexes = [...next[activeUnitIdx].partColorHexes]
                                    newColors[printableIndex] = (n === 'Any / Owner decides' ? 'Any' : n)
                                    newHexes[printableIndex] = hex
                                    next[activeUnitIdx].partColors = newColors
                                    next[activeUnitIdx].partColorHexes = newHexes
                                  }
                                  return next
                                })
                              }}
                              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all duration-200 ${
                                selected
                                  ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500/20 font-semibold'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200 hover:bg-slate-50'
                              }`}>
                              {n !== 'Any / Owner decides' && (
                                <span className={`h-1.5 w-1.5 rounded-full border shrink-0 transition-transform ${
                                  selected ? 'border-orange-500 scale-110 shadow-sm' : 'border-slate-350'
                                }`} style={{ background: hex }} />
                              )}
                              {n === 'Any / Owner decides' ? 'Owner Decides' : n}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {item.allow_resize && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Size — {scalePct}% of original</h3>
          <p className="mb-3 text-xs text-slate-400">
            Drag to scale the print. 100% = original size as designed.
          </p>
          <input
            type="range"
            min={item.resize_min_pct}
            max={item.resize_max_pct}
            value={scalePct}
            onChange={(e) => setScalePct(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>{item.resize_min_pct}% (smaller)</span>
            <span className="font-medium text-orange-600">{scalePct}%</span>
            <span>{item.resize_max_pct}% (larger)</span>
          </div>
        </div>
      )}

      {item.allow_material_choice && availableMaterials.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Material</h3>
          <div className="space-y-2">
            {availableMaterials.map((mat) => (
              <button key={mat} type="button" onClick={() => {
                setMaterial(mat)
                setUnitsConfig((prev) => {
                  const next = [...prev]
                  if (next[activeUnitIdx]) {
                    next[activeUnitIdx].color = 'Any'
                    next[activeUnitIdx].colorHex = '#888888'
                    next[activeUnitIdx].partColors = next[activeUnitIdx].partColors.map(() => 'Any')
                    next[activeUnitIdx].partColorHexes = next[activeUnitIdx].partColorHexes.map(() => '#888888')
                  }
                  return next
                })
              }}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${material === mat ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'}`}>
                <p className={`text-sm font-medium ${material === mat ? 'text-orange-700' : 'text-slate-800'}`}>
                  {MATERIAL_LABELS[mat]}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{MATERIAL_DESCRIPTIONS[mat]}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Order details ─────────────────────────────────────── */}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Quantity</h3>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-orange-300 transition text-lg font-medium">−</button>
          <span className="text-lg font-semibold text-slate-900 min-w-[2ch] text-center">{quantity}</span>
          <button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-orange-300 transition text-lg font-medium">+</button>
        </div>
        {(item.allow_custom_text || item.allow_color_choice) && (
          <p className="text-[11px] text-orange-600 font-medium mt-1.5 flex items-center gap-1">
            ✨ Pro-tip: Order more than 1 copy to customize colors and engraving text for each copy separately!
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">When do you need it?</h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: 'asap' as const,    label: 'ASAP',    sub: 'Rush order' },
            { v: 'anytime' as const, label: 'Anytime', sub: 'No rush' },
            { v: 'date' as const,    label: 'By date',  sub: 'Pick a date' },
          ]).map(({ v, label, sub }) => (
            <button key={v} type="button" onClick={() => setDeadlineType(v)}
              className={`rounded-xl border px-3 py-2.5 text-center transition ${deadlineType === v ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-slate-400">{sub}</p>
            </button>
          ))}
        </div>
        {deadlineType === 'date' && (
          <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={`${inputClass} mt-2`} />
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Additional notes <span className="text-slate-400 font-normal">(optional)</span></h3>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Any other details for the owner…"
          rows={2} className={`${inputClass} resize-none`} />
      </div>

      {/* ── Contact ──────────────────────────────────────────── */}

      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Your contact details</h3>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Full name *" required className={inputClass} />
        <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address *" required className={inputClass} />
        <PhoneInput value={phone} onChange={setPhone} required />
      </div>

      {/* ── Fulfillment ──────────────────────────────────────── */}
      {(printer.pickup_address || printer.delivery_available) && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Collection</h3>
          <div className="grid grid-cols-2 gap-2">
            {printer.pickup_address && (
              <button type="button" onClick={() => setFulfillment('pickup')}
                className={`rounded-xl border px-3 py-2.5 text-center transition ${fulfillment === 'pickup' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
                <p className="text-sm font-medium">Pickup</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{printer.pickup_address}</p>
              </button>
            )}
            {printer.delivery_available && (
              <button type="button" onClick={() => setFulfillment('delivery')}
                className={`rounded-xl border px-3 py-2.5 text-center transition ${fulfillment === 'delivery' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'}`}>
                <p className="text-sm font-medium">Delivery</p>
                <p className="text-xs text-slate-400 mt-0.5">RM {printer.delivery_rate_per_km?.toFixed(2)}/km</p>
              </button>
            )}
          </div>
          {fulfillment === 'delivery' && (
            <div className="mt-2">
              <AddressInput
                value={deliveryAddress}
                onChange={setDeliveryAddress}
                onSelectCoords={() => {}}
                placeholder="Delivery address"
                required
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}

      {/* Live Pricing & Order Summary Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Order Summary Estimate</span>
          <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
            {isAutoCalculated ? '✨ Auto-priced (G-code)' : 'Live updates'}
          </span>
        </div>
        
        <div className="space-y-1.5 text-xs text-slate-600">
          {isAutoCalculated && calculatedBreakdown ? (
            <>
              <div className="flex justify-between">
                <span>Material weight ({gcodeStats ? Math.round(gcodeStats.weight_g * scaleMultiplier * quantity) : 0}g):</span>
                <span className="font-semibold text-slate-800">RM {calculatedBreakdown.filament_cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Print time ({gcodeStats ? (gcodeStats.hours * (scalePct / 100) * quantity).toFixed(1) : 0}h):</span>
                <span className="font-semibold text-slate-800">RM {calculatedBreakdown.machine_cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Electricity:</span>
                <span className="font-semibold text-slate-800">RM {calculatedBreakdown.electricity_cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Waste & markup ({printer.markup_percent ?? 30}%):</span>
                <span className="font-semibold text-slate-500">
                  RM {(calculatedBreakdown.waste_cost + calculatedBreakdown.suggested_price - calculatedBreakdown.base_cost).toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span>Base price ({MATERIAL_LABELS[material]}):</span>
                <span className="font-semibold text-slate-800">
                  RM {((item.allow_material_choice && item.material_prices?.[material]) ? Number(item.material_prices[material]) : (item.base_price ?? 0)).toFixed(2)}
                </span>
              </div>

              {item.allow_resize && scalePct !== 100 && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    Volumetric scale multiplier ({scalePct}%):
                    <span className="group relative cursor-help rounded-full bg-slate-100 px-1 text-[9px] text-slate-400 font-bold" title="Scaling a 3D model changes its volume exponentially (S³). 120% scale uses ~1.73x the print material.">?</span>
                  </span>
                  <span className="font-semibold text-slate-800">
                    x{Math.pow(scalePct / 100, 3).toFixed(2)}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between border-t border-slate-100 pt-1.5">
            <span>Quantity:</span>
            <span className="font-semibold text-slate-800">x {quantity} {quantity === 1 ? 'copy' : 'copies'}</span>
          </div>

          {fulfillment === 'delivery' && (
            <div className="flex justify-between">
              <span>Delivery:</span>
              <span className="text-slate-500 italic">Quoted by owner</span>
            </div>
          )}
        </div>

        {isLowStock && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wider text-amber-700">⚠️ Low Stock Alert</p>
            <p>
              The maker has only <strong>{remainingG}g</strong> of {color} filament in stock, but this configuration requires approx. <strong>{Math.round(totalWeightRequired)}g</strong>.
            </p>
            <p className="text-[10px] text-amber-600">
              You can still submit your order, but the maker may need to restock before printing.
            </p>
          </div>
        )}

        <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-bold text-slate-800">Estimated Subtotal:</span>
          <div className="text-right">
            <span className="text-xl font-extrabold text-orange-600 font-mono">
              RM {orderTotalPrice.toFixed(2)}
            </span>
            <p className="text-[9px] text-slate-400 mt-0.5">Excludes delivery fees where applicable</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={pending || !canSubmit}
        className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 transition">
        {pending ? 'Submitting…' : 'Place order'}
      </button>

      <p className="text-center text-xs text-slate-400">
        You&apos;ll receive a quote from the owner before anything is printed.
      </p>
    </form>
    </div>
  )
}
