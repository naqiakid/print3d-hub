'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package } from 'lucide-react'
import type { CatalogItem, Filament } from '@/lib/types'
import { cleanDescription, getExcerpt, parseDesignerMetadata } from '@/lib/types'

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
  const approvedCatalog = catalog.filter((item) => {
    const designer = parseDesignerMetadata(item.description)
    const isUnverified = (designer?.license ?? '').includes('License Unverified') || (designer?.license ?? '').includes('Check Manually')
    const commercialAllowed = designer?.commercialAllowed ?? true
    
    let permissionStatus = item.permission_status || designer?.permissionStatus
    if (!permissionStatus) {
      if (!commercialAllowed || isUnverified) {
        permissionStatus = 'pending_permission'
      } else {
        permissionStatus = 'not_required'
      }
    }
    return permissionStatus === 'approved' || permissionStatus === 'not_required'
  })

  const categories = [...new Set(approvedCatalog.map((i) => i.category).filter((c): c is string => !!c))].sort()
  const [active, setActive] = useState('All')

  const visible = active === 'All' ? approvedCatalog : approvedCatalog.filter((i) => (i.category ?? 'Uncategorized') === active)

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

          const isUnverified = (designer?.license ?? '').includes('License Unverified') || (designer?.license ?? '').includes('Check Manually')
          const commercialAllowed = designer?.commercialAllowed ?? true
          
          let permissionStatus = item.permission_status || designer?.permissionStatus
          if (!permissionStatus) {
            if (!commercialAllowed || isUnverified) {
              permissionStatus = 'pending_permission'
            } else {
              permissionStatus = 'not_required'
            }
          }

          const isUnapproved = permissionStatus === 'pending_permission' || permissionStatus === 'denied'

          return (
            <div
              key={item.id}
              className={`group flex flex-col h-full rounded-2xl border overflow-hidden transition ${
                inStock
                  ? 'border-slate-200 bg-white hover:border-orange-200 hover:shadow-md'
                  : 'border-slate-100 bg-slate-50 opacity-70'
              }`}
            >
              {/* Photo */}
              <div className="relative h-44 w-full shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
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
                {isUnapproved ? (
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow-sm ${
                    permissionStatus === 'pending_permission' ? 'bg-amber-600/90' : 'bg-red-600/90'
                  }`}>
                    {permissionStatus === 'pending_permission' ? '⚠️ Pending' : '❌ Denied'}
                  </span>
                ) : !inStock ? (
                  <span className="absolute right-2 top-2 rounded-full bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Out of stock
                  </span>
                ) : null}
              </div>

              {/* Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 leading-snug mb-1.5 line-clamp-1">{item.name}</p>
                  {item.description && (
                    <p className="mb-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">{getExcerpt(item.description, 95)}</p>
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

                  {/* Stock Colors preview swatches */}
                  {item.allow_color_choice && (() => {
                    const inStockFilaments = filaments.filter((f) => f.in_stock)
                    const uniqueColors = Array.from(new Map(inStockFilaments.map((f) => [f.color_hex.toLowerCase(), f])).values()).slice(0, 6)
                    if (uniqueColors.length === 0) return null
                    return (
                      <div className="mb-3 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colors:</span>
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {uniqueColors.map((f) => (
                            <span
                              key={f.id}
                              className="inline-block h-3.5 w-3.5 rounded-full border border-white shadow-sm ring-1 ring-slate-200/40"
                              style={{ backgroundColor: f.color_hex }}
                              title={`${f.color} (${f.material.toUpperCase()})`}
                            />
                          ))}
                        </div>
                        {inStockFilaments.length > 6 && (
                          <span className="text-[10px] text-slate-400 font-semibold ml-1">
                            +{inStockFilaments.length - 6} more
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div className="mt-4">
                  {designer && (designer.name || designer.license) && (
                    <div className="mb-3 flex items-center justify-between text-[10px] border-t border-slate-100 pt-2 text-slate-400">
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
                              <span className="font-bold text-slate-605">{designer.name}</span>
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
                  
                  {item.base_price && (
                    <div className="mb-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-xs text-slate-400 font-medium">Starting price</span>
                      <span className="text-base font-extrabold text-orange-600">From RM{item.base_price.toFixed(2)}</span>
                    </div>
                  )}

                  {permissionStatus === 'pending_permission' ? (
                    <button
                      type="button"
                      disabled
                      className="block w-full cursor-not-allowed rounded-xl bg-amber-500/10 border border-amber-200 py-2 text-center text-sm font-semibold text-amber-700"
                    >
                      ⚠️ Pending Creator Permission
                    </button>
                  ) : permissionStatus === 'denied' ? (
                    <button
                      type="button"
                      disabled
                      className="block w-full cursor-not-allowed rounded-xl bg-red-500/10 border border-red-200 py-2 text-center text-sm font-semibold text-red-700"
                    >
                      ❌ Permission Denied
                    </button>
                  ) : inStock ? (
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
