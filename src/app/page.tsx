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
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1.5 text-sm text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Local 3D Printing Network
            </div>

            <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Get anything{' '}
              <span className="text-orange-400">3D printed</span>
              {' '}near you
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate-300">
              Find a local 3D printer owner, choose how you want to order, and pick up
              your print — no technical knowledge required.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/printers"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-600"
              >
                Find a Printer Near Me <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                List Your Printer
              </Link>
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
            <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:border-orange-200 hover:shadow-md transition">
              <span className="absolute right-5 top-4 text-5xl font-black text-slate-100 select-none">01</span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                <Upload className="h-5 w-5 text-orange-600" />
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
            <div className="relative flex flex-col rounded-2xl border border-orange-200 bg-orange-50/40 p-8 shadow-sm hover:shadow-md transition">
              <span className="absolute right-5 top-4 text-5xl font-black text-orange-100 select-none">02</span>
              <div className="mb-1 self-start rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </div>
              <div className="mb-4 mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                <Sliders className="h-5 w-5 text-orange-600" />
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
            <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:border-orange-200 hover:shadow-md transition">
              <span className="absolute right-5 top-4 text-5xl font-black text-slate-100 select-none">03</span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                <ShoppingBag className="h-5 w-5 text-orange-600" />
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
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <span className="absolute right-5 top-4 text-5xl font-black text-slate-105 select-none">
                  {step}
                </span>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100">
                  <Icon className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live stats ── */}
      {(totalPrinters > 0 || totalCompleted > 0) && (
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-16 text-center">
              {totalPrinters > 0 && (
                <div>
                  <div className="text-3xl font-bold text-slate-900">{totalPrinters}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Printer{totalPrinters !== 1 ? 's' : ''} on the network
                  </div>
                </div>
              )}
              {totalCompleted > 0 && (
                <div>
                  <div className="text-3xl font-bold text-slate-900">{totalCompleted}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Print{totalCompleted !== 1 ? 's' : ''} completed
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
