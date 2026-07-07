import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer } from '@/lib/types'

export default async function DashboardEntryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printerData } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  const printers = (printerData ?? []) as unknown as Printer[]

  if (printers.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Welcome to your dashboard</h1>
        <p className="mb-8 text-slate-500">You haven&apos;t listed your printer yet.</p>
        <Link
          href="/register"
          className="inline-block rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          List Your Printer →
        </Link>
      </div>
    )
  }

  if (printers.length === 1) {
    redirect(`/dashboard/${printers[0].id}`)
  }

  // 2+ printers — show a picker with new-request counts
  const requestCounts = await Promise.all(
    printers.map((p) =>
      supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .eq('printer_id', p.id)
        .eq('status', 'new'),
    ),
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Your printers</h1>
      <p className="mb-8 text-sm text-slate-500">Pick a printer to manage.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {printers.map((p, i) => {
          const newCount = requestCounts[i].count ?? 0
          return (
            <Link
              key={p.id}
              href={`/dashboard/${p.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.printer_model}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    p.available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p.available ? 'Available' : 'Busy'}
                </span>
              </div>
              {newCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600">
                  {newCount} new request{newCount > 1 ? 's' : ''}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <Link
        href="/register"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600 transition"
      >
        <Plus className="h-4 w-4" /> Add another printer
      </Link>
    </div>
  )
}
