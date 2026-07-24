import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, CatalogItem, PrintProfile, Filament, RequestPrinterView } from '@/lib/types'
import CatalogOrderForm from '@/components/CatalogOrderFormWrapper'
import STLViewer from '@/components/STLViewerWrapper'
import ProductMediaGallery from '@/components/ProductMediaGallery'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ownerId: string; itemId: string }>
}): Promise<Metadata> {
  const { itemId } = await params
  const supabase = await createClient()
  const { data: item } = await supabase.from('catalog_items').select('name, description').eq('id', itemId).maybeSingle()
  
  if (!item) return { title: 'Order Custom 3D Print' }
  
  const cleanDesc = item.description ? item.description.replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 150) : ''
  
  return {
    title: `Order ${item.name} | Custom 3D Printed`,
    description: cleanDesc || `Customise and order ${item.name} from a local 3D printer owner near you.`,
    openGraph: {
      title: `Order ${item.name} | Custom 3D Printed`,
      description: cleanDesc || `Customise and order ${item.name} from a local 3D printer owner near you.`,
      type: 'website',
    }
  }
}

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
    <div className="mx-auto max-w-xl lg:max-w-7xl px-4 py-10 sm:px-6">
      {/* Product Structured Data for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": item.name,
            "image": item.photo_urls?.[0] || item.photo_url || '',
            "description": item.description ? item.description.replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 150) : '',
            "offers": {
              "@type": "Offer",
              "price": item.base_price || 0,
              "priceCurrency": "MYR",
              "availability": "https://schema.org/InStock"
            }
          })
        }}
      />
      <Link
        href={`/printers/${ownerId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {shop.name}
      </Link>

      <CatalogOrderForm
        item={item}
        printer={requestPrinter}
        profiles={profiles}
        filaments={filaments}
        shopName={shop.name}
      />
    </div>
  )
}
