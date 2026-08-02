'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Star, Clock, MapPin, Truck, Check, X,
  ChevronRight, Printer as PrinterIcon, Pencil, Eye,
  LayoutGrid, Calculator, Palette, Info
} from 'lucide-react'
import type { Shop, Printer, Filament, PrintProfile, CatalogItem, Review, RequestPrinterView } from '@/lib/types'
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
import MakerDistanceBadge from '@/components/MakerDistanceBadge'
import ShareShopButton from '@/components/ShareShopButton'
import PublicPriceCalculator from '@/components/PublicPriceCalculator'
import MarkdownDescription from '@/components/MarkdownDescription'

function SpoolVisualPublic({ hex, name }: { hex: string; name: string }) {
  const isLight = hex.toLowerCase() === '#ffffff' || hex.toLowerCase() === '#fff' || hex.toLowerCase() === '#f5f5f5'
  return (
    <div className="relative h-7 w-7 shrink-0 flex items-center justify-center">
      {/* concentric outer spool rings */}
      <svg className="absolute inset-0 h-full w-full -rotate-90">
        <circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="2"
        />
        <circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="2"
          strokeDasharray="69.1"
          strokeDashoffset="18"
          strokeLinecap="round"
          className="opacity-60"
        />
      </svg>
      {/* Center spool color core */}
      <span
        className={`h-4.5 w-4.5 rounded-full border border-slate-200 shadow-inner ${
          isLight ? 'shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]' : ''
        }`}
        style={{ background: hex }}
        title={name}
      />
    </div>
  )
}

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

export default function PrinterProfileView({
  shop,
  printers,
  filaments,
  profiles,
  catalog,
  reviews,
  requestPrinter,
  filamentsByMaterial,
  nozzleSizes,
  bedTypes,
  hasCap,
}: {
  shop: Shop
  printers: Printer[]
  filaments: Filament[]
  profiles: PrintProfile[]
  catalog: CatalogItem[]
  reviews: Review[]
  requestPrinter: RequestPrinterView
  filamentsByMaterial: Record<string, Filament[]>
  nozzleSizes: number[]
  bedTypes: string[]
  hasCap: (key: keyof PrintProfile) => boolean
}) {
  const [activeTab, setActiveTab] = useState<'storefront' | 'estimator' | 'materials' | 'about'>('storefront')

  const heroPrinter = printers[0]
  const preset = heroPrinter ? findPreset(heroPrinter.printer_model) : undefined
  const brand = preset?.brand ?? heroPrinter?.printer_model.split(' ')[0]
  const [gradFrom, gradTo] = (brand && BRAND_GRADIENT[brand]) ?? DEFAULT_GRADIENT

  const storefrontHasContent = catalog.length > 0 || shop.sample_photos?.length > 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 pb-24 lg:pb-12">
      <Link
        href="/printers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      {/* ── Shop hero banner ── */}
      <div
        className="mb-8 overflow-hidden rounded-3xl shadow-lg border border-slate-200/10"
        style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      >
        <div className="flex flex-col md:flex-row gap-0">
          <div className="flex items-center justify-center md:w-64 py-8 md:py-0 border-b md:border-b-0 md:border-r border-white/10 bg-black/10 backdrop-blur-sm overflow-hidden">
            <PrinterDeviceImage
              imageUrl={preset?.image_url}
              alt={heroPrinter?.printer_model ?? shop.name}
              className="h-40 w-full object-contain drop-shadow-2xl"
              fallbackClassName="w-24 h-24 drop-shadow-lg text-white/80"
            />
          </div>

          {/* Specs */}
          <div className="flex-1 p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  {brand && <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">{brand}</p>}
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{shop.name}</h1>
                  <p className="text-sm text-white/70 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-white/90">{printers.length} machine{printers.length !== 1 ? 's' : ''}</span>
                    {printers.length > 0 && (
                      <>
                        <span className="text-white/30">•</span>
                        <span className="text-white/80 text-xs font-medium">
                          {printers.map((p) => p.printer_model).join(', ')}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    shop.available
                      ? 'bg-emerald-400/25 text-emerald-300 ring-1 ring-emerald-400/30'
                      : 'bg-white/10 text-white/50 ring-1 ring-white/10'
                  }`}
                >
                  {shop.available ? 'Available' : 'Busy'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-5">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Clock className="h-3.5 w-3.5 text-white/40" />
                    <p className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">Turnaround</p>
                  </div>
                  <p className="text-sm font-bold text-white">{shop.turnaround || 'Flexible'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Star className="h-3.5 w-3.5 text-amber-400/80" />
                    <p className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">Rating</p>
                  </div>
                  <p className="text-sm font-bold text-white flex items-baseline gap-1">
                    {shop.rating > 0 ? shop.rating.toFixed(1) : '5.0'}
                    <span className="text-white/40 font-normal text-xs">({shop.review_count})</span>
                  </p>
                </div>
                {shop.lat != null && shop.lng != null && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-white/50 text-xs">📍</span>
                      <p className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">Distance</p>
                    </div>
                    <div className="pt-0.5">
                      <MakerDistanceBadge makerLat={shop.lat} makerLng={shop.lng} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div>
                <p className="text-[10px] text-white/40 uppercase font-semibold tracking-wider mb-0.5">Estimated range</p>
                <p className="text-xl font-black text-white">
                  {shop.price_min === 0 && shop.price_max === 0
                    ? 'Quote on request'
                    : `RM${shop.price_min.toFixed(2)} – RM${shop.price_max.toFixed(2)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ShareShopButton shopName={shop.name} />
                
                {shop.available ? (
                  <Link
                    href={`/request/${shop.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600 shadow-lg shadow-orange-950/20 active:scale-[0.97]"
                  >
                    Custom Request <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-6 py-3 text-sm font-bold text-white/40 cursor-not-allowed"
                  >
                    Currently Busy
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation & Sidebar Layout ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-start">
        
        {/* Main Content Area (Left Column on Desktop) */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Responsive Sticky/Scrollable Tab Menu */}
          <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-2 pb-px sticky top-0 bg-white z-10 select-none">
            {[
              { id: 'storefront', label: 'Storefront', icon: LayoutGrid, show: storefrontHasContent },
              { id: 'estimator', label: 'Price Estimator', icon: Calculator, show: shop.available },
              { id: 'materials', label: 'Materials & Colors', icon: Palette, show: shop.materials.length > 0 },
              { id: 'about', label: 'About & Hardware', icon: Info, show: true },
            ]
              .filter(t => t.show)
              .map((t) => {
                const Icon = t.icon
                const isActive = activeTab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-bold transition whitespace-nowrap -mb-px shrink-0 ${
                      isActive
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                )
              })}
          </div>

          {/* Tab Panes */}
          <div className="pt-2">
            
            {/* STOREFRONT TAB */}
            {activeTab === 'storefront' && (
              <div className="space-y-8">
                {/* Catalog Grid */}
                {catalog.length > 0 ? (
                  <div>
                    <h2 className="mb-1 text-lg font-extrabold text-slate-900 tracking-tight">Available Prints</h2>
                    <p className="mb-6 text-xs text-slate-500">
                      Ready-to-order designs from this maker — customize colors, parameters, and buy directly.
                    </p>
                    <CatalogGrid catalog={catalog} filaments={filaments} printerId={shop.id} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-250 p-8 text-center bg-slate-50/50">
                    <p className="text-sm font-medium text-slate-500">No ready-to-order catalog products listed yet.</p>
                  </div>
                )}

                {/* Sample Photos */}
                {shop.sample_photos.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Sample Prints Gallery</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {shop.sample_photos.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt={`Sample print ${i + 1}`}
                          className="aspect-square w-full rounded-xl object-cover border border-slate-100 hover:scale-[1.02] transition duration-200"
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ESTIMATOR TAB */}
            {activeTab === 'estimator' && shop.available && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-5">
                  <h3 className="text-sm font-extrabold text-orange-950 mb-1 flex items-center gap-1.5">
                    <span>💡</span> Instant Quote & Custom Orders
                  </h3>
                  <p className="text-xs text-orange-900 leading-relaxed">
                    Upload any 3D design file (.STL) below to get an instant cost calculation based on this owner's machine rates and chosen filaments. Add details to send a direct printing request.
                  </p>
                </div>
                <PublicPriceCalculator printer={requestPrinter} filaments={filaments} />
              </div>
            )}

            {/* MATERIALS TAB */}
            {activeTab === 'materials' && (
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">Supported Plastics & Spool Inventory</h3>

                  {shop.materials.map((mat) => {
                    const colors = filamentsByMaterial[mat] ?? []
                    return (
                      <div key={mat} className="mb-6 last:mb-0 border-b border-slate-100 pb-6 last:border-b-0 last:pb-0">
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <span className="text-base font-bold text-slate-800">{MATERIAL_LABELS[mat]}</span>
                          {colors.length > 0 && (
                            <span className="rounded-full bg-slate-100 border border-slate-200/50 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                              {colors.length} in stock
                            </span>
                          )}
                        </div>
                        <p className="mb-4 text-xs text-slate-500 leading-relaxed">{MATERIAL_DESCRIPTIONS[mat]}</p>

                        {colors.length > 0 ? (
                          <div className="flex flex-wrap gap-2.5">
                            {colors.map((f) => (
                              <div
                                key={f.id}
                                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/40 pl-2 pr-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:border-slate-350 hover:shadow"
                                title={`${f.brand || 'Generic'} — ${f.color}`}
                              >
                                <SpoolVisualPublic hex={f.color_hex} name={f.color} />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 leading-none">{f.color}</p>
                                  {f.brand && (
                                    <p className="text-[9px] text-slate-400 font-medium mt-1 leading-none">{f.brand}</p>
                                  )}
                                </div>
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
              </div>
            )}

            {/* ABOUT & HARDWARE TAB */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                
                {/* Biography */}
                {shop.description && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-3.5 text-xs font-bold uppercase tracking-widest text-slate-400">Biography / Printing Bio</h3>
                    <MarkdownDescription description={shop.description} className="text-slate-700 leading-relaxed" />
                  </section>
                )}

                {/* What I print capability labels */}
                {shop.print_types.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Preferred print jobs</h3>
                    <div className="flex flex-wrap gap-3">
                      {shop.print_types.map((type) => (
                        <div key={type} className="rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-3 max-w-[280px]">
                          <p className="text-sm font-bold text-orange-900">{PRINT_TYPE_LABELS[type]}</p>
                          <p className="text-xs text-orange-700 mt-1 leading-relaxed">{PRINT_TYPE_DESCRIPTIONS[type]}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Equipment (Machines) */}
                {printers.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Active Printer Hardware</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {printers.map((p) => {
                        const ps = findPreset(p.printer_model)
                        return (
                          <div key={p.id} className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-150 shadow-inner">
                              <PrinterIcon className="h-5 w-5 text-slate-450" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{p.printer_model}</p>
                              {ps?.build_volume ? (
                                <p className="text-xs text-slate-400 mt-0.5">{ps.build_volume} build volume</p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-0.5">Standard build plate</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Capabilities & profiles */}
                {profiles.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Print Profiles & Slicer Settings</h3>

                    {/* Aggregate checkmarks */}
                    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        { key: 'supports_available',        label: 'Support structures' },
                        { key: 'ironing_available',          label: 'Ironing (smooth top)' },
                        { key: 'color_change_available',     label: 'Color change' },
                        { key: 'pause_insert_available',     label: 'Embedded inserts' },
                        { key: 'fuzzy_skin_available',       label: 'Fuzzy skin' },
                        { key: 'text_on_surface_available',  label: 'Text on surface' },
                      ].map(({ key, label }) => {
                        const on = hasCap(key as any)
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                              on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            {on ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            ) : (
                              <X className="h-3.5 w-3.5 shrink-0 text-slate-350" />
                            )}
                            {label}
                          </div>
                        )
                      })}
                    </div>

                    {/* Profile cards */}
                    <div className="space-y-2">
                      {profiles.map((p) => (
                        <div
                          key={p.id}
                          className={`rounded-xl border px-4 py-3 text-xs font-semibold ${
                            p.is_default ? 'border-orange-200 bg-orange-50/30 text-orange-800' : 'border-slate-100 bg-slate-50/50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {p.is_default && (
                              <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400 shrink-0" />
                            )}
                            <p className="font-bold text-slate-800">{p.name}</p>
                            <span className="text-slate-400">· {p.nozzle_mm}mm nozzle</span>
                            <span className="text-slate-400">· {p.infill_basic}% infill</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Slicing Beds */}
                {bedTypes.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Print Bed Surfaces</h3>
                    <div className="flex flex-wrap gap-2">
                      {bedTypes.map((b) => (
                        <span key={b} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                          {bedLabel(b)}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Reviews */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Customer Reviews</h3>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-extrabold text-slate-900">{shop.rating > 0 ? shop.rating.toFixed(1) : '5.0'}</span>
                    <div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-4.5 w-4.5 ${
                              i <= Math.round(shop.rating || 5)
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-slate-200 text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 font-medium">{shop.review_count} verified reviews</p>
                    </div>
                  </div>
                  {shop.review_count === 0 && (
                    <p className="mt-4 text-xs text-slate-400/80 italic">Reviews appear after orders are successfully completed.</p>
                  )}
                  {reviews.length > 0 && (
                    <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                      {reviews.map((r) => (
                        <div key={r.id} className="text-xs">
                          <div className="flex gap-0.5 mb-1.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${i <= r.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
                              />
                            ))}
                          </div>
                          <p className="text-slate-655 font-medium leading-relaxed">&ldquo;{r.comment}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>

        {/* Sidebar Panel (Visible on Desktop, hidden or rearranged on mobile) */}
        <div className="space-y-6 lg:sticky lg:top-24 hidden lg:block">
          
          {/* Quick Calculator / Request CTA box */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-1 text-2xl font-black text-slate-900">
              {shop.price_min === 0 && shop.price_max === 0
                ? 'Quote on request'
                : `RM${shop.price_min.toFixed(2)}–RM${shop.price_max.toFixed(2)}`}
            </div>
            <p className="mb-5 text-xs text-slate-500">
              {shop.price_min === 0 && shop.price_max === 0
                ? 'Upload STL to get estimate instantly'
                : 'Standard price range per order'}
            </p>

            {shop.available ? (
              <div className="space-y-2">
                <Link
                  href={`/request/${shop.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-[0.98] shadow-sm"
                >
                  Request a Print <ChevronRight className="h-4 w-4" />
                </Link>
                {activeTab !== 'estimator' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('estimator')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition active:scale-[0.98]"
                  >
                    <Calculator className="h-4 w-4" /> Go to Price Calculator
                  </button>
                )}
              </div>
            ) : (
              <button
                disabled
                className="w-full cursor-not-allowed rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-400"
              >
                Currently Busy
              </button>
            )}

            <p className="mt-3.5 text-center text-[10px] font-semibold text-slate-400">No account required</p>
          </div>

          {/* Quick Stats list */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Quick Specs</h3>
            
            {nozzleSizes.length > 0 && (
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-450 font-bold uppercase tracking-wide text-[10px]">Nozzle size</span>
                <span className="text-slate-800">{nozzleSizes.map(n => `${n}mm`).join(', ')}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-450 font-bold uppercase tracking-wide text-[10px]">Turnaround</span>
              <span className="text-slate-800">{shop.turnaround || 'Flexible'}</span>
            </div>
            
            {filaments.length > 0 && (
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-450 font-bold uppercase tracking-wide text-[10px]">Stock colors</span>
                <span className="text-slate-800">{filaments.length} in stock</span>
              </div>
            )}
            
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-450 font-bold uppercase tracking-wide text-[10px]">Rating</span>
              <span className="text-slate-850 flex items-center gap-1">
                ⭐ {shop.rating > 0 ? shop.rating.toFixed(1) : '5.0'}
                <span className="text-slate-400 font-normal">({shop.review_count})</span>
              </span>
            </div>
          </div>

          {/* Pickup & delivery details */}
          {(shop.pickup_address || shop.delivery_available) && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Collection Details</h3>
              {shop.pickup_address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4.5 w-4.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700 text-xs leading-relaxed">{shop.pickup_address}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <Truck className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                {shop.delivery_available ? (
                  <span className="text-slate-750">
                    Delivery available (RM{(shop.delivery_rate_per_km ?? 1).toFixed(2)}/km)
                  </span>
                ) : (
                  <span className="text-slate-400">Pickup only</span>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ── Sticky Bottom CTA Bar on Mobile ── */}
      {shop.available && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">Akid's Printer</p>
            <p className="text-sm font-black text-slate-900 leading-none">
              {shop.price_min === 0 && shop.price_max === 0
                ? 'Quote on request'
                : `From RM${shop.price_min.toFixed(2)}`}
            </p>
          </div>
          <div className="flex gap-2">
            {activeTab !== 'estimator' && (
              <button
                type="button"
                onClick={() => setActiveTab('estimator')}
                className="inline-flex items-center justify-center p-3.5 rounded-xl border border-slate-250 bg-slate-50 text-slate-700 hover:bg-slate-100 transition active:scale-95"
                title="Calculator"
              >
                <Calculator className="h-4.5 w-4.5" />
              </button>
            )}
            <Link
              href={`/request/${shop.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-5 py-3 text-xs font-bold text-white transition hover:bg-orange-600 active:scale-95 shadow"
            >
              Order Print <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}
