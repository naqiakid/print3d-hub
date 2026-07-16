'use client'

import { useState, lazy, Suspense } from 'react'
import Link from 'next/link'
import { Locate, MapPin, Package, Sliders, ShoppingBag } from 'lucide-react'
import type { CatalogItem } from '@/lib/types'
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
  const visible = activeCategory === 'All'
    ? enriched
    : enriched.filter(({ item }) => (item.category ?? 'Uncategorized') === activeCategory)

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
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
            <ModeIcon className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{heading}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {subheading}
              {geoStatus === 'granted' ? ' · sorted by distance' : ''}
            </p>
          </div>
        </div>

        {/* Near Me button */}
        <button
          onClick={requestLocation}
          disabled={geoStatus === 'loading' || geoStatus === 'granted'}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-default ${
            geoStatus === 'granted'
              ? 'border border-green-200 bg-green-50 text-green-700'
              : geoStatus === 'denied'
              ? 'border border-red-200 bg-red-50 text-red-600'
              : 'bg-orange-500 text-white shadow-sm hover:bg-orange-600'
          }`}
        >
          {geoStatus === 'loading' ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : geoStatus === 'granted' ? (
            <MapPin className="h-4 w-4" />
          ) : (
            <Locate className="h-4 w-4" />
          )}
          {geoStatus === 'loading'  ? 'Getting location…'
            : geoStatus === 'granted' ? 'Sorted by distance'
            : geoStatus === 'denied'  ? 'Location denied'
            : 'Near me'}
        </button>
      </div>

      {geoStatus === 'denied' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Location access was denied. Enable it in your browser settings and try again.
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activeCategory === c
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Map + List — same split layout as Browse Printers */}
      <div className="flex flex-col gap-6 lg:flex-row">

        {/* Scrollable product list */}
        <div className="order-2 lg:order-1 lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:max-h-[75vh] lg:pr-1">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-24 text-center">
              <Package className="mb-3 h-10 w-10 text-slate-200" />
              <p className="text-sm font-medium text-slate-500">No products listed yet.</p>
              <p className="mt-1 text-xs text-slate-400">Check back soon — makers are adding new designs.</p>
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
        <div className="order-1 lg:order-2 relative flex-1 h-[360px] lg:h-[75vh] lg:sticky lg:top-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Loading map…
              </div>
            }
          >
            <ProductMap items={items} userLat={userLat} userLng={userLng} />
          </Suspense>

          {geoStatus === 'idle' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <div className="rounded-xl bg-white/90 px-4 py-2 text-xs text-slate-600 shadow backdrop-blur-sm">
                Click <strong>Near me</strong> to find products closest to you
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-orange-200 hover:shadow-md"
    >
      {/* Photo */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <Package className="h-10 w-10 text-slate-300" />
        )}
        {/* Availability dot */}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            item.shop_available
              ? 'bg-green-500/90 text-white'
              : 'bg-slate-700/80 text-slate-200'
          }`}
        >
          {item.shop_available ? 'Available' : 'Busy'}
        </span>
        {item.category && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm">
            {item.category}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold text-slate-900 leading-snug group-hover:text-orange-600 transition">
          {item.name}
        </p>

        {/* Shop name + distance */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="truncate">{item.shop_name}</span>
          {distanceKm !== undefined && (
            <>
              <span>·</span>
              <span className="shrink-0 flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {fmtDist(distanceKm)}
              </span>
            </>
          )}
        </div>

        {item.description && (
          <p className="mt-2 flex-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Customisation badges */}
        {customBadges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {customBadges.map((b) => (
              <span
                key={b}
                className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600"
              >
                {b}
              </span>
            ))}
          </div>
        )}
        {mode === 'all' && isReadyMade && (
          <div className="mt-3">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Ready-made
            </span>
          </div>
        )}

        {/* Price */}
        {item.base_price != null && (
          <p className="mt-3 text-sm font-bold text-orange-600">
            {(mode === 'custom' || (mode === 'all' && !isReadyMade)) ? 'From ' : ''}RM{item.base_price.toFixed(2)}
          </p>
        )}
      </div>
    </Link>
  )
}
