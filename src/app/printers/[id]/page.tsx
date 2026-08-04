import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseDesignerMetadata } from '@/lib/types'
import type { Shop, Printer, Filament, PrintProfile, CatalogItem, Review, RequestPrinterView } from '@/lib/types'
import PrinterProfileView from '@/components/PrinterProfileView'
import { PRINTER_MODELS } from '@/lib/printer-models'
import { DEFAULT_MACHINE_RATE } from '@/lib/pricing'

// Match a saved printer_model string to a preset
function findPreset(printerModel: string) {
  const norm = printerModel.toLowerCase()
  return PRINTER_MODELS.find(
    (p) =>
      `${p.brand} ${p.name}`.toLowerCase() === norm ||
      norm === p.name.toLowerCase() ||
      norm.includes(p.name.toLowerCase()),
  )
}



export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('name, turnaround').eq('id', id).maybeSingle()
  
  if (!data) return { title: 'Maker Hub Profile' }
  
  return {
    title: `${data.name} | Local 3D Printing Service`,
    description: `Order custom 3D prints from ${data.name} locally. Active 3D printer hub offering fast ${data.turnaround} turnaround.`,
    openGraph: {
      title: `${data.name} | Local 3D Printing Service`,
      description: `Order custom 3D prints from ${data.name} locally. Active 3D printer hub offering fast ${data.turnaround} turnaround.`,
      type: 'website',
    }
  }
}

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const shop = data as unknown as Shop

  const { data: printerData } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', shop.id)
    .order('created_at', { ascending: true })
  const printers = (printerData ?? []) as unknown as Printer[]
  const printerIds = printers.map((p) => p.id)

  const [{ data: filamentData }, { data: profileData }, { data: catalogData }, { data: reviewData }] = await Promise.all([
    supabase
      .from('filaments')
      .select('*')
      .eq('owner_id', shop.id)
      .eq('in_stock', true)
      .order('material')
      .order('color'),
    printerIds.length
      ? supabase
          .from('print_profiles')
          .select('*')
          .in('printer_id', printerIds)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('catalog_items')
      .select('*')
      .eq('owner_id', shop.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('reviews')
      .select('*')
      .eq('owner_id', shop.id)
      .neq('comment', '')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const filaments = (filamentData ?? []) as unknown as Filament[]
  const profiles  = (profileData  ?? []) as unknown as PrintProfile[]
  const catalog   = ((catalogData  ?? []) as unknown as CatalogItem[]).filter((item) => {
    const designer = parseDesignerMetadata(item.description)
    const isUnverified = (designer?.license ?? '').includes('License Unverified') || (designer?.license ?? '').includes('Check Manually')
    const commercialAllowed = designer?.commercialAllowed ?? true
    
    let permissionStatus = item.permission_status || designer?.permissionStatus
    if (!permissionStatus) {
      if (!commercialAllowed || isUnverified) {
        permissionStatus = 'pending_permission'
      } else {
        permissionStatus = 'not_required'
      }
    }
    return permissionStatus === 'approved' || permissionStatus === 'not_required'
  })
  const reviews   = (reviewData   ?? []) as unknown as Review[]

  // Hero visual takes its brand/image from the first (oldest) machine —
  // purely cosmetic; per-machine specs live in the Equipment section below.
  const heroPrinter = printers[0]
  const preset = heroPrinter ? findPreset(heroPrinter.printer_model) : undefined

  // Group filaments by material
  const filamentsByMaterial = filaments.reduce<Record<string, Filament[]>>((acc, f) => {
    if (!acc[f.material]) acc[f.material] = []
    acc[f.material].push(f)
    return acc
  }, {})

  // Unique nozzle sizes across every machine's profiles
  const nozzleSizes = [...new Set(profiles.map((p) => p.nozzle_mm))].sort()

  // Aggregate capabilities across all profiles
  const hasCap = (key: keyof PrintProfile) => profiles.some((p) => p[key] === true)

  // Union of bed types across all machines
  const bedTypes = [...new Set(printers.flatMap((p) => p.bed_type ?? []))]

  const requestPrinter: RequestPrinterView = {
    ...shop,
    printer_model: heroPrinter?.printer_model ?? 'Standard Printer',
    printer_model_id: heroPrinter?.printer_model_id ?? null,
    filament_costs: heroPrinter?.filament_costs ?? {},
    power_watts: heroPrinter?.power_watts ?? 350,
    machine_rate_per_hour: heroPrinter?.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE,
    bed_type: heroPrinter?.bed_type ?? [],
    grams_per_roll: heroPrinter?.grams_per_roll ?? 1000,
  }

  return (
    <>
      {/* Local Business Structured Data for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": shop.name,
            "image": shop.sample_photos?.[0] || preset?.image_url || '',
            "priceRange": shop.price_min === 0 && shop.price_max === 0 ? "Quote on request" : `RM${shop.price_min} - RM${shop.price_max}`,
            "address": {
              "@type": "PostalAddress",
              "streetAddress": shop.pickup_address || '',
              "addressCountry": "MY"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": shop.rating || 5,
              "reviewCount": shop.review_count || 1
            }
          })
        }}
      />
      <PrinterProfileView
        shop={shop}
        printers={printers}
        filaments={filaments}
        profiles={profiles}
        catalog={catalog}
        reviews={reviews}
        requestPrinter={requestPrinter}
        filamentsByMaterial={filamentsByMaterial}
        nozzleSizes={nozzleSizes}
        bedTypes={bedTypes}
      />
    </>
  )
}
