import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer, CatalogItem, FilamentMaterial } from '@/lib/types'
import CatalogManager from '@/components/CatalogManager'

export default async function CatalogPage() {
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

  const { data: itemData } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('printer_id', printer.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const items = (itemData ?? []) as unknown as CatalogItem[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">My Products</h1>
        <p className="mt-1 text-sm text-slate-500">{printer.name} · {printer.printer_model}</p>
        <p className="mt-3 text-sm text-slate-500 max-w-lg">
          Showcase your best prints. Customers can browse these on your listing page and order
          directly with their customisations — text engraving, color, size, and material.
        </p>
      </div>

      <CatalogManager
        initialItems={items}
        printerId={printer.id}
        printerMaterials={(printer.materials ?? []) as FilamentMaterial[]}
        printer={printer}
      />
    </div>
  )
}
