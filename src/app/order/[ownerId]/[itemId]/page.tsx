import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, CatalogItem, PrintProfile, Filament, RequestPrinterView } from '@/lib/types'
import CatalogOrderForm from '@/components/CatalogOrderForm'
import STLViewer from '@/components/STLViewerWrapper'
import ProductMediaGallery from '@/components/ProductMediaGallery'

export default async function CatalogOrderPage({
  params,
}: {
  params: Promise<{ ownerId: string; itemId: string }>
}) {
  const { ownerId, itemId } = await params
  const supabase = await createClient()

  const [{ data: shopData }, { data: itemData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
    supabase.from('catalog_items').select('*').eq('id', itemId).eq('is_active', true).maybeSingle(),
  ])

  if (!shopData || !itemData) notFound()

  const shop = shopData as unknown as Shop
  const item = itemData as unknown as CatalogItem

  // Verify item belongs to this shop
  if (item.owner_id !== shop.id) notFound()

  const { data: printerRows } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', shop.id)
    .order('created_at', { ascending: true })
  const printers = (printerRows ?? []) as unknown as Printer[]
  if (printers.length === 0) notFound()
  const primaryPrinter = printers[0]
  const printerIds = printers.map((p) => p.id)

  const [{ data: profileData }, { data: filamentData }] = await Promise.all([
    supabase
      .from('print_profiles')
      .select('*')
      .in('printer_id', printerIds)
      .eq('is_active', true)
      .order('is_default', { ascending: false }),
    supabase
      .from('filaments')
      .select('*')
      .eq('owner_id', shop.id)
      .eq('in_stock', true)
      .order('color'),
  ])

  const profiles  = (profileData  ?? []) as unknown as PrintProfile[]
  const filaments = (filamentData ?? []) as unknown as Filament[]

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

  const customisationBadges: string[] = []
  if (item.allow_custom_text)    customisationBadges.push(item.text_prompt)
  if (item.allow_color_choice)   customisationBadges.push('Color choice')
  if (item.allow_resize)         customisationBadges.push(`${item.resize_min_pct}–${item.resize_max_pct}% resize`)
  if (item.allow_material_choice) customisationBadges.push('Material choice')

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link
        href={`/printers/${ownerId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {shop.name}
      </Link>

      {/* Product header */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Photo gallery / video / 3D viewer */}
        <ProductMediaGallery
          photoUrls={item.photo_urls?.length ? item.photo_urls : (item.photo_url ? [item.photo_url] : [])}
          videoUrl={item.video_url ?? null}
          stlUrls={item.stl_urls ?? []}
          name={item.name}
        />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{item.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{shop.name}</p>
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

      {/* 3D preview — only shown if no photos/video (gallery handles it when there are) */}
      {item.stl_urls?.length > 0 && !(item.photo_urls?.length || item.photo_url || item.video_url) && (
        <div className="mb-8">
          <STLViewer urls={item.stl_urls} />
        </div>
      )}

      <h2 className="mb-6 text-lg font-bold text-slate-900">Customise your order</h2>

      <CatalogOrderForm
        item={item}
        printer={requestPrinter}
        profiles={profiles}
        filaments={filaments}
      />
    </div>
  )
}
