import type { Metadata } from 'next'
import PrintersBrowse from '@/components/PrintersBrowse'
import { createClient } from '@/lib/supabase/server'
import type { Shop } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Browse Printers | Print3DHub',
  description: 'Find 3D printing services near you',
}

export default async function PrintersPage() {
  const supabase = await createClient()

  // Only shops that have actually registered at least one printer show up —
  // every signed-up user gets a `profiles` row, but not every user is a shop.
  const { data: printerRows } = await supabase.from('printers').select('owner_id')
  const ownerIds = [...new Set((printerRows ?? []).map((p) => p.owner_id))]

  const { data } = ownerIds.length
    ? await supabase
        .from('profiles')
        .select('*')
        .in('id', ownerIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const shops = (data ?? []) as unknown as Shop[]

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PrintersBrowse printers={shops} />
    </div>
  )
}
