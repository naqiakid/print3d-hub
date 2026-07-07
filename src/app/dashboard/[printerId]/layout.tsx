import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrinterSwitcher from '@/components/PrinterSwitcher'

export default async function PrinterDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ printerId: string }>
}) {
  const { printerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: printers } = await supabase
    .from('printers')
    .select('id, name, printer_model')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  const ownedPrinters = printers ?? []
  const current = ownedPrinters.find((p) => p.id === printerId)

  // Not this owner's printer (or doesn't exist) — bounce to the smart entry point
  if (!current) redirect('/dashboard')

  return (
    <div>
      {ownedPrinters.length > 1 && (
        <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6 lg:px-8">
          <PrinterSwitcher printers={ownedPrinters} currentId={printerId} />
        </div>
      )}
      {children}
    </div>
  )
}
