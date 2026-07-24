import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, CheckCircle, Weight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer, PrintProfile, Filament } from '@/lib/types'
import PrinterList from '@/components/PrinterList'
import FilamentManager from '@/components/FilamentManager'

const COMPLETED_STATUSES = ['done', 'collected', 'reviewed']

export default async function EquipmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printerRows } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (!printerRows || printerRows.length === 0) redirect('/dashboard')
  const printers = printerRows as unknown as Printer[]
  const printerIds = printers.map((p) => p.id)

  const [profileResult, filamentResult, usageResult] = await Promise.all([
    supabase
      .from('print_profiles')
      .select('*')
      .in('printer_id', printerIds)
      .order('nozzle_mm', { ascending: true }),
    supabase
      .from('filaments')
      .select('*')
      .eq('owner_id', user.id)
      .order('material', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('requests')
      .select('print_hours, weight_g')
      .eq('owner_id', user.id)
      .in('status', COMPLETED_STATUSES),
  ])

  const profiles  = (profileResult.data  ?? []) as unknown as PrintProfile[]
  const filaments = (filamentResult.data ?? []) as unknown as Filament[]

  const profilesByPrinter: Record<string, PrintProfile[]> = {}
  for (const p of profiles) {
    if (!profilesByPrinter[p.printer_id]) profilesByPrinter[p.printer_id] = []
    profilesByPrinter[p.printer_id].push(p)
  }

  const usageRows = usageResult.data ?? []
  const totalHours   = usageRows.reduce((s, r) => s + (r.print_hours ?? 0), 0)
  const totalWeightG = usageRows.reduce((s, r) => s + (r.weight_g ?? 0), 0)
  const completedJobs = usageRows.length

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-655 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Equipment &amp; Filaments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your active printers, profiles, and material inventory stock.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        
        {/* ── Left Column: Printers & Usage (lg:col-span-6) ── */}
        <div className="lg:col-span-6 space-y-8">
          
          {/* Machine usage */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-905">Machine Usage Stats</h2>
            <p className="mb-4 text-xs text-slate-400 mt-0.5">
              Automatically calculated based on your completed orders
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Clock, label: 'Print time', value: totalHours > 0 ? `${Math.round(totalHours * 10) / 10}h` : '—', color: 'text-purple-600', bg: 'bg-purple-50' },
                { icon: CheckCircle, label: 'Jobs done', value: completedJobs, color: 'text-green-600', bg: 'bg-green-50' },
                { icon: Weight, label: 'Filament used', value: totalWeightG > 0 ? `${Math.round(totalWeightG)}g` : '—', color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="text-center rounded-xl bg-slate-50/50 border border-slate-100 p-3">
                  <div className={`mb-1.5 inline-flex rounded-lg p-1.5 ${bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div className="text-lg font-bold text-slate-900 leading-none">{value}</div>
                  <div className="text-[10px] text-slate-450 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* My Printers */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 leading-none">My Printers</h2>
              <p className="text-xs text-slate-400 mt-1.5">
                Add new equipment or expand active printers to manage bed sizes, nozzles, and configurations.
              </p>
            </div>
            <PrinterList printers={printers} profilesByPrinter={profilesByPrinter} />
          </div>

        </div>

        {/* ── Right Column: Filaments Inventory (lg:col-span-6) ── */}
        <div className="lg:col-span-6 space-y-8">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 leading-none">Filament Stock</h2>
              <p className="text-xs text-slate-400 mt-1.5">
                Record filament spools in stock. Toggling stock status automatically updates your customer order form color presets in real-time.
              </p>
            </div>
            <FilamentManager filaments={filaments} ownerId={user.id} />
          </div>
        </div>

      </div>
    </div>
  )
}
