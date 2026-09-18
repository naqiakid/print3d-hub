import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Package, Eye, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Filament } from '@/lib/types'
import FilamentManager from '@/components/FilamentManager'
import { getStudioFilamentsAsFilaments, MATERIAL_METAS } from '@/config/materials'

export const metadata = {
  title: 'Material & Color Inventory | Qid3D Studio',
  description: 'Manage your active 3D printing filament materials, colors, and spool stock.',
}

export default async function MaterialsDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: filamentData } = await supabase
    .from('filaments')
    .select('*')
    .eq('owner_id', user.id)
    .order('material', { ascending: true })
    .order('created_at', { ascending: true })

  // Use database filaments if populated, otherwise use curated studio filaments
  const dbFilaments = (filamentData ?? []) as unknown as Filament[]
  const filaments = dbFilaments.length > 0 ? dbFilaments : getStudioFilamentsAsFilaments(user.id)

  const inStockCount = filaments.filter((f) => f.in_stock).length
  const totalGrams = filaments.reduce((acc, f) => acc + (f.grams_remaining ?? 1000), 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
              Material &amp; Color Inventory
            </h1>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
              {inStockCount} Active Colors
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Control which filaments and color swatches appear live on your public 3D configurator and request forms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/#quote"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            <span>Preview 3D Configurator</span>
          </Link>
        </div>
      </div>

      {/* ── Top Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">PLA Stock</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {filaments.filter((f) => f.material === 'pla' && f.in_stock).length} Colors
          </p>
          <p className="text-[11px] text-slate-400 mt-1">RM 55 / kg · Crisp figurines &amp; decor</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">PETG Stock</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {filaments.filter((f) => f.material === 'petg' && f.in_stock).length} Colors
          </p>
          <p className="text-[11px] text-slate-400 mt-1">RM 65 / kg · High heat &amp; UV brackets</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">TPU (Flexible)</span>
            <span className="h-2 w-2 rounded-full bg-purple-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {filaments.filter((f) => f.material === 'tpu' && f.in_stock).length} Colors
          </p>
          <p className="text-[11px] text-slate-400 mt-1">RM 85 / kg · Rubber-like 95A shock bumpers</p>
        </div>
      </div>

      {/* ── Studio Tip Alert ── */}
      <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Pro-tip for accurate customer quoting:</p>
          <p className="text-blue-700 mt-0.5 leading-relaxed">
            When you add a new spool or change its color hex, the customer&apos;s live WebGL 3D preview updates automatically.
            If a spool finishes, toggle its stock switch off so customers won&apos;t select it during checkout.
          </p>
        </div>
      </div>

      {/* ── Live Filament & Spool Manager ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <FilamentManager filaments={filaments} ownerId={user.id} />
      </div>
    </div>
  )
}
