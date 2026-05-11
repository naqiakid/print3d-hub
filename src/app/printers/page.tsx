import type { Metadata } from 'next'
import PrinterCard from '@/components/PrinterCard'
import { createClient } from '@/lib/supabase/server'
import type { Printer } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Browse Printers | Print3DHub',
  description: 'Find 3D printing services near you',
}

export default async function PrintersPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('printers')
    .select('*')
    .order('created_at', { ascending: false })

  const printers = (data ?? []) as unknown as Printer[]
  const available = printers.filter((p) => p.available)
  const busy = printers.filter((p) => !p.available)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Browse Printers</h1>
        <p className="mt-1 text-slate-600">
          {printers.length} printing service{printers.length !== 1 ? 's' : ''} · sorted by distance
        </p>
      </div>

      {printers.length === 0 && (
        <div className="flex flex-col items-center py-24 text-center">
          <p className="text-lg font-medium text-slate-500">No printers listed yet</p>
          <p className="mt-1 text-sm text-slate-400">Be the first to list your 3D printer!</p>
        </div>
      )}

      {available.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            Available now
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {available.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((printer) => (
              <PrinterCard key={printer.id} printer={printer} />
            ))}
          </div>
        </section>
      )}

      {busy.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-medium text-slate-400">
            Currently busy
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {busy.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {busy.map((printer) => (
              <PrinterCard key={printer.id} printer={printer} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
