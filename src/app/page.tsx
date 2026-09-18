import Link from 'next/link'
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
  Sliders
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer as PrinterType, Filament, RequestPrinterView } from '@/lib/types'
import { fetchCatalogBrowseItems } from '@/lib/catalog-browse'
import { ProductCard } from '@/components/CatalogBrowse'
import PublicPriceCalculatorWrapper from '@/components/configurator/PriceConfiguratorWrapper'
import { STUDIO_CONFIG } from '@/config/studio'
import { getStudioFilamentsAsFilaments } from '@/config/materials'

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
    <div className="flex flex-col">

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-slate-950 py-20 lg:py-28 text-white">
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(0.5deg); }
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
        `}</style>

        {/* Background Grid & Glows */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_80%,transparent_100%)] pointer-events-none" />
        <div className="absolute -left-1/4 top-0 h-96 w-96 rounded-full bg-orange-600/15 blur-[120px] pointer-events-none" />
        <div className="absolute -right-1/4 bottom-0 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Studio Pitch */}
            <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left">
              <div className="mb-6 inline-flex self-center lg:self-start items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-orange-300">
                <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                📍 Ampang, Selangor · Creality Ender-3 V3 SE Studio
              </div>

              <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl text-white">
                Precision <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-400">3D Printing</span> &amp; Custom Models
              </h1>

              <p className="mb-8 max-w-xl text-base sm:text-lg leading-relaxed text-slate-300 mx-auto lg:mx-0">
                Welcome to <strong>Qid3D Studio</strong>. We fabricate your digital 3D models into durable, physical prototypes and figures. Specializing in crisp <strong>PLA</strong>, high-strength <strong>PETG</strong>, and flexible <strong>TPU</strong>.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row justify-center lg:justify-start">
                <a
                  href="#quote"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition duration-200 hover:bg-orange-600 hover:shadow-orange-500/35 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Upload className="h-4 w-4" /> Instant 3D Quote &amp; Preview
                </a>
                <Link
                  href="/browse/products"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-sm font-semibold text-slate-200 transition duration-200 hover:border-slate-500 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <ShoppingBag className="h-4 w-4" /> Browse Shop Catalog
                </Link>
              </div>

              {/* Machine Highlights Chips */}
              <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-2.5 text-xs font-medium text-slate-400">
                <span className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1.5 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-orange-400" /> Direct-Drive Sprite Extruder
                </span>
                <span className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1.5 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-orange-400" /> 220 × 220 × 250 mm Volume
                </span>
                <span className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1.5 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-orange-400" /> Local Pickup &amp; Courier
                </span>
              </div>
            </div>

            {/* Right Column: Visual Showcase Badge */}
            <div className="hidden lg:block lg:col-span-5 relative pl-6">
              <div className="relative mx-auto max-w-[340px] animate-float">
                {/* Floating Badge 1 */}
                <div className="absolute -top-4 -left-8 z-20 rounded-xl border border-teal-500/30 bg-slate-950/90 px-3.5 py-2 text-[11px] font-bold text-teal-300 shadow-xl backdrop-blur-md flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                  <span>TPU Flexible Printing Ready</span>
                </div>

                {/* Floating Badge 2 */}
                <div className="absolute -bottom-4 -right-6 z-20 rounded-xl border border-orange-500/30 bg-slate-950/90 px-3.5 py-2 text-[11px] font-bold text-orange-400 shadow-xl backdrop-blur-md flex items-center gap-1.5">
                  <span>📍 Pickup in Ampang, KL</span>
                </div>

                {/* Main Card */}
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                      Creality Ender-3 V3 SE
                    </span>
                  </div>

                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-inner">
                    <img
                      src="https://images.unsplash.com/photo-1615840287214-7fe58a8b668f?auto=format&fit=crop&w=600&q=80"
                      alt="3D printer in action"
                      className="h-full w-full object-cover opacity-90 hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 text-xs font-bold text-white">
                      CR Touch Auto-Bed Leveling
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold tracking-wider text-slate-300 uppercase border-t border-white/10 pt-3">
                    <div className="rounded-lg bg-white/5 p-2">
                      <p className="text-orange-400">PLA</p>
                      <p className="text-[9px] text-slate-400">Crisp Detail</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                      <p className="text-orange-400">PETG</p>
                      <p className="text-[9px] text-slate-400">Durable</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                      <p className="text-orange-400">TPU</p>
                      <p className="text-[9px] text-slate-400">Flexible 95A</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Instant Price Estimator & 3D WebGL Canvas Section ── */}
      <section id="quote" className="py-20 bg-slate-100/70 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-xs font-bold text-orange-700 mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Instant Slicing &amp; Quote Engine
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
              Upload Your 3D File for an Instant Estimate
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-2xl mx-auto">
              Drop your STL, 3MF, or OBJ file. Inspect your model in interactive 3D, toggle materials &amp; infill presets, and submit your request directly to our queue.
            </p>
          </div>

          {/* Interactive Calculator */}
          <PublicPriceCalculatorWrapper printer={requestPrinter} filaments={filaments} />

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Need custom CAD design assistance, special materials, or batch quotes?{' '}
              <a
                href="mailto:3mfstudio.my@gmail.com?subject=3MF%20Studio%20Custom%20Print%20Inquiry"
                className="font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2"
              >
                Email our team at 3mfstudio.my@gmail.com →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Machine & Materials Showcase ── */}
      <section id="materials" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              Machine Capabilities &amp; Supported Filaments
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
              We tune our Creality Ender-3 V3 SE profiles specifically for optimal layer adhesion, tensile strength, and clean tolerances.
            </p>
          </div>

          {/* Machine Banner */}
          <div className="mb-12 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-950 p-8 text-white shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-400 border border-orange-500/30">
                  <Printer className="h-3.5 w-3.5" /> Our Primary Workhorse
                </div>
                <h3 className="text-2xl font-black tracking-tight">Creality Ender-3 V3 SE</h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                  Equipped with a Sprite direct-drive extruder, dual Z-axis leadscrews, and CR Touch bed leveling. Capable of printing high-detail aesthetic miniatures as well as elastomeric, flexible TPU parts that bowden printers struggle with.
                </p>
                <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold text-slate-300">
                  <span>📐 <strong>Build Volume:</strong> 220 × 220 × 250 mm</span>
                  <span>⚙️ <strong>Nozzle:</strong> 0.4 mm Hardened Brass</span>
                  <span>⚡ <strong>Speed:</strong> Up to 250 mm/s</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Standard Tolerance</p>
                <p className="text-3xl font-black text-orange-400">±0.2 mm</p>
                <p className="text-[11px] text-slate-400">Accurate fitment for snap-fit joints and bolt holes</p>
              </div>
            </div>
          </div>

          {/* 3 Material Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* PLA */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-8 space-y-4 hover:border-orange-300 hover:shadow-lg transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 font-black text-base">
                PLA
              </div>
              <h4 className="text-xl font-bold text-slate-900">PLA (Polylactic Acid)</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                The gold standard for aesthetic accuracy, figurines, cosplay accessories, and rapid visual prototyping.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Crisp surface detail &amp; vibrant colors
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Eco-friendly corn-starch derivative
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Best for indoor decor, figures &amp; desk organizers
                </li>
              </ul>
            </div>

            {/* PETG */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-8 space-y-4 hover:border-orange-300 hover:shadow-lg transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 font-black text-base">
                PETG
              </div>
              <h4 className="text-xl font-bold text-slate-900">PETG (Engineering Tough)</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Combines ease of printing with superior impact resistance, chemical resistance, and heat tolerance up to 75°C.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> UV &amp; water-resistant for outdoor exposure
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Heat resistant inside parked cars
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Best for drone brackets, car mounts &amp; functional parts
                </li>
              </ul>
            </div>

            {/* TPU */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-8 space-y-4 hover:border-orange-300 hover:shadow-lg transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 font-black text-base">
                TPU
              </div>
              <h4 className="text-xl font-bold text-slate-900">TPU (Flexible Rubber 95A)</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Elastomeric filament with rubber-like flexibility, high tear resistance, and shock absorption.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Bends and recovers shape without cracking
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Direct-drive Sprite ensures flawless feed
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Best for phone cases, gaskets, dampeners &amp; bumpers
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── Ready-to-Buy Catalog Section ── */}
      <section className="py-20 bg-slate-50 border-y border-slate-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 mb-2">
                <span>Direct Purchase</span>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Ready-to-Print Shop Catalog
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Browse pre-calibrated 3D models and figures ready to order with customizable colors
              </p>
            </div>
            <Link
              href="/browse/products"
              className="hidden items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700 sm:flex transition"
            >
              View full catalog <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {trendingProducts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <Package className="h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Catalog Collection Incoming</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-sm">
                Have a 3D model you want printed right now? Use our instant file uploader above to request an instant quote.
              </p>
              <a href="#quote" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition">
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

          <div className="mt-8 text-center sm:hidden">
            <Link href="/browse/products" className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600">
              View all products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works (3 Steps) ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              How Ordering Works
            </h2>
            <p className="mx-auto max-w-md text-sm sm:text-base text-slate-500">
              Three seamless steps from digital 3D model to physical delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Upload or Select Model',
                desc: 'Upload your own STL/3MF/OBJ file, or choose from our ready-to-order catalog with custom color selections.',
              },
              {
                step: '02',
                title: 'Precision Slicing & Fabrication',
                desc: 'We inspect geometry, orientation, and infill before printing on our calibrated Ender-3 V3 SE with genuine filaments.',
              },
              {
                step: '03',
                title: 'Collect or Courier Delivery',
                desc: 'Pick up in Ampang, Selangor or receive nationwide by courier with tracking link and our 100% reprint guarantee.',
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="group relative rounded-3xl border border-slate-200 bg-slate-50/40 p-8 shadow-sm hover:border-orange-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <span className="absolute right-6 top-5 text-5xl font-black text-slate-200/70 select-none group-hover:text-orange-200/50 transition-colors">
                  {step}
                </span>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white font-black text-sm shadow-md shadow-orange-500/20">
                  {step}
                </div>
                <h3 className="mb-2.5 text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Malaysian E-Commerce Trust Bar ── */}
      <section className="border-t border-slate-200/60 bg-slate-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            <div className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-xl">
                📍
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ampang Pickup</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Free self-collection in Ampang, Selangor</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-xl">
                📦
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Nationwide Courier</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">J&amp;T &amp; Pos Laju dispatch with live tracking</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl">
                🛡️
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Reprint Guarantee</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">100% free reprint if damaged in transit</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                💬
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">WhatsApp Support</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Direct advice for slicing and model scale</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Studio CTA Banner ── */}
      <section className="bg-orange-500 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">
                Have a 3D File Ready to Print?
              </h2>
              <p className="mt-1 text-orange-100 text-sm">
                Get an instant estimate now or drop a message to Qid3D Studio on WhatsApp.
              </p>
            </div>
            <a
              href="#quote"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-orange-600 shadow transition hover:bg-orange-50 active:scale-95"
            >
              <Upload className="h-4 w-4" /> Start Print Quote <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
