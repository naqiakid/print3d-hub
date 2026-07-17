import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Star, Clock, MapPin, Truck, Check, X,
  ChevronRight, Printer as PrinterIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, Filament, PrintProfile, CatalogItem, Review } from '@/lib/types'
import {
  PRINT_TYPE_LABELS,
  PRINT_TYPE_DESCRIPTIONS,
  MATERIAL_LABELS,
  MATERIAL_DESCRIPTIONS,
} from '@/lib/types'
import { PRINTER_MODELS } from '@/lib/printer-models'
import PrinterDeviceImage from '@/components/PrinterDeviceImage'
import { bedLabel } from '@/lib/equipment'
import CatalogGrid from '@/components/CatalogGrid'

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


export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('name, turnaround').eq('id', id).maybeSingle()
  
  if (!data) return { title: 'Maker Hub Profile' }
  
  return {
    title: `${data.name} | Local 3D Printing Service`,
    description: `Order custom 3D prints from ${data.name} locally. Active 3D printer hub offering fast ${data.turnaround} turnaround.`,
    openGraph: {
      title: `${data.name} | Local 3D Printing Service`,
      description: `Order custom 3D prints from ${data.name} locally. Active 3D printer hub offering fast ${data.turnaround} turnaround.`,
      type: 'website',
    }
  }
}

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const shop = data as unknown as Shop

  const { data: printerData } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', shop.id)
    .order('created_at', { ascending: true })
  const printers = (printerData ?? []) as unknown as Printer[]
  const printerIds = printers.map((p) => p.id)

  const [{ data: filamentData }, { data: profileData }, { data: catalogData }, { data: reviewData }] = await Promise.all([
    supabase
      .from('filaments')
      .select('*')
      .eq('owner_id', shop.id)
      .eq('in_stock', true)
      .order('material')
      .order('color'),
    printerIds.length
      ? supabase
          .from('print_profiles')
          .select('*')
          .in('printer_id', printerIds)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('catalog_items')
      .select('*')
      .eq('owner_id', shop.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('reviews')
      .select('*')
      .eq('owner_id', shop.id)
      .neq('comment', '')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const filaments = (filamentData ?? []) as unknown as Filament[]
  const profiles  = (profileData  ?? []) as unknown as PrintProfile[]
  const catalog   = (catalogData  ?? []) as unknown as CatalogItem[]
  const reviews   = (reviewData   ?? []) as unknown as Review[]

  // Hero visual takes its brand/image from the first (oldest) machine —
  // purely cosmetic; per-machine specs live in the Equipment section below.
  const heroPrinter = printers[0]
  const preset = heroPrinter ? findPreset(heroPrinter.printer_model) : undefined
  const brand = preset?.brand ?? heroPrinter?.printer_model.split(' ')[0]
  const [gradFrom, gradTo] = (brand && BRAND_GRADIENT[brand]) ?? DEFAULT_GRADIENT

  // Group filaments by material
  const filamentsByMaterial = filaments.reduce<Record<string, Filament[]>>((acc, f) => {
    if (!acc[f.material]) acc[f.material] = []
    acc[f.material].push(f)
    return acc
  }, {})

  // Unique nozzle sizes across every machine's profiles
  const nozzleSizes = [...new Set(profiles.map((p) => p.nozzle_mm))].sort()

  // Aggregate capabilities across all profiles
  const hasCap = (key: keyof PrintProfile) => profiles.some((p) => p[key] === true)

  // Union of bed types across all machines
  const bedTypes = [...new Set(printers.flatMap((p) => p.bed_type ?? []))]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Local Business Structured Data for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": shop.name,
            "image": shop.sample_photos?.[0] || preset?.image_url || '',
            "priceRange": shop.price_min === 0 && shop.price_max === 0 ? "Quote on request" : `RM${shop.price_min} - RM${shop.price_max}`,
            "address": {
              "@type": "PostalAddress",
              "streetAddress": shop.pickup_address || '',
              "addressCountry": "MY"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": shop.rating || 5,
              "reviewCount": shop.review_count || 1
            }
          })
        }}
      />
      <Link
        href="/printers"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      {/* ── Shop hero ── */}
      <div
        className="mb-6 overflow-hidden rounded-2xl shadow-lg"
        style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      >
        <div className="flex flex-col sm:flex-row gap-0">
          <div className="flex items-center justify-center sm:w-64 py-8 sm:py-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-hidden">
            <PrinterDeviceImage
              imageUrl={preset?.image_url}
              alt={heroPrinter?.printer_model ?? shop.name}
              className="h-44 w-full object-contain drop-shadow-xl"
              fallbackClassName="w-28 h-28 drop-shadow-lg"
            />
          </div>

          {/* Specs */}
          <div className="flex-1 p-7">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                {brand && <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">{brand}</p>}
                <h1 className="text-2xl font-bold text-white leading-tight">{shop.name}</h1>
                <p className="text-sm text-white/60 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>{printers.length} machine{printers.length !== 1 ? 's' : ''}</span>
                  {printers.length > 0 && (
                    <>
                      <span className="text-white/30">•</span>
                      <span className="text-white/80 font-medium">
                        {printers.map((p) => p.printer_model).join(', ')}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold mt-1 ${
                  shop.available ? 'bg-green-400/20 text-green-300 ring-1 ring-green-400/30' : 'bg-white/10 text-white/50'
                }`}
              >
                {shop.available ? 'Available' : 'Busy'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-white/40" />
                  <p className="text-xs text-white/40 uppercase tracking-wide">Turnaround</p>
                </div>
                <p className="text-sm font-semibold text-white">{shop.turnaround}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Star className="h-3.5 w-3.5 text-amber-400/70" />
                  <p className="text-xs text-white/40 uppercase tracking-wide">Rating</p>
                </div>
                <p className="text-sm font-semibold text-white">
                  {shop.rating} <span className="text-white/40 font-normal text-xs">({shop.review_count})</span>
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wide mb-0.5">Price range</p>
                <p className="text-lg font-bold text-white">
                  {shop.price_min === 0 && shop.price_max === 0
                    ? 'Quote on request'
                    : `RM${shop.price_min}–RM${shop.price_max}`}
                </p>
              </div>
              <div>
                {shop.available ? (
                  <Link
                    href={`/request/${shop.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 shadow-md shadow-orange-950/20 active:scale-[0.98]"
                  >
                    Request a Custom Print <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center justify-center rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white/40 cursor-not-allowed"
                  >
                    Currently Busy
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sample photos — visual proof up front, before specs */}
      {shop.sample_photos.length > 0 && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Sample Prints</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shop.sample_photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Sample ${i + 1}`} className="aspect-square w-full rounded-xl object-cover border border-slate-100" />
            ))}
          </div>
        </section>
      )}

      {/* Product catalog — ready-to-order items convert faster than a custom quote */}
      {catalog.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-1 text-xl font-bold text-slate-900">Available prints</h2>
          <p className="mb-6 text-sm text-slate-500">
            Ready-to-order designs from this maker — customise and order directly.
          </p>
          <CatalogGrid catalog={catalog} filaments={filaments} printerId={shop.id} />
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left — content */}
        <div className="space-y-6 lg:col-span-2">

          {/* Description */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">About</h2>
            <p className="leading-relaxed text-slate-700">{shop.description}</p>
          </section>

          {/* What I print */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">What I can print</h2>
            <div className="flex flex-wrap gap-3">
              {shop.print_types.map((type) => (
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

            {shop.materials.map((mat) => {
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

          {/* Equipment — the machines behind this shop, shown for trust/capacity */}
          {printers.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Equipment</h2>
              <div className="space-y-2">
                {printers.map((p) => {
                  const ps = findPreset(p.printer_model)
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100">
                        <PrinterIcon className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.printer_model}</p>
                        {ps?.build_volume && (
                          <p className="text-xs text-slate-400">{ps.build_volume} build volume</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

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
                        · {p.infill_basic}% infill
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bed types */}
          {bedTypes.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Print Bed</h2>
              <div className="flex flex-wrap gap-2">
                {bedTypes.map((b) => (
                  <span key={b} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {bedLabel(b)}
                  </span>
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
              {shop.price_min === 0 && shop.price_max === 0
                ? 'Quote on request'
                : `RM${shop.price_min}–RM${shop.price_max}`}
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {shop.price_min === 0 && shop.price_max === 0
                ? 'Upload your STL to get an instant estimate'
                : 'Price range per job'}
            </p>

            {shop.available ? (
              <Link
                href={`/request/${shop.id}`}
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
            {nozzleSizes.length > 0 && (
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-xs text-slate-500">Nozzle</span>
                <span className="ml-auto text-xs font-semibold text-slate-800">{nozzleSizes.map(n => `${n}mm`).join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500">Turnaround</span>
              <span className="ml-auto text-xs font-semibold text-slate-800">{shop.turnaround}</span>
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
          {(shop.pickup_address || shop.delivery_available) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Collection</h3>
              {shop.pickup_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700 text-xs leading-relaxed">{shop.pickup_address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                {shop.delivery_available
                  ? <span className="text-xs text-slate-700">
                      Delivery available · RM{(shop.delivery_rate_per_km ?? 1).toFixed(2)}/km
                    </span>
                  : <span className="text-xs text-slate-400">Pickup only</span>}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Reviews</h3>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-slate-900">{shop.rating}</span>
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i <= Math.round(shop.rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{shop.review_count} reviews</p>
              </div>
            </div>
            {shop.review_count === 0 && (
              <p className="mt-3 text-xs text-slate-400">Reviews appear after jobs are completed.</p>
            )}
            {reviews.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                {reviews.map((r) => (
                  <div key={r.id}>
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i <= r.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-600">&ldquo;{r.comment}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
