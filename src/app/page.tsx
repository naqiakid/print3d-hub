import Link from 'next/link'
import { ArrowRight, Printer, Search, Package } from 'lucide-react'
import PrinterCard from '@/components/PrinterCard'
import { printers } from '@/lib/data'

export default function HomePage() {
  const featured = printers.filter((p) => p.available).slice(0, 3)

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
              Connect with local 3D printer owners. Describe what you need, get a
              quote, and pick it up — no technical knowledge required.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/printers"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-orange-600"
              >
                Find Printers Near Me <ArrowRight className="h-4 w-4" />
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

      {/* ── Stats ── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
            {[
              { value: '500+', label: 'Registered Printers' },
              { value: '2,000+', label: 'Prints Completed' },
              { value: '50+', label: 'Cities Covered' },
            ].map(({ value, label }) => (
              <div key={label} className="px-4 py-2">
                <div className="text-xl font-bold text-slate-900 sm:text-2xl">{value}</div>
                <div className="mt-0.5 text-xs text-slate-500 sm:text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-900">How it works</h2>
            <p className="mx-auto max-w-md text-slate-600">
              Three simple steps. No technical knowledge needed.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: Search,
                step: '01',
                title: 'Find a printer near you',
                desc: 'Browse local 3D printer owners in your area. See their rating, specialties, and price range.',
              },
              {
                icon: Package,
                step: '02',
                title: 'Describe what you need',
                desc: "Tell the owner what you want printed — in plain words. Upload a file if you have one, or just describe it.",
              },
              {
                icon: Printer,
                step: '03',
                title: 'Pick it up locally',
                desc: 'Agree on a quote, let them print it, and collect your item. Pay directly at pickup.',
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

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((printer) => (
              <PrinterCard key={printer.id} printer={printer} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/printers"
              className="inline-flex items-center gap-1 text-sm font-medium text-orange-500"
            >
              See all printers <ArrowRight className="h-4 w-4" />
            </Link>
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
                Join the network. List your printer for free and start earning from print jobs in your area.
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
