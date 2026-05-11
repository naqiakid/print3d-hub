import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer, PrintProfile } from '@/lib/types'
import ProfileManager from '@/components/ProfileManager'

export default async function ProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printerData } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!printerData) redirect('/register')
  const printer = printerData as unknown as Printer

  const { data: profileData } = await supabase
    .from('print_profiles')
    .select('*')
    .eq('printer_id', printer.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const profiles = (profileData ?? []) as unknown as PrintProfile[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Print profiles</h1>
            <p className="mt-1 text-sm text-slate-500">
              {printer.name} · {printer.printer_model}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500 max-w-lg">
          Each profile defines a nozzle size, infill settings, and available add-ons.
          Customers will choose a profile when submitting a print request — the system
          calculates the exact price from their selection.
        </p>
      </div>

      <ProfileManager profiles={profiles} printerId={printer.id} />
    </div>
  )
}
