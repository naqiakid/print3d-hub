import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, PrintRequest, Affiliate, RequestPrinterView } from '@/lib/types'
import AffiliateManager from '@/components/AffiliateManager'

export default async function AffiliatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shopData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!shopData) redirect('/login')
  const shop = shopData as unknown as Shop

  const { data: printerRows } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (!printerRows || printerRows.length === 0) redirect('/dashboard')
  const primaryPrinter = printerRows[0] as unknown as Printer

  // 1. Fetch affiliate promo codes
  const { data: affiliateData } = await supabase
    .from('affiliates')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const affiliates = (affiliateData ?? []) as unknown as Affiliate[]

  // 2. Fetch referred print requests (where affiliate_code is not null)
  const { data: requestData } = await supabase
    .from('requests')
    .select('*')
    .eq('owner_id', user.id)
    .not('affiliate_code', 'is', null)
    .order('created_at', { ascending: false })

  const referredRequests = (requestData ?? []) as unknown as PrintRequest[]

  const requestPrinter: RequestPrinterView = {
    ...shop,
    printer_model: primaryPrinter.printer_model,
    printer_model_id: primaryPrinter.printer_model_id,
    filament_costs: primaryPrinter.filament_costs,
    power_watts: primaryPrinter.power_watts,
    machine_rate_per_hour: primaryPrinter.machine_rate_per_hour,
    bed_type: primaryPrinter.bed_type,
    grams_per_roll: primaryPrinter.grams_per_roll,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Affiliate Program</h1>
        <p className="mt-1 text-sm text-slate-500">{shop.name}</p>
        <p className="mt-3 text-sm text-slate-500 max-w-2xl">
          Generate custom promo codes for designers, creators, or promoters. 
          When customers order using their code, they get a discount and the promoter earns a commission.
        </p>
      </div>

      <AffiliateManager
        initialAffiliates={affiliates}
        referredRequests={referredRequests}
        printer={requestPrinter}
      />
    </div>
  )
}
