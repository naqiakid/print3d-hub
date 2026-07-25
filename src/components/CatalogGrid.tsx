'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package } from 'lucide-react'
import type { CatalogItem, Filament } from '@/lib/types'
import { cleanDescription, parseDesignerMetadata } from '@/lib/types'

function isInStock(item: CatalogItem, filaments: Filament[]): boolean {
  if (item.allow_material_choice) {
    if (!item.available_materials || item.available_materials.length === 0) return true
    return item.available_materials.some((m) => filaments.some((f) => f.material === m))
  }
  if (!item.material) return true

  // If customer can choose colors, we only need at least one filament of the required material in stock
  if (item.allow_color_choice) {
    return filaments.some((f) => f.material === item.material)
  }

  // If there are multiple default colors (pipe-separated)
  if (item.color_hex && item.color_hex.includes('|')) {
    const requiredColors = item.color_hex.split('|').filter(Boolean)
    return requiredColors.every((color) => 
      filaments.some((f) => f.material === item.material && f.color_hex === color)
    )
  }

  return filaments.some(
    (f) => f.material === item.material && (!item.color_hex || f.color_hex === item.color_hex),
  )
}

export default function CatalogGrid({
  catalog,
  filaments,
  printerId,
}: {
  catalog: CatalogItem[]
  filaments: Filament[]
  printerId: string
}) {
  const categories = [...new Set(catalog.map((i) => i.category).filter((c): c is string => !!c))].sort()
  const [active, setActive] = useState('All')

  const visible = active === 'All' ? catalog : catalog.filter((i) => (i.category ?? 'Uncategorized') === active)

  return (
    <div>
      {categories.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {['All', ...categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active === c
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => {
          const badges: string[] = []
          if (item.allow_custom_text)     badges.push('Custom text')
          if (item.allow_color_choice)    badges.push('Color choice')
          if (item.allow_resize)          badges.push('Resize')
          if (item.allow_material_choice) badges.push('Material choice')
          const inStock = isInStock(item, filaments)
          const designer = parseDesignerMetadata(item.description)

          return (
            <div
              key={item.id}
              className={`group rounded-2xl border overflow-hidden transition ${
                inStock
                  ? 'border-slate-200 bg-white hover:border-orange-200 hover:shadow-md'
                  : 'border-slate-100 bg-slate-50 opacity-70'
              }`}
            >
              {/* Photo */}
              <div className="relative h-44 w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                {(item.photo_urls?.[0] ?? item.photo_url) ? (
                  <img
                    src={(item.photo_urls?.[0] ?? item.photo_url) as string}
                    alt={item.name}
                    className={`h-full w-full object-cover transition duration-300 ${
                      inStock ? 'group-hover:scale-105' : 'grayscale'
                    }`}
                  />
                ) : (
                  <Package className="h-12 w-12 text-slate-300" />
                )}
                {item.category && (
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm">
                    {item.category}
                  </span>
                )}
                {!inStock && (
                  <span className="absolute right-2 top-2 rounded-full bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Out of stock
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 leading-snug">{item.name}</p>
                  {item.base_price && (
                    <p className="shrink-0 text-base font-bold text-orange-600">From RM{item.base_price.toFixed(2)}</p>
                  )}
                </div>
                {item.description && (
                  <p className="mb-3 text-xs text-slate-500 line-clamp-2">{cleanDescription(item.description)}</p>
                )}
                {badges.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {badges.map((b) => (
                      <span
                        key={b}
                        className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                {designer && (designer.name || designer.license) && (
                  <div className="mb-3 flex items-center justify-between text-[10px] border-t border-slate-100/80 pt-2 text-slate-400">
                    <span className="truncate max-w-[130px]">
                      {designer.name && (
                        <>
                          By{' '}
                          {designer.tipUrl ? (
                            <a
                              href={designer.tipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-orange-600 hover:underline"
                              title="Tip the designer"
                            >
                              {designer.name} ☕
                            </a>
                          ) : (
                            <span className="font-bold text-slate-600">{designer.name}</span>
                          )}
                        </>
                      )}
                    </span>
                    {designer.license && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
                          designer.commercialAllowed !== false
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/10 text-amber-700'
                        }`}
                        title={
                          designer.commercialAllowed !== false
                            ? 'Commercial printing allowed by creator'
                            : 'Non-Commercial license'
                        }
                      >
                        {designer.license.split(' ')[0]}
                      </span>
                    )}
                  </div>
                )}
                {inStock ? (
                  <Link
                    href={`/order/${printerId}/${item.id}`}
                    className="block w-full rounded-xl bg-orange-500 py-2 text-center text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Order this
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="block w-full cursor-not-allowed rounded-xl bg-slate-200 py-2 text-center text-sm font-semibold text-slate-400"
                  >
                    Currently unavailable
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
