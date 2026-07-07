import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, CheckCircle, Weight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { PrintProfile, Filament } from '@/lib/types'
import EquipmentManager from '@/components/EquipmentManager'
import FilamentManager from '@/components/FilamentManager'

const COMPLETED_STATUSES = ['done', 'collected', 'reviewed']

export default async function EquipmentPage({
  params,
}: {
  params: Promise<{ printerId: string }>
}) {
  const { printerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printerData } = await supabase
    .from('printers')
    .select('id, bed_type')
    .eq('id', printerId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!printerData) redirect('/dashboard')

  const [profileResult, filamentResult, usageResult] = await Promise.all([
    supabase
      .from('print_profiles')
      .select('*')
      .eq('printer_id', printerData.id)
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
      .eq('printer_id', printerData.id)
      .in('status', COMPLETED_STATUSES),
  ])

  const profiles  = (profileResult.data  ?? []) as unknown as PrintProfile[]
  const filaments = (filamentResult.data  ?? []) as unknown as Filament[]
  const bedTypes  = (printerData.bed_type ?? []) as string[]

  const usageRows = usageResult.data ?? []
  const totalHours   = usageRows.reduce((s, r) => s + (r.print_hours ?? 0), 0)
  const totalWeightG = usageRows.reduce((s, r) => s + (r.weight_g ?? 0), 0)
  const completedJobs = usageRows.length

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/dashboard/${printerData.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Equipment &amp; Filaments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the hardware on your printer and the filament rolls you have in stock.
        </p>
      </div>

      {/* ── Machine usage (auto-tracked from completed jobs) ── */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900">Machine usage</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Automatically tracked from your completed jobs — nothing to fill in.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Clock, label: 'Total print hours', value: totalHours > 0 ? `${Math.round(totalHours * 10) / 10}h` : '—', color: 'text-purple-600', bg: 'bg-purple-50' },
            { icon: CheckCircle, label: 'Completed jobs', value: completedJobs, color: 'text-green-600', bg: 'bg-green-50' },
            { icon: Weight, label: 'Filament used', value: totalWeightG > 0 ? `${Math.round(totalWeightG)}g` : '—', color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`mb-2 inline-flex rounded-lg p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <EquipmentManager
        profiles={profiles}
        bedTypes={bedTypes}
        printerId={printerData.id}
      />

      <div className="mt-12">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Filaments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Record the filament rolls you have in stock — material, colour, brand, and cost per kg.
            Used for automatic job pricing. Toggle &quot;in stock&quot; to hide without deleting.
          </p>
        </div>
        <FilamentManager filaments={filaments} ownerId={user.id} />
      </div>
    </div>
  )
}
