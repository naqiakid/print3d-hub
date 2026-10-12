'use client'

import { useState, lazy, Suspense } from 'react'
import Link from 'next/link'
import { Locate, MapPin, Package, Sliders, ShoppingBag, Search } from 'lucide-react'
import { cleanDescription, getExcerpt, type CatalogItem } from '@/lib/types'
import { haversineKm, fmtDist } from '@/lib/geo'

const ProductMap = lazy(() => import('./ProductMap'))

export type CatalogItemWithShop = CatalogItem & {
  shop_name: string
  shop_lat: number | null
  shop_lng: number | null
  shop_available: boolean
}

type Props = {
  items: CatalogItemWithShop[]
  mode: 'custom' | 'ready' | 'all'
}

type GeoStatus = 'idle' | 'loading' | 'granted' | 'denied'

// ── Component ─────────────────────────────────────────────────────────────────

export default function CatalogBrowse({ items, mode }: Props) {
  const [userLat, setUserLat]     = useState<number | null>(null)
  const [userLng, setUserLng]     = useState<number | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  function requestLocation() {
    if (!navigator.geolocation) { setGeoStatus('denied'); return }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setGeoStatus('granted')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  // Compute distances
  type Enriched = { item: CatalogItemWithShop; distanceKm: number | undefined }
  const enriched: Enriched[] = items.map((item) => ({
    item,
    distanceKm:
      userLat != null && userLng != null && item.shop_lat && item.shop_lng
        ? haversineKm(userLat, userLng, item.shop_lat, item.shop_lng)
        : undefined,
  }))

  // Sort: closest first (items without distance sink to the bottom)
  enriched.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0
    if (a.distanceKm == null) return 1
    if (b.distanceKm == null) return -1
    return a.distanceKm - b.distanceKm
  })

  // Category filter
  const categories = [
    'All',
    ...[...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort(),
  ]
  const visible = (activeCategory === 'All'
    ? enriched
    : enriched.filter(({ item }) => (item.category ?? 'Uncategorized') === activeCategory)
  ).filter(({ item }) => {
    const term = searchQuery.trim().toLowerCase()
    if (!term) return true
    return (
      item.name.toLowerCase().includes(term) ||
      (item.description ?? '').toLowerCase().includes(term)
    )
  })

  const heading = mode === 'custom'
    ? 'Browse customisable products'
    : mode === 'ready'
    ? 'Browse ready-made products'
    : 'Browse all products'
  const subheading = mode === 'custom'
    ? `${items.length} product${items.length !== 1 ? 's' : ''} you can personalise`
    : mode === 'ready'
    ? `${items.length} product${items.length !== 1 ? 's' : ''} ready to order as-is`
    : `${items.length} product${items.length !== 1 ? 's' : ''} from local makers`
  const ModeIcon = mode === 'ready' ? ShoppingBag : Sliders

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-orange-400 shadow-inner">
            <ModeIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{heading}</h1>
            <p className="mt-0.5 text-sm text-neutral-400">
              {subheading}
              {geoStatus === 'granted' ? ' · sorted by proximity' : ''}
            </p>
          </div>
        </div>

        {/* Near Me button */}
        <button
          onClick={requestLocation}
          disabled={geoStatus === 'loading' || geoStatus === 'granted'}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wide uppercase transition disabled:cursor-default ${
            geoStatus === 'granted'
              ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
              : geoStatus === 'denied'
              ? 'border border-rose-500/40 bg-rose-950/40 text-rose-300'
              : 'border border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-neutral-500 hover:bg-neutral-800 shadow-sm'
          }`}
        >
          {geoStatus === 'loading' ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : geoStatus === 'granted' ? (
            <MapPin className="h-4 w-4" />
          ) : (
            <Locate className="h-4 w-4" />
          )}
          {geoStatus === 'loading'  ? 'Detecting Location…'
            : geoStatus === 'granted' ? 'Sorted by Proximity'
            : geoStatus === 'denied'  ? 'Location Denied'
            : 'Near Me'}
        </button>
      </div>

      {geoStatus === 'denied' && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-xs text-amber-300">
          Location access was denied. Enable it in your browser settings to sort by local proximity.
        </div>
      )}

      {/* Category filter & Search Bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-neutral-900/60 border border-neutral-800 p-2.5 rounded-2xl backdrop-blur-sm">
        {categories.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                  activeCategory === c
                    ? 'border-white bg-white text-neutral-950 shadow-sm'
                    : 'border-neutral-800 bg-neutral-950/80 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-semibold text-neutral-500 pl-1.5">All Categories</div>
        )}

        {/* Search Bar Input */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search catalog models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 pl-9 pr-4 py-2 text-xs font-medium text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-600 transition"
          />
        </div>
      </div>

      {/* Map + List — same split layout as Browse Printers */}
      <div className="flex flex-col gap-6 lg:flex-row">

        {/* Scrollable product list */}
        <div className="order-2 lg:order-1 lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:max-h-[75vh] lg:pr-1">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-24 text-center rounded-2xl border border-neutral-800/60 bg-neutral-900/30">
              <Package className="mb-3 h-10 w-10 text-neutral-600" />
              <p className="text-sm font-medium text-neutral-300">No products listed yet.</p>
              <p className="mt-1 text-xs text-neutral-500">Check back soon — our studio is uploading new CAD designs.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {visible.map(({ item, distanceKm }) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  distanceKm={distanceKm}
                  mode={mode}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sticky map */}
        <div className="order-1 lg:order-2 relative flex-1 h-[360px] lg:h-[75vh] lg:sticky lg:top-20 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                Loading studio map…
              </div>
            }
          >
            <ProductMap items={items} userLat={userLat} userLng={userLng} />
          </Suspense>

          {geoStatus === 'idle' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <div className="rounded-xl border border-neutral-700 bg-neutral-900/90 px-4 py-2 text-xs text-neutral-300 shadow-xl backdrop-blur-md">
                Click <strong className="text-white">Near me</strong> to calculate delivery proximity
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────

export function ProductCard({
  item,
  distanceKm,
  mode,
}: {
  item: CatalogItemWithShop
  distanceKm: number | undefined
  mode: 'custom' | 'ready' | 'all'
}) {
  const coverPhoto = item.photo_urls?.[0] ?? item.photo_url ?? null

  const customBadges: string[] = []
  if (mode === 'custom' || mode === 'all') {
    if (item.allow_custom_text)     customBadges.push(item.text_prompt || 'Custom text')
    if (item.allow_color_choice)    customBadges.push('Color choice')
    if (item.allow_resize)          customBadges.push(`${item.resize_min_pct}–${item.resize_max_pct}% resize`)
    if (item.allow_material_choice) customBadges.push('Material choice')
  }

  const isReadyMade = !item.allow_custom_text && !item.allow_color_choice && !item.allow_resize && !item.allow_material_choice

  return (
    <Link
      href={`/order/${item.owner_id}/${item.id}`}
      className="group flex flex-col h-full overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/60 transition hover:border-neutral-700 hover:bg-neutral-900 shadow-sm hover:shadow-lg"
    >
      {/* Photo */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-neutral-950 flex items-center justify-center">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105 opacity-90 group-hover:opacity-100"
          />
        ) : (
          <Package className="h-10 w-10 text-neutral-700" />
        )}
        {item.category && (
          <span className="absolute left-2.5 top-2.5 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-neutral-300 backdrop-blur-md uppercase tracking-wider">
            {item.category}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold text-neutral-100 text-sm leading-snug group-hover:text-white transition">
          {item.name}
        </p>

        {/* Shop name + distance + Status Pulsing Indicator */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-neutral-400">
          <span className="truncate text-neutral-300 font-medium">{item.shop_name}</span>
          <span>·</span>
          {item.shop_available ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              In stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
              Queue busy
            </span>
          )}
          {distanceKm !== undefined && (
            <>
              <span>·</span>
              <span className="shrink-0 flex items-center gap-0.5 text-neutral-400">
                <MapPin className="h-3 w-3" />
                {fmtDist(distanceKm)}
              </span>
            </>
          )}
        </div>

        {item.description && (
          <p className="mt-2 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
            {getExcerpt(item.description, 95)}
          </p>
        )}

        {/* Customisation badges */}
        {customBadges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {customBadges.map((b) => (
              <span
                key={b}
                className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-mono text-neutral-300"
              >
                {b}
              </span>
            ))}
          </div>
        )}
        {mode === 'all' && isReadyMade && (
          <div className="mt-3">
            <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
              Ready-made
            </span>
          </div>
        )}

        {/* Price - aligned to bottom */}
        {item.base_price != null && (
          <p className="mt-auto pt-3 text-sm font-mono font-bold text-neutral-100 flex items-baseline gap-1">
            {(mode === 'custom' || (mode === 'all' && !isReadyMade)) && (
              <span className="text-[11px] font-sans font-normal text-neutral-400">From</span>
            )}
            <span className="text-white">RM {item.base_price.toFixed(2)}</span>
          </p>
        )}
      </div>
    </Link>
  )
}
