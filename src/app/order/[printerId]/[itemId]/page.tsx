import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Printer, CatalogItem, PrintProfile, Filament } from '@/lib/types'
import CatalogOrderForm from '@/components/CatalogOrderForm'

export default async function CatalogOrderPage({
  params,
}: {
  params: Promise<{ printerId: string; itemId: string }>
}) {
  const { printerId, itemId } = await params
  const supabase = await createClient()

  const [{ data: printerData }, { data: itemData }] = await Promise.all([
    supabase.from('printers').select('*').eq('id', printerId).maybeSingle(),
    supabase.from('catalog_items').select('*').eq('id', itemId).eq('is_active', true).maybeSingle(),
  ])

  if (!printerData || !itemData) notFound()

  const printer = printerData as unknown as Printer
  const item    = itemData as unknown as CatalogItem

  // Verify item belongs to this printer
  if (item.printer_id !== printer.id) notFound()

  const [{ data: profileData }, { data: filamentData }] = await Promise.all([
    supabase
      .from('print_profiles')
      .select('*')
      .eq('printer_id', printer.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false }),
    supabase
      .from('filaments')
      .select('*')
      .eq('owner_id', printer.owner_id)
      .eq('in_stock', true)
      .order('color'),
  ])

  const profiles  = (profileData  ?? []) as unknown as PrintProfile[]
  const filaments = (filamentData ?? []) as unknown as Filament[]

  const customisationBadges: string[] = []
  if (item.allow_custom_text)    customisationBadges.push(item.text_prompt)
  if (item.allow_color_choice)   customisationBadges.push('Color choice')
  if (item.allow_resize)         customisationBadges.push(`${item.resize_min_pct}–${item.resize_max_pct}% resize`)
  if (item.allow_material_choice) customisationBadges.push('Material choice')

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link
        href={`/printers/${printerId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {printer.name}
      </Link>

      {/* Product header */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {item.photo_url && (
          <img
            src={item.photo_url}
            alt={item.name}
            className="h-56 w-full object-cover"
          />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{item.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{printer.name}</p>
            </div>
            {item.base_price && (
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400">From</p>
                <p className="text-xl font-bold text-orange-600">RM {item.base_price.toFixed(2)}</p>
              </div>
            )}
          </div>

          {item.description && (
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{item.description}</p>
          )}

          {customisationBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {customisationBadges.map((badge) => (
                <span key={badge} className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-xs font-medium text-orange-600">
                  {badge}
                </span>
              ))}
            </div>
          )}

          {item.model_url && (
            <a
              href={item.model_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-orange-500 transition"
            >
              <ExternalLink className="h-3 w-3" /> View original design
            </a>
          )}
        </div>
      </div>

      <h2 className="mb-6 text-lg font-bold text-slate-900">Customise your order</h2>

      <CatalogOrderForm
        item={item}
        printer={printer}
        profiles={profiles}
        filaments={filaments}
      />
    </div>
  )
}
