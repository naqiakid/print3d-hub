import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Star, Clock, Zap, Box, MapPin, Truck, Check, X,
  Layers, ChevronRight, Package,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer, Filament, PrintProfile, CatalogItem } from '@/lib/types'
import {
  PRINT_TYPE_LABELS,
  PRINT_TYPE_DESCRIPTIONS,
  MATERIAL_LABELS,
  MATERIAL_DESCRIPTIONS,
} from '@/lib/types'
import { PRINTER_MODELS } from '@/lib/printer-models'
import PrinterDeviceImage from '@/components/PrinterDeviceImage'
import { bedLabel } from '@/lib/equipment'

// Match a saved printer_model string to a preset
function findPreset(printerModel: string) {
  const norm = printerModel.toLowerCase()
  return PRINTER_MODELS.find(
    (p) =>
      `${p.brand} ${p.name}`.toLowerCase() === norm ||
      norm === p.name.toLowerCase() ||
      norm.includes(p.name.toLowerCase()),
  )
}

const BRAND_GRADIENT: Record<string, [string, string]> = {
  'Bambu Lab': ['#0f2e12', '#1a4d1d'],
  'Prusa':     ['#7a2d00', '#b84500'],
  'Creality':  ['#002060', '#003399'],
  'AnkerMake': ['#001a40', '#002d6b'],
  'Voron':     ['#2d0b50', '#4a1a80'],
}
const DEFAULT_GRADIENT: [string, string] = ['#0f172a', '#1e293b']


export default async function PrinterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.from('printers').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const printer = data as unknown as Printer

  const [{ data: filamentData }, { data: profileData }, { data: catalogData }] = await Promise.all([
    supabase
      .from('filaments')
      .select('*')
      .eq('owner_id', printer.owner_id)
      .eq('in_stock', true)
      .order('material')
      .order('color'),
    supabase
      .from('print_profiles')
      .select('*')
      .eq('printer_id', printer.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false }),
    supabase
      .from('catalog_items')
      .select('*')
      .eq('printer_id', printer.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  const filaments = (filamentData ?? []) as unknown as Filament[]
  const profiles  = (profileData  ?? []) as unknown as PrintProfile[]
  const catalog   = (catalogData  ?? []) as unknown as CatalogItem[]

  const preset = findPreset(printer.printer_model)
  const brand = preset?.brand ?? printer.printer_model.split(' ')[0]
  const [gradFrom, gradTo] = BRAND_GRADIENT[brand] ?? DEFAULT_GRADIENT

  // Group filaments by material
  const filamentsByMaterial = filaments.reduce<Record<string, Filament[]>>((acc, f) => {
    if (!acc[f.material]) acc[f.material] = []
    acc[f.material].push(f)
    return acc
  }, {})

  // Unique nozzle sizes across all profiles
  const nozzleSizes = [...new Set(profiles.map((p) => p.nozzle_mm))].sort()

  // Aggregate capabilities across all profiles
  const hasCap = (key: keyof PrintProfile) => profiles.some((p) => p[key] === true)

  const buildVolume = preset?.build_volume

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/printers"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      {/* ── Machine hero ── */}
      <div
        className="mb-6 overflow-hidden rounded-2xl shadow-lg"
        style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      >
        <div className="flex flex-col sm:flex-row gap-0">
          {/* Printer device image */}
          <div className="flex items-center justify-center sm:w-64 py-8 sm:py-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-hidden">
            <PrinterDeviceImage
              imageUrl={preset?.image_url}
              alt={printer.printer_model}
              className="h-44 w-full object-contain drop-shadow-xl"
              fallbackClassName="w-28 h-28 drop-shadow-lg"
            />
          </div>

          {/* Specs */}
          <div className="flex-1 p-7">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">{brand}</p>
                <h1 className="text-2xl font-bold text-white leading-tight">{printer.name}</h1>
                <p className="text-sm text-white/60 mt-0.5">{printer.printer_model}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold mt-1 ${
                  printer.available ? 'bg-green-400/20 text-green-300 ring-1 ring-green-400/30' : 'bg-white/10 text-white/50'
                }`}
              >
                {printer.available ? 'Available' : 'Busy'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {buildVolume && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Box className="h-3.5 w-3.5 text-white/40" />
                    <p className="text-xs text-white/40 uppercase tracking-wide">Build Volume</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{buildVolume}</p>
                </div>
              )}
              {preset?.power_watts && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="h-3.5 w-3.5 text-white/40" />
                    <p className="text-xs text-white/40 uppercase tracking-wide">Power Draw</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{preset.power_watts}W</p>
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-white/40" />
                  <p className="text-xs text-white/40 uppercase tracking-wide">Turnaround</p>
                </div>
                <p className="text-sm font-semibold text-white">{printer.turnaround}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Star className="h-3.5 w-3.5 text-amber-400/70" />
                  <p className="text-xs text-white/40 uppercase tracking-wide">Rating</p>
                </div>
                <p className="text-sm font-semibold text-white">
                  {printer.rating} <span className="text-white/40 font-normal text-xs">({printer.review_count})</span>
                </p>
              </div>
              {nozzleSizes.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Layers className="h-3.5 w-3.5 text-white/40" />
                    <p className="text-xs text-white/40 uppercase tracking-wide">Nozzle Sizes</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{nozzleSizes.map(n => `${n}mm`).join(', ')}</p>
                </div>
              )}
              {preset?.note && (
                <div className="col-span-2">
                  <p className="text-xs text-white/50 italic mt-1">{preset.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left — content */}
        <div className="space-y-6 lg:col-span-2">

          {/* Description */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">About</h2>
            <p className="leading-relaxed text-slate-700">{printer.description}</p>
          </section>

          {/* What I print */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">What I can print</h2>
            <div className="flex flex-wrap gap-3">
              {printer.print_types.map((type) => (
                <div key={type} className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-2.5">
                  <p className="text-sm font-semibold text-orange-800">{PRINT_TYPE_LABELS[type]}</p>
                  <p className="text-xs text-orange-600 mt-0.5">{PRINT_TYPE_DESCRIPTIONS[type]}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Materials & available colors */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Materials & Colors</h2>

            {printer.materials.map((mat) => {
              const colors = filamentsByMaterial[mat] ?? []
              return (
                <div key={mat} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{MATERIAL_LABELS[mat]}</span>
                    {colors.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {colors.length} color{colors.length !== 1 ? 's' : ''} in stock
                      </span>
                    )}
                  </div>
                  <p className="mb-2.5 text-xs text-slate-500">{MATERIAL_DESCRIPTIONS[mat]}</p>

                  {colors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {colors.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                          title={`${f.brand} — ${f.color}`}
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200 shadow-inner"
                            style={{ background: f.color_hex }}
                          />
                          {f.color}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-slate-400">Colors not listed — ask owner for options</p>
                  )}
                </div>
              )
            })}
          </section>

          {/* Print profiles & capabilities */}
          {profiles.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Print Profiles & Capabilities</h2>

              {/* Aggregate capabilities */}
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {([
                  { key: 'supports_available',        label: 'Support structures' },
                  { key: 'ironing_available',          label: 'Ironing (smooth top)' },
                  { key: 'color_change_available',     label: 'Color change' },
                  { key: 'pause_insert_available',     label: 'Embedded inserts' },
                  { key: 'fuzzy_skin_available',       label: 'Fuzzy skin' },
                  { key: 'text_on_surface_available',  label: 'Text on surface' },
                ] as { key: keyof PrintProfile; label: string }[]).map(({ key, label }) => {
                  const on = hasCap(key)
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                        on ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      {on
                        ? <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                        : <X className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                      {label}
                    </div>
                  )
                })}
              </div>

              {/* Individual profiles */}
              <div className="space-y-2">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-xl border px-4 py-3 ${p.is_default ? 'border-orange-200 bg-orange-50/50' : 'border-slate-100 bg-slate-50/50'}`}
                  >
                    <div className="flex items-center gap-2">
                      {p.is_default && (
                        <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400 shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                      <span className="text-xs text-slate-400">· {p.nozzle_mm}mm nozzle</span>
                      <span className="text-xs text-slate-400">
                        · Basic {p.infill_basic}% infill{p.advanced_available ? ` · Advanced ${p.infill_advanced}%` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bed types */}
          {printer.bed_type && printer.bed_type.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Print Bed</h2>
              <div className="flex flex-wrap gap-2">
                {printer.bed_type.map((b) => (
                  <span key={b} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {bedLabel(b)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Sample photos */}
          {printer.sample_photos.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Sample Prints</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {printer.sample_photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Sample ${i + 1}`} className="aspect-square w-full rounded-xl object-cover border border-slate-100" />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right — sidebar */}
        <div className="space-y-5">
          {/* CTA card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 text-2xl font-bold text-slate-900">
              {printer.price_min === 0 && printer.price_max === 0
                ? 'Quote on request'
                : `RM${printer.price_min}–RM${printer.price_max}`}
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {printer.price_min === 0 && printer.price_max === 0
                ? 'Upload your STL to get an instant estimate'
                : 'Price range per job'}
            </p>

            {printer.available ? (
              <Link
                href={`/request/${printer.id}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Request a Print <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                disabled
                className="w-full cursor-not-allowed rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
              >
                Currently Busy
              </button>
            )}

            <p className="mt-3 text-center text-xs text-slate-400">No account needed</p>
          </div>

          {/* Quick specs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Quick specs</h3>
            {buildVolume && (
              <div className="flex items-center gap-2 text-slate-700">
                <Box className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500">Build volume</span>
                <span className="ml-auto text-xs font-semibold text-slate-800">{buildVolume}</span>
              </div>
            )}
            {nozzleSizes.length > 0 && (
              <div className="flex items-center gap-2 text-slate-700">
                <Layers className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500">Nozzle</span>
                <span className="ml-auto text-xs font-semibold text-slate-800">{nozzleSizes.map(n => `${n}mm`).join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500">Turnaround</span>
              <span className="ml-auto text-xs font-semibold text-slate-800">{printer.turnaround}</span>
            </div>
            {filaments.length > 0 && (
              <div className="flex items-center gap-2 text-slate-700">
                <span className="h-4 w-4 text-slate-400 shrink-0 flex items-center justify-center text-[10px]">🎨</span>
                <span className="text-xs text-slate-500">Colors in stock</span>
                <span className="ml-auto text-xs font-semibold text-slate-800">{filaments.length}</span>
              </div>
            )}
          </div>

          {/* Pickup & delivery */}
          {(printer.pickup_address || printer.delivery_available) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Collection</h3>
              {printer.pickup_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700 text-xs leading-relaxed">{printer.pickup_address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                {printer.delivery_available
                  ? <span className="text-xs text-slate-700">
                      Delivery available · RM{(printer.delivery_rate_per_km ?? 1).toFixed(2)}/km
                    </span>
                  : <span className="text-xs text-slate-400">Pickup only</span>}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Reviews</h3>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-slate-900">{printer.rating}</span>
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i <= Math.round(printer.rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{printer.review_count} reviews</p>
              </div>
            </div>
            {printer.review_count === 0 && (
              <p className="mt-3 text-xs text-slate-400">Reviews appear after jobs are completed.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Product catalog ── */}
      {catalog.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-1 text-xl font-bold text-slate-900">Available prints</h2>
          <p className="mb-6 text-sm text-slate-500">
            Ready-to-order designs from this maker — customise and order directly.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((item) => {
              const badges: string[] = []
              if (item.allow_custom_text)    badges.push('Custom text')
              if (item.allow_color_choice)   badges.push('Color choice')
              if (item.allow_resize)         badges.push('Resize')
              if (item.allow_material_choice) badges.push('Material choice')

              return (
                <div key={item.id} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-orange-200 hover:shadow-md transition">
                  {/* Photo */}
                  <div className="h-44 w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                    {item.photo_url
                      ? <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                      : <Package className="h-12 w-12 text-slate-300" />}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-slate-900 leading-snug">{item.name}</p>
                      {item.base_price && (
                        <p className="shrink-0 text-sm font-bold text-orange-600">From RM{item.base_price.toFixed(2)}</p>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3">{item.description}</p>
                    )}
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {badges.map((b) => (
                          <span key={b} className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-600">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/order/${printer.id}/${item.id}`}
                      className="block w-full rounded-xl bg-orange-500 py-2 text-center text-sm font-semibold text-white hover:bg-orange-600 transition"
                    >
                      Order this
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
