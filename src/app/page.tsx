import Link from 'next/link'
import { ArrowRight, Printer, Search, Package } from 'lucide-react'
import PrinterCard from '@/components/PrinterCard'
import { createClient } from '@/lib/supabase/server'
import type { Printer as PrinterType } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: printersData }, { count: completedCount }] = await Promise.all([
    supabase
      .from('printers')
      .select('*')
      .eq('available', true)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['collected', 'reviewed']),
  ])

  const featured = (printersData ?? []) as unknown as PrinterType[]
  const totalPrinters = featured.length  // we only fetched available ones for display
  const totalCompleted = completedCount ?? 0

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1 text-sm text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Local 3D Printing Network
            </div>

            <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Get anything{' '}
              <span className="text-orange-400">3D printed</span>
              <br />
              near you
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate-300">
              Connect with local 3D printer owners. Upload your STL file, get an
              instant price estimate, and pick it up — no technical knowledge required.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/printers"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-orange-600"
              >
                Find a Printer Near Me <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                List Your Printer
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-900">How it works</h2>
            <p className="mx-auto max-w-md text-slate-600">
              Three simple steps. No account needed.
            </p>
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
                title: 'Upload your STL file',
                desc: 'Upload your 3D model and get an instant price estimate before committing to anything.',
              },
              {
                icon: Printer,
                step: '03',
                title: 'Pick it up locally',
                desc: 'The owner prints your model and you collect it. Pay directly at pickup.',
              },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div
                key={step}
                className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <span className="absolute right-5 top-4 text-5xl font-black text-slate-100">
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

      {/* ── Featured printers ── */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Available now</h2>
              <p className="mt-1 text-slate-600">Ready to take your order</p>
            </div>
            <Link
              href="/printers"
              className="hidden items-center gap-1 text-sm font-medium text-orange-500 hover:text-orange-600 sm:flex"
            >
              See all printers <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-slate-500">No printers available right now.</p>
              <Link href="/register" className="mt-3 text-sm font-medium text-orange-500 hover:text-orange-600">
                Be the first to list your printer →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((printer) => (
                <PrinterCard key={printer.id} printer={printer} />
              ))}
            </div>
          )}

          {featured.length > 0 && (
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/printers"
                className="inline-flex items-center gap-1 text-sm font-medium text-orange-500"
              >
                See all printers <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Live stats ── */}
      {(totalPrinters > 0 || totalCompleted > 0) && (
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-12 text-center">
              {totalPrinters > 0 && (
                <div>
                  <div className="text-3xl font-bold text-slate-900">{totalPrinters}</div>
                  <div className="mt-0.5 text-sm text-slate-500">Printer{totalPrinters !== 1 ? 's' : ''} available</div>
                </div>
              )}
              {totalCompleted > 0 && (
                <div>
                  <div className="text-3xl font-bold text-slate-900">{totalCompleted}</div>
                  <div className="mt-0.5 text-sm text-slate-500">Print{totalCompleted !== 1 ? 's' : ''} completed</div>
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
                List your printer for free and start earning from print jobs in your area.
              </p>
            </div>
            <Link
              href="/register"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-orange-600 shadow transition-colors hover:bg-orange-50"
            >
              List My Printer <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
