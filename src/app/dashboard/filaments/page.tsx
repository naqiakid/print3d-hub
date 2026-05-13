import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Filament } from '@/lib/types'
import FilamentManager from '@/components/FilamentManager'

export default async function FilamentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: filamentData } = await supabase
    .from('filaments')
    .select('*')
    .eq('owner_id', user.id)
    .order('material', { ascending: true })
    .order('created_at', { ascending: true })

  const filaments = (filamentData ?? []) as unknown as Filament[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Filaments</h1>
        <p className="mt-3 text-sm text-slate-500 max-w-lg">
          Manage the filament rolls you have in stock. Each entry records the material,
          colour, brand, and cost per kg — used for automatic job pricing.
          Toggle &quot;in stock&quot; to hide a filament from new customer requests without deleting it.
        </p>
      </div>

      <FilamentManager filaments={filaments} ownerId={user.id} />
    </div>
  )
}
