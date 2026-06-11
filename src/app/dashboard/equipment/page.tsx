import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { PrintProfile, Filament } from '@/lib/types'
import EquipmentManager from '@/components/EquipmentManager'
import FilamentManager from '@/components/FilamentManager'

export default async function EquipmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printerData } = await supabase
    .from('printers')
    .select('id, bed_type')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!printerData) redirect('/register')

  const [profileResult, filamentResult] = await Promise.all([
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
  ])

  const profiles  = (profileResult.data  ?? []) as unknown as PrintProfile[]
  const filaments = (filamentResult.data  ?? []) as unknown as Filament[]
  const bedTypes  = (printerData.bed_type ?? []) as string[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Equipment &amp; Filaments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the hardware on your printer and the filament rolls you have in stock.
        </p>
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
