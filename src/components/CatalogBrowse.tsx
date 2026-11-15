'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package, Sliders, ShoppingBag, Search } from 'lucide-react'
import { cleanDescription, getExcerpt, type CatalogItem } from '@/lib/types'

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function CatalogBrowse({ items, mode }: Props) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Category filter list
  const categories = [
    'All',
    ...[...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort(),
  ]

  const visible = (activeCategory === 'All'
    ? items
    : items.filter((item) => (item.category ?? 'Uncategorized') === activeCategory)
  ).filter((item) => {
    const term = searchQuery.trim().toLowerCase()
    if (!term) return true
    return (
      item.name.toLowerCase().includes(term) ||
      (item.description ?? '').toLowerCase().includes(term)
    )
  })

  const heading = mode === 'custom'
    ? 'Customisable 3D Products'
    : mode === 'ready'
    ? 'Ready-to-Buy Catalog'
    : 'Shop Catalog'
  const subheading = mode === 'custom'
    ? `${items.length} product${items.length !== 1 ? 's' : ''} available to personalize and print`
    : mode === 'ready'
    ? `${items.length} product${items.length !== 1 ? 's' : ''} ready to order as-is`
    : `${items.length} product${items.length !== 1 ? 's' : ''} crafted in-house`
  const ModeIcon = mode === 'ready' ? ShoppingBag : Sliders

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-orange-400 shadow-inner">
            <ModeIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{heading}</h1>
            <p className="mt-0.5 text-sm text-neutral-400">
              {subheading}
            </p>
          </div>
        </div>

        {/* Counter pill */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="rounded-full border border-neutral-800 bg-neutral-900/80 px-3.5 py-1.5 text-xs font-medium text-neutral-300">
            Showing <strong className="text-white font-semibold">{visible.length}</strong> of {items.length}
          </span>
        </div>
      </div>

      {/* Category filter & Search Bar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-neutral-900/60 border border-neutral-800 p-2.5 rounded-2xl backdrop-blur-sm">
        {categories.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition ${
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

      {/* Full-width Product Grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center rounded-2xl border border-neutral-800/60 bg-neutral-900/30">
          <Package className="mb-3 h-10 w-10 text-neutral-600" />
          <p className="text-sm font-medium text-neutral-300">No products found.</p>
          <p className="mt-1 text-xs text-neutral-500">
            {searchQuery ? 'Try adjusting your search terms.' : 'Check back soon — new CAD designs are on the way.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              mode={mode}
            />
          ))}
        </div>
      )}
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
  distanceKm?: number
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
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-neutral-950 flex items-center justify-center">
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

        {/* Shop name + Status Pulsing Indicator */}
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
