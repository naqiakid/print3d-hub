import Link from 'next/link'
import { ArrowRight, Upload, Sliders, ShoppingBag, Search, Printer, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop } from '@/lib/types'
import { fetchCatalogBrowseItems } from '@/lib/catalog-browse'
import { ProductCard } from '@/components/CatalogBrowse'
import PrintersNearYou from '@/components/PrintersNearYou'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: printerRows } = await supabase.from('printers').select('owner_id')
  const ownerIds = [...new Set((printerRows ?? []).map((p) => p.owner_id))]

  const [allPrinters, trendingProducts, { count: completedCount }] = await Promise.all([
    ownerIds.length
      ? supabase
          .from('profiles')
          .select('*')
          .eq('available', true)
          .in('id', ownerIds)
          .order('created_at', { ascending: false })
          .then(({ data }) => (data ?? []) as unknown as Shop[])
      : Promise.resolve([] as Shop[]),
    fetchCatalogBrowseItems('custom').then((items) => items.slice(0, 3)),
    supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['collected', 'reviewed']),
  ])

  const totalPrinters = ownerIds.length
  const totalCompleted = completedCount ?? 0

  return (
    <div className="flex flex-col">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-slate-950 py-24 lg:py-32 text-white">
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-12px) rotate(0.5deg); }
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
        `}</style>

        {/* Faint Background Grid Pattern & Radial Glows */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_80%,transparent_100%)] pointer-events-none" />
        <div className="absolute -left-1/4 top-0 h-96 w-96 rounded-full bg-orange-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute -right-1/4 bottom-0 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Text & CTAs */}
            <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left">
              <div className="mb-6 inline-flex self-center lg:self-start items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-orange-300">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                Local 3D Printing Network
              </div>

              <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-350">
                Get anything{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-400 drop-shadow-sm">3D printed</span>
                {' '}near you
              </h1>

              <p className="mb-8 max-w-xl text-base sm:text-lg leading-relaxed text-slate-300 mx-auto lg:mx-0">
                Connect with vetted local 3D printer owners. Choose a design or bring your own,
                and pick up locally—no 3D printer required.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row justify-center lg:justify-start">
                <Link
                  href="/printers"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition duration-200 hover:bg-orange-600 hover:shadow-orange-500/35 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Find a Printer Near Me <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-6 py-3.5 text-sm font-semibold text-slate-250 transition duration-200 hover:border-slate-500 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0"
                >
                  List Your Printer
                </Link>
              </div>

              {/* Social Proof Block */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 animate-fade-in">
                <div className="flex -space-x-2.5">
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-950 object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80" alt="User face" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-950 object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80" alt="User face" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-950 object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80" alt="User face" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-950 object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80" alt="User face" />
                </div>
                <p className="text-slate-400 text-sm font-medium tracking-tight text-center sm:text-left">
                  <span className="text-amber-400 mr-1.5">⭐⭐⭐⭐⭐</span>
                  Join 50+ locals printing in Ampang & KL
                </p>
              </div>
            </div>

            {/* Right Column: Floating Showcase (Wow Factor) */}
            <div className="hidden lg:block lg:col-span-5 relative pl-6">
              {/* Outer Glow container */}
              <div className="relative mx-auto max-w-[340px] animate-float">
                {/* Floating Badge 1 (Live Quote) */}
                <div className="absolute -top-4 -left-10 z-20 rounded-xl border border-teal-500/30 bg-slate-950/85 px-3.5 py-2 text-[11px] font-bold text-teal-400 shadow-xl backdrop-blur-md flex items-center gap-1.5 animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
                  </span>
                  <span>Live Quote: RM 25.00</span>
                </div>

                {/* Floating Badge 2 (Pickup) */}
                <div className="absolute -bottom-4 -right-6 z-20 rounded-xl border border-orange-500/30 bg-slate-950/85 px-3.5 py-2 text-[11px] font-bold text-orange-400 shadow-xl backdrop-blur-md flex items-center gap-1.5">
                  <span>📍 Pickup in Ampang</span>
                </div>

                {/* Main Card Grid */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-2xl space-y-4">
                  {/* Window Controls chrome */}
                  <div className="flex items-center gap-1.5 border-b border-white/5 pb-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                    <span className="text-[10px] font-bold text-slate-500 ml-1.5 tracking-wide uppercase">Print Preview</span>
                  </div>

                  {/* 3D Print Time-Lapse Image */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-slate-950 shadow-inner">
                    <img 
                      src="https://images.unsplash.com/photo-1615840287214-7fe58a8b668f?auto=format&fit=crop&w=600&q=80" 
                      alt="3D printer in progress" 
                      className="h-full w-full object-cover opacity-85 hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                  </div>

                  {/* Settings specs summary bar */}
                  <div className="flex items-center justify-between text-[9px] font-bold tracking-wider text-slate-450 uppercase border-t border-white/5 pt-3">
                    <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded">Layer: 0.2mm</span>
                    <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded">Infill: 15%</span>
                    <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded">Time: 2h 45m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Top Trending Products ── */}
      <section className="py-20 bg-slate-50 border-b border-slate-200/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Top Trending Products</h2>
              <p className="mt-1 text-slate-500">Popular customizable items ready to print near you</p>
            </div>
            <Link
              href="/browse/custom"
              className="hidden items-center gap-1 text-sm font-semibold text-orange-500 hover:text-orange-600 sm:flex transition"
            >
              See all designs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {trendingProducts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <Package className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">No customisable items listed yet.</p>
              <Link href="/dashboard/catalog" className="mt-3 text-sm font-semibold text-orange-500 hover:text-orange-600 transition">
                Add products to catalog →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trendingProducts.map((item) => (
                <ProductCard key={item.id} item={item} distanceKm={undefined} mode="custom" />
              ))}
            </div>
          )}

          {trendingProducts.length > 0 && (
            <div className="mt-8 text-center sm:hidden">
              <Link href="/browse/custom" className="inline-flex items-center gap-1 text-sm font-semibold text-orange-500">
                See all designs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Three ways to order ── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-900">Three ways to order</h2>
            <p className="mx-auto max-w-md text-slate-500">
              Whether you have a design ready or just know what you want, there is an option for you.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">

            {/* 1 — Fully custom */}
            <div className="group relative flex flex-col rounded-3xl border border-slate-200 bg-slate-50/40 p-8 shadow-sm hover:bg-white hover:border-orange-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <span className="absolute right-6 top-5 text-5xl font-black text-slate-100/60 select-none group-hover:text-orange-50/70 transition-colors duration-300">01</span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 group-hover:bg-orange-500 transition-all duration-300 shadow-sm shadow-orange-100 group-hover:shadow-orange-500/20">
                <Upload className="h-5 w-5 text-orange-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">Fully custom print</h3>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-500">
                Have your own design? Upload an STL file or share a link from Printables,
                MakerWorld, or Thingiverse. The owner gives you a quote and prints it exactly as you want.
              </p>
              <Link
                href="/printers"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-500 hover:text-orange-600 transition"
              >
                Find a printer <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* 2 — Semi-custom */}
            <div className="group relative flex flex-col rounded-3xl border-2 border-orange-400 bg-orange-50/20 p-8 shadow-md hover:bg-orange-50/40 hover:border-orange-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <span className="absolute right-6 top-5 text-5xl font-black text-orange-200/50 select-none group-hover:text-orange-300/40 transition-colors duration-300">02</span>
              <div className="mb-1 self-start rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </div>
              <div className="mb-4 mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 transition-all duration-300 shadow-sm shadow-orange-100 group-hover:shadow-orange-500/20">
                <Sliders className="h-5 w-5 text-white" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">Semi-custom</h3>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-500">
                Browse ready-to-print designs listed by local makers. Personalise with
                your own text, pick a color, choose a material, or resize — whatever
                options the owner has made available.
              </p>
              <Link
                href="/browse/custom"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-500 hover:text-orange-600 transition"
              >
                Browse designs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* 3 — Ready-made */}
            <div className="group relative flex flex-col rounded-3xl border border-slate-200 bg-slate-50/40 p-8 shadow-sm hover:bg-white hover:border-orange-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <span className="absolute right-6 top-5 text-5xl font-black text-slate-100/60 select-none group-hover:text-orange-50/70 transition-colors duration-300">03</span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 group-hover:bg-orange-500 transition-all duration-300 shadow-sm shadow-orange-100 group-hover:shadow-orange-500/20">
                <ShoppingBag className="h-5 w-5 text-orange-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">Ready-made product</h3>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-500">
                Just want the thing? Some makers list finished products at a fixed price —
                no decisions needed. Order it and collect it.
              </p>
              <Link
                href="/browse/ready"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-500 hover:text-orange-600 transition"
              >
                See what&apos;s available <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── Printers Near You ── */}
      <section className="py-20 bg-slate-50 border-y border-slate-200/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PrintersNearYou initialPrinters={allPrinters} />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-900">How it works</h2>
            <p className="mx-auto max-w-md text-slate-500">Three simple steps. No account needed.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: Search,
                step: '01',
                title: 'Find a printer near you',
                desc: 'Browse local 3D printer owners. See their materials, turnaround time, and price range.',
              },
              {
                icon: Package,
                step: '02',
                title: 'Choose how you want to order',
                desc: 'Upload your own design, personalise a listed product, or order something ready-made.',
              },
              {
                icon: Printer,
                step: '03',
                title: 'Pick it up locally',
                desc: 'The owner prints your order and you collect it nearby. Pay directly at pickup or on delivery.',
              },
            ].map(({ icon: Icon, step, title, desc }, idx) => (
              <div
                key={step}
                className="group relative rounded-3xl border border-slate-200 bg-white p-8 shadow-sm hover:border-orange-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <span className="absolute right-6 top-5 text-5xl font-black text-slate-100/70 select-none group-hover:text-orange-50/70 transition-colors duration-300">
                    {step}
                  </span>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 group-hover:bg-orange-500 transition-all duration-300 shadow-sm shadow-orange-100 group-hover:shadow-orange-500/20">
                    <Icon className="h-5 w-5 text-orange-600 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="mb-2.5 text-base font-bold text-slate-900 tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Benefits Bar ── */}
      <section className="border-b border-slate-200/50 bg-slate-50/50 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100/60 text-lg">
                📍
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Local Pickup</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Collect prints nearby &amp; save on shipping fees</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100/60 text-lg">
                💰
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Upfront Pricing</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Instant quotes with zero hidden processing costs</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100/60 text-lg">
                ⚙️
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Verified Makers</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Vetted local print hubs ensuring print quality</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100/60 text-lg">
                💬
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Direct WhatsApp</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Coordinate custom modifications directly with makers</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Owner CTA ── */}
      <section className="bg-orange-500 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Own a 3D printer? Put it to work.
              </h2>
              <p className="mt-2 text-orange-100">
                List your printer for free and start earning from jobs in your area.
              </p>
            </div>
            <Link
              href="/register"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-orange-600 shadow transition hover:bg-orange-50"
            >
              List My Printer <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
