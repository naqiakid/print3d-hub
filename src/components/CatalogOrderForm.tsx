'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CatalogItem, RequestPrinterView, PrintProfile, Filament, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS, MATERIAL_DESCRIPTIONS, parseAssemblyMetadata, cleanDescription } from '@/lib/types'
import { submitRequest } from '@/lib/actions'
import PhoneInput, { isValidMyPhoneDigits } from '@/components/PhoneInput'
import AddressInput from './AddressInput'
import ProductMediaGallery from '@/components/ProductMediaGallery'
import { ExternalLink } from 'lucide-react'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

const COLOR_PRESETS = [
  { name: 'Any / Owner decides', hex: '#888888' },
  { name: 'Black',   hex: '#1a1a1a' },
  { name: 'White',   hex: '#f5f5f5' },
  { name: 'Grey',    hex: '#6b7280' },
  { name: 'Natural', hex: '#d4b896' },
  { name: 'Red',     hex: '#dc2626' },
  { name: 'Blue',    hex: '#2563eb' },
  { name: 'Green',   hex: '#16a34a' },
  { name: 'Yellow',  hex: '#ca8a04' },
  { name: 'Orange',  hex: '#ea580c' },
  { name: 'Purple',  hex: '#7c3aed' },
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

  // Customisation state
  const [customText, setCustomText] = useState('')
  // For fixed-color items (allow_color_choice=false), use the owner's configured color instead of defaulting to "Any"
  const [color, setColor] = useState(item.allow_color_choice ? 'Any' : (item.color ?? 'Any'))
  const [colorHex, setColorHex] = useState(item.allow_color_choice ? '#888888' : (item.color_hex ?? '#888888'))

  const [partColors, setPartColors] = useState<string[]>(() => {
    const defaultVal = item.color ? item.color.split('|') : []
    const initialColors = [...defaultVal]
    while (initialColors.length < (item.stl_urls?.length ?? 0)) {
      initialColors.push('Any')
    }
    return initialColors
  })

  const [partColorHexes, setPartColorHexes] = useState<string[]>(() => {
    const defaultVal = item.color_hex ? item.color_hex.split('|') : []
    const initialHexes = [...defaultVal]
    while (initialHexes.length < (item.stl_urls?.length ?? 0)) {
      initialHexes.push('#888888')
    }
    return initialHexes
  })
  const [scalePct, setScalePct] = useState(100)
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

  // Order details
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [deadlineType, setDeadlineType] = useState<'asap' | 'anytime' | 'date'>('anytime')
  const [deadlineDate, setDeadlineDate] = useState('')

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
  const filamentsForMaterial = filaments.filter((f) => f.material === material)
  const filamentColors: { id: string; name: string; hex: string }[] = filamentsForMaterial.length > 0
    ? [
        { id: '__any__', name: 'Any / Owner decides', hex: '#888888' },
        ...filamentsForMaterial.map((f) => ({ id: f.id, name: f.color, hex: f.color_hex })),
      ]
    : COLOR_PRESETS.map((c, i) => ({ id: `preset-${i}`, name: c.name, hex: c.hex }))

  const canSubmit = !!(
    name.trim() &&
    email.trim() &&
    isValidMyPhoneDigits(phone.replace(/^\+?60/, '')) &&
    (!item.allow_custom_text || customText.trim()) &&
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
    if (item.stl_urls && item.stl_urls.length > 1) {
      parts.push('Part Colors:')
      item.stl_urls.forEach((url, i) => {
        const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${i + 1}`
        parts.push(`- ${filename}: ${partColors[i] || 'Any'}`)
      })
    }
    if (item.allow_custom_text && customText.trim())
      parts.push(`${item.text_prompt}: "${customText.trim()}"`)
    if (item.allow_resize && scalePct !== 100)
      parts.push(`Scale: ${scalePct}%`)
    if (quantity > 1)
      parts.push(`Quantity: ${quantity} copies`)
    if (notes.trim())
      parts.push(notes.trim())
    if (deadlineType === 'asap')
      parts.push('ASAP — rush order.')

    const selectedAddons: string[] = []
    if (item.allow_custom_text && customText.trim())
      selectedAddons.push('text_on_surface')

    const result = await submitRequest({
      owner_id:        printer.id,
      customer_name:   name.trim(),
      customer_email:  email.trim(),
      customer_phone:  phone.trim(),
      description:     `Catalog order: ${item.name}${item.description ? `\n\n${item.description}` : ''}`,
      print_type:      ['abs', 'nylon', 'pc'].includes(material) ? 'strong' : 'everyday',
      material,
      color:           item.stl_urls.length > 1 ? partColors.join('|') : color,
      color_hex:       item.stl_urls.length > 1 ? partColorHexes.join('|') : colorHex,
      supports:        false,
      size:            'medium',
      quality:         'basic',
      deadline,
      notes:           parts.join('\n') || 'No additional notes.',
      model_url:       item.model_url ?? null,
      model_title:     item.name,
      model_image:     item.photo_url ?? null,
      stl_url:         null,
      stl_urls:        [],
      weight_g:        null,
      print_hours:     null,
      profile_id:      profiles.find((p) => p.is_default)?.id ?? profiles[0]?.id ?? null,
      selected_addons: selectedAddons,
      declined_addons: [],
      fulfillment,
      delivery_address: fulfillment === 'delivery' ? deliveryAddress.trim() || null : null,
      catalog_item_id: item.id,
      quantity,
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
          colors={item.stl_urls.length > 1 ? partColorHexes : [colorHex]}
          assemblyOffsets={parseAssemblyMetadata(item.description)}
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

      {/* ── Customisations ────────────────────────────────────── */}

      {item.allow_custom_text && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            {item.text_prompt} <span className="text-red-500">*</span>
          </h3>
          <p className="mb-2 text-xs text-slate-400">This text will be engraved or embossed on the print.</p>
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
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
          {item.stl_urls.length <= 1 ? (
            <>
              <p className="mb-2 text-xs text-slate-400">Choose from what&apos;s in stock, or leave it to the owner.</p>
              <div className="flex flex-wrap gap-2">
                {filamentColors.map(({ id, name: n, hex }) => (
                  <button key={id} type="button"
                    onClick={() => { setColor(n === 'Any / Owner decides' ? 'Any' : n); setColorHex(hex) }}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      (n === 'Any / Owner decides' ? color === 'Any' : color === n)
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                    }`}>
                    {n !== 'Any / Owner decides' && (
                      <span className="h-3 w-3 rounded-full border border-slate-200 shrink-0" style={{ background: hex }} />
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
                  const filename = url.split('/').pop()?.replace(/^\d+-/, '') || `Part ${i + 1}`
                  const currentPartColor = partColors[i] || 'Any'
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
                                const newColors = [...partColors]
                                const newHexes = [...partColorHexes]
                                newColors[i] = (n === 'Any / Owner decides' ? 'Any' : n)
                                newHexes[i] = hex
                                setPartColors(newColors)
                                setPartColorHexes(newHexes)
                              }}
                              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                                selected
                                  ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
                              }`}>
                              {n !== 'Any / Owner decides' && (
                                <span className="h-1.5 w-1.5 rounded-full border border-slate-350 shrink-0" style={{ background: hex }} />
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
              <button key={mat} type="button" onClick={() => { setMaterial(mat); setColor('Any'); setColorHex('#888888') }}
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
