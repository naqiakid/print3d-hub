import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Upload,
  ShoppingBag,
  Printer,
  Package,
  ShieldCheck,
  Zap,
  Layers,
  Sparkles,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sliders,
  Check
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer as PrinterType, Filament, RequestPrinterView } from '@/lib/types'
import { fetchCatalogBrowseItems } from '@/lib/catalog-browse'
import { ProductCard } from '@/components/CatalogBrowse'
import PublicPriceCalculatorWrapper from '@/components/configurator/PriceConfiguratorWrapper'
import { STUDIO_CONFIG } from '@/config/studio'
import { getStudioFilamentsAsFilaments } from '@/config/materials'
import { Dice3MFLogoIcon, Dice3MFFlatIcon } from '@/components/layout/Dice3MFLogo'

const fallbackPrinter: RequestPrinterView = {
  id: 'qid-primary',
  name: STUDIO_CONFIG.name,
  description: `${STUDIO_CONFIG.tagline} based in ${STUDIO_CONFIG.city}, ${STUDIO_CONFIG.state}.`,
  whatsapp: STUDIO_CONFIG.whatsappNumber,
  print_types: ['everyday', 'strong'],
  materials: ['pla', 'petg', 'tpu'],
  max_size: 'large',
  price_min: 15,
  price_max: 200,
  turnaround: '24-48 Hours',
  sample_photos: [],
  lat: 3.1499,
  lng: 101.7617,
  available: true,
  rating: 5.0,
  review_count: 12,
  pickup_address: STUDIO_CONFIG.pickupAddress,
  delivery_available: true,
  delivery_rate_per_km: STUDIO_CONFIG.shipping.runner.ratePerKm,
  electricity_rate: 0.57,
  markup_percent: 30,
  waste_percent: 8,
  advanced_available: true,
  created_at: new Date().toISOString(),
  printer_model: `${STUDIO_CONFIG.printer.brand} ${STUDIO_CONFIG.printer.model}`,
  printer_model_id: 'creality-ender3-v3-se',
  filament_costs: { pla: 55, petg: 65, tpu: 85 },
  power_watts: STUDIO_CONFIG.printer.powerWatts,
  machine_rate_per_hour: 1.5,
  bed_type: ['textured_pei'],
  grams_per_roll: 1000,
}

const fallbackFilaments: Filament[] = getStudioFilamentsAsFilaments('qid-primary')

export default async function HomePage() {
  const supabase = await createClient()

  // 1. Fetch Primary Studio Shop & Printer details
  const { data: shopData } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const shop = (shopData as unknown as Shop) || null
  let primaryPrinter: PrinterType | null = null
  let filaments: Filament[] = fallbackFilaments

  if (shop) {
    const [{ data: printerRows }, { data: filamentsData }] = await Promise.all([
      supabase.from('printers').select('*').eq('owner_id', shop.id).limit(1),
      supabase.from('filaments').select('*').eq('owner_id', shop.id).eq('in_stock', true),
    ])

    if (printerRows && printerRows.length > 0) {
      primaryPrinter = printerRows[0] as unknown as PrinterType
    }
    if (filamentsData && filamentsData.length > 0) {
      filaments = filamentsData as unknown as Filament[]
    }
  }

  const requestPrinter: RequestPrinterView = (shop && primaryPrinter)
    ? {
        ...shop,
        printer_model: primaryPrinter.printer_model,
        printer_model_id: primaryPrinter.printer_model_id,
        filament_costs: primaryPrinter.filament_costs,
        power_watts: primaryPrinter.power_watts,
        machine_rate_per_hour: primaryPrinter.machine_rate_per_hour,
        bed_type: primaryPrinter.bed_type,
        grams_per_roll: primaryPrinter.grams_per_roll,
      }
    : fallbackPrinter

  // 2. Fetch Catalog Items for Ready-to-Buy Section
  const trendingProducts = await fetchCatalogBrowseItems('all')
    .then((items) => items.slice(0, 3))
    .catch(() => [])

  return (
    <div className="flex flex-col bg-neutral-950 text-neutral-100">

      {/* ── 1. Hero Banner (Full-Bleed Edge-to-Edge Panoramic Showcase) ── */}
      <section className="relative w-full overflow-hidden border-b border-neutral-900 bg-neutral-950">
        {/* Full-Bleed 100% Width Panoramic Hero Banner Covering Entire Screen Width */}
        <div className="relative w-full overflow-hidden bg-neutral-950">
          <div className="relative w-full aspect-[944/278] sm:aspect-[1920/565] max-h-[75vh]">
            <Image
              src="/brand/hero-banner-wide.jpg"
              alt="Welcome to 3MF Studio - Creative Design & Innovation"
              fill
              priority
              className="object-cover object-center w-full h-full"
            />
          </div>
          {/* Subtle bottom edge gradient seamlessly transitioning into content */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-950 to-transparent pointer-events-none" />
        </div>

        {/* Quick Action Bar & Studio Credentials across broad max-w-7xl */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Studio Location & Machine Chips */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs text-neutral-400">
              <span className="rounded-xl bg-neutral-900/90 border border-neutral-800 px-3.5 py-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ampang Studio · Queue Open</span>
              </span>
              <span className="rounded-xl bg-neutral-900/90 border border-neutral-800 px-3.5 py-2 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-orange-400" />
                <span>Rapid Prototyping (24–48h)</span>
              </span>
              <span className="rounded-xl bg-neutral-900/90 border border-neutral-800 px-3.5 py-2 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-neutral-300" />
                <span>PLA · PETG · TPU · Carbon</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <a
                href="#quote"
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3 text-xs font-bold uppercase tracking-wider text-black shadow-lg transition hover:bg-neutral-200 active:scale-98"
              >
                <Upload className="h-4 w-4" />
                <span>Instant Slicing Quote</span>
              </a>
              <Link
                href="/browse/products"
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-7 py-3 text-xs font-bold uppercase tracking-wider text-neutral-200 transition hover:border-neutral-700 hover:text-white active:scale-98"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Shop Designs</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. Instant Price Estimator & 3D WebGL Canvas Section ── */}
      <section id="quote" className="py-24 bg-neutral-950 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-orange-400" /> Precision CAD Slicing &amp; Quote Engine
            </div>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl tracking-tight uppercase">
              Upload Your 3D File for Instant Estimate
            </h2>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto">
              Drop your STL, 3MF, or OBJ model. Inspect geometry in real-time 3D, configure infill density &amp; filament materials, and place your order into our fabrication queue.
            </p>
          </div>

          {/* Interactive Calculator Container */}
          <div className="rounded-3xl border border-neutral-850 bg-neutral-900/50 p-4 sm:p-8 shadow-2xl backdrop-blur-md">
            <PublicPriceCalculatorWrapper printer={requestPrinter} filaments={filaments} />
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-neutral-500">
              Need custom CAD drafting, specialized engineering polymers, or bulk manufacturing?{' '}
              <a
                href="mailto:3mfstudio@gmail.com?subject=3MF%20Studio%20Custom%20Print%20Inquiry"
                className="font-medium text-neutral-300 hover:text-white underline underline-offset-4 transition"
              >
                Inquire directly with our engineering team at 3mfstudio@gmail.com →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Machine & Materials Showcase ── */}
      <section id="materials" className="py-24 bg-neutral-950 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
              Technical Specifications
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl uppercase mt-1">
              Machine Capabilities &amp; Supported Filaments
            </h2>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
              Our Creality Ender-3 V3 SE setups are tuned for high layer bonding, clean overhangs, and dimensional accuracy.
            </p>
          </div>

          {/* Machine Banner */}
          <div className="mb-14 rounded-3xl border border-neutral-800 bg-neutral-900/70 p-8 sm:p-10 text-white shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              <div className="md:col-span-2 space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-neutral-300 border border-neutral-700">
                  <Printer className="h-3.5 w-3.5 text-orange-400" /> Primary Studio Machine
                </div>
                <h3 className="text-2xl font-black tracking-wide uppercase">Creality Ender-3 V3 SE</h3>
                <p className="text-sm text-neutral-300 leading-relaxed max-w-xl">
                  Equipped with a Sprite dual-gear direct drive extruder, dual Z-axis leadscrews, and CR Touch automated leveling. Engineered to fabricate both rigid structural enclosures and elastomeric TPU flexible seals that bowden setups fail to extrude.
                </p>
                <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium text-neutral-400">
                  <span>📐 <strong>Build Volume:</strong> 220 × 220 × 250 mm</span>
                  <span>⚙️ <strong>Nozzle:</strong> 0.4 mm Hardened Brass</span>
                  <span>⚡ <strong>Speed:</strong> Up to 250 mm/s</span>
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6 text-center space-y-2 shadow-inner">
                <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Standard Tolerance</p>
                <p className="text-4xl font-black text-white">±0.2 mm</p>
                <p className="text-[11px] text-neutral-400">Predictable clearances for snap-fits, M3/M4 fasteners &amp; threads</p>
              </div>
            </div>
          </div>

          {/* 3 Material Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* PLA */}
            <div className="rounded-3xl border border-neutral-850 bg-neutral-900/60 p-8 space-y-5 hover:border-neutral-700 transition duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800 text-white font-black text-sm border border-neutral-700">
                PLA
              </div>
              <div>
                <h4 className="text-lg font-bold text-white uppercase tracking-wider">PLA (Polylactic Acid)</h4>
                <p className="text-xs text-neutral-400 leading-relaxed mt-1">
                  Ideal for aesthetic surface finish, miniatures, cosplay accessories, and rapid visual validation.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-neutral-300 pt-3 border-t border-neutral-800">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Crisp surface detail &amp; rich color range
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Eco-friendly corn-starch derivative
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Best for architectural models &amp; figures
                </li>
              </ul>
            </div>

            {/* PETG */}
            <div className="rounded-3xl border border-neutral-850 bg-neutral-900/60 p-8 space-y-5 hover:border-neutral-700 transition duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800 text-white font-black text-sm border border-neutral-700">
                PETG
              </div>
              <div>
                <h4 className="text-lg font-bold text-white uppercase tracking-wider">PETG (Engineering Tough)</h4>
                <p className="text-xs text-neutral-400 leading-relaxed mt-1">
                  Combines high layer strength with impact resistance, chemical durability, and heat deflection up to 75°C.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-neutral-300 pt-3 border-t border-neutral-800">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> UV &amp; weather resistant for outdoors
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Withstands automotive cabin temperatures
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Best for drone mounts &amp; functional brackets
                </li>
              </ul>
            </div>

            {/* TPU */}
            <div className="rounded-3xl border border-neutral-850 bg-neutral-900/60 p-8 space-y-5 hover:border-neutral-700 transition duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800 text-white font-black text-sm border border-neutral-700">
                TPU
              </div>
              <div>
                <h4 className="text-lg font-bold text-white uppercase tracking-wider">TPU (Flexible Rubber 95A)</h4>
                <p className="text-xs text-neutral-400 leading-relaxed mt-1">
                  Elastomeric thermoplastic with rubber-like bend, high tear resistance, and shock absorption.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-neutral-300 pt-3 border-t border-neutral-800">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Flexes and rebounds without cracking
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Sprite direct extruder guarantees consistent feed
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> Best for phone cases, gaskets &amp; dampeners
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. Ready-to-Buy Catalog Section ── */}
      <section className="py-24 bg-neutral-950 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400 mb-2">
                <span>Pre-Calibrated Catalog</span>
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight uppercase">
                Ready-to-Print Shop Collection
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Pre-tested 3D figures and utility models ready to order with custom material &amp; color selection.
              </p>
            </div>
            <Link
              href="/browse/products"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:text-white transition"
            >
              Browse Full Catalog <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {trendingProducts.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center bg-neutral-900/40 border border-neutral-850 rounded-3xl p-8">
              <Package className="h-12 w-12 text-neutral-600 mb-3" />
              <h3 className="text-base font-bold text-neutral-200 uppercase tracking-wide">Catalog Collection Updating</h3>
              <p className="text-neutral-500 text-xs mt-1 max-w-sm">
                Have an STL or 3MF model ready? Drop your file into our instant quote engine to start printing immediately.
              </p>
              <a href="#quote" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:bg-neutral-200 transition">
                <Upload className="h-3.5 w-3.5" /> Upload 3D File
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trendingProducts.map((item) => (
                <ProductCard key={item.id} item={item} distanceKm={undefined} mode="custom" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. How Ordering Works (01, 02, 03 - Dark Mode Button Styling) ── */}
      <section className="bg-neutral-950 py-24 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
              Fabrication Workflow
            </span>
            <h2 className="mb-3 text-3xl font-extrabold text-white tracking-tight sm:text-4xl uppercase mt-1">
              How Ordering Works
            </h2>
            <p className="mx-auto max-w-md text-sm text-neutral-400">
              Three seamless steps from CAD file to physical delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Upload or Choose Model',
                desc: 'Upload your own STL/3MF/OBJ file or select from our pre-calibrated catalog with your desired filament material and infill.',
              },
              {
                step: '02',
                title: 'Precision Slicing & Print',
                desc: 'We inspect geometry, orientation, and layer adhesion before printing on our calibrated Ender-3 V3 SE workhorses.',
              },
              {
                step: '03',
                title: 'Ampang Pickup or Courier',
                desc: 'Collect for free in Ampang, Selangor or receive nationwide by Pos Laju / J&T courier with tracking and reprint guarantee.',
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="group relative rounded-3xl border border-neutral-850 bg-neutral-900/60 p-8 shadow-sm hover:border-neutral-700 hover:-translate-y-1 transition-all duration-300"
              >
                <span className="absolute right-6 top-5 text-5xl font-black text-neutral-800/60 select-none group-hover:text-neutral-700/80 transition-colors">
                  {step}
                </span>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800 border border-neutral-700 text-white font-black text-xs tracking-wider">
                  {step}
                </div>
                <h3 className="mb-2 text-base font-bold text-white tracking-wide uppercase">{title}</h3>
                <p className="text-xs leading-relaxed text-neutral-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Malaysian Trust & Logistics Bar ── */}
      <section className="bg-neutral-950 py-16 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            <div className="flex items-center gap-4 bg-neutral-900/60 p-5 rounded-2xl border border-neutral-850">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-xl border border-neutral-750">
                📍
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Ampang Pickup</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">Free self-collection in Ampang, KL</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-neutral-900/60 p-5 rounded-2xl border border-neutral-850">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-xl border border-neutral-750">
                📦
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Nationwide Courier</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">J&amp;T &amp; Pos Laju live tracking</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-neutral-900/60 p-5 rounded-2xl border border-neutral-850">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-xl border border-neutral-750">
                🛡️
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Reprint Guarantee</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">100% free reprint if transit damage</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-neutral-900/60 p-5 rounded-2xl border border-neutral-850">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-xl border border-neutral-750">
                💬
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">WhatsApp Engineer</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">Direct advice for slicing and tolerance</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 7. Bottom Call-to-Action ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-900 to-black py-20 text-white">
        <div className="absolute inset-0 bg-dot-matrix-subtle opacity-30 pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 text-center sm:flex-row sm:text-left">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-400">
                Get Started
              </span>
              <h2 className="text-2xl font-black uppercase tracking-wide sm:text-3xl mt-1">
                Have a 3D File Ready to Print?
              </h2>
              <p className="mt-1.5 text-neutral-400 text-xs sm:text-sm max-w-lg">
                Inspect your model in real-time 3D, calculate instant pricing, or consult our engineering queue on WhatsApp.
              </p>
            </div>
            <a
              href="#quote"
              className="shrink-0 inline-flex items-center gap-2.5 rounded-2xl bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-black shadow-xl transition hover:bg-neutral-200 active:scale-95"
            >
              <Upload className="h-4 w-4" /> Start Print Quote <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
