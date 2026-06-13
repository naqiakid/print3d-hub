import type { Metadata } from 'next'
import PrintersBrowse from '@/components/PrintersBrowse'
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PrintersBrowse printers={printers} />
    </div>
  )
}
