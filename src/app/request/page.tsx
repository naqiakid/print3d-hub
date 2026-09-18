import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, PrintProfile, Filament, RequestPrinterView } from '@/lib/types'
import { PRINTER_MODELS } from '@/lib/printer-models'
import RequestForm from '@/components/RequestFormWrapper'

export const metadata: Metadata = {
  title: 'Request a Custom 3D Print | Qid3D Studio',
  description: 'Upload your 3D files (STL, 3MF, OBJ) for custom 3D printing in PLA, PETG, or flexible TPU at Qid3D Studio (Ampang, Selangor).',
}

import { STUDIO_CONFIG } from '@/config/studio'
import { getStudioFilamentsAsFilaments } from '@/config/materials'

const fallbackPrinter: RequestPrinterView = {
  id: 'qid-primary',
  name: STUDIO_CONFIG.name,
  description: `${STUDIO_CONFIG.tagline} based in ${STUDIO_CONFIG.city}, ${STUDIO_CONFIG.state}.`,
  whatsapp: STUDIO_CONFIG.whatsappNumber,
  print_types: ['everyday', 'strong'],
  materials: ['pla', 'petg', 'tpu'],
  max_size: 'large',
  price_min: 15,
  price_max: 200,
  turnaround: '24-48 Hours',
  sample_photos: [],
  lat: 3.1499,
  lng: 101.7617,
  available: true,
  rating: 5.0,
  review_count: 12,
  pickup_address: STUDIO_CONFIG.pickupAddress,
  delivery_available: true,
  delivery_rate_per_km: STUDIO_CONFIG.shipping.runner.ratePerKm,
  electricity_rate: 0.57,
  markup_percent: 30,
  waste_percent: 8,
  advanced_available: true,
  created_at: new Date().toISOString(),
  printer_model: `${STUDIO_CONFIG.printer.brand} ${STUDIO_CONFIG.printer.model}`,
  printer_model_id: 'creality-ender3-v3-se',
  filament_costs: { pla: 55, petg: 65, tpu: 85 },
  power_watts: STUDIO_CONFIG.printer.powerWatts,
  machine_rate_per_hour: 1.5,
  bed_type: ['textured_pei'],
  grams_per_roll: 1000,
}

const fallbackProfiles: PrintProfile[] = [
  {
    id: 'prof-std',
    printer_id: 'qid-primary',
    name: 'Standard (0.2mm - 20% Infill)',
    nozzle_mm: 0.4,
    infill_basic: 20,
    wall_count_basic: 3,
    supports_available: true,
    ironing_available: true,
    color_change_available: true,
    pause_insert_available: true,
    fuzzy_skin_available: true,
    text_on_surface_available: true,
    is_default: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'prof-strong',
    printer_id: 'qid-primary',
    name: 'Functional High-Strength (0.2mm - 50% Infill)',
    nozzle_mm: 0.4,
    infill_basic: 50,
    wall_count_basic: 4,
    supports_available: true,
    ironing_available: false,
    color_change_available: false,
    pause_insert_available: true,
    fuzzy_skin_available: false,
    text_on_surface_available: false,
    is_default: false,
    is_active: true,
    created_at: new Date().toISOString(),
  },
]

const fallbackFilaments: Filament[] = getStudioFilamentsAsFilaments('qid-primary')

export default async function DirectRequestPage() {
  const supabase = await createClient()

  const { data: shopData } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let shop = (shopData as unknown as Shop) || null
  let primaryPrinter: Printer | null = null
  let profiles: PrintProfile[] = fallbackProfiles
  let filaments: Filament[] = fallbackFilaments

  if (shop) {
    const { data: printerRows } = await supabase
      .from('printers')
      .select('*')
      .eq('owner_id', shop.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (printerRows && printerRows.length > 0) {
      primaryPrinter = printerRows[0] as unknown as Printer

      const { data: profilesData } = await supabase
        .from('print_profiles')
        .select('*')
        .eq('printer_id', primaryPrinter.id)
        .order('is_default', { ascending: false })

      if (profilesData && profilesData.length > 0) {
        profiles = profilesData as unknown as PrintProfile[]
      }

      const { data: filamentsData } = await supabase
        .from('filaments')
        .select('*')
        .eq('owner_id', shop.id)
        .eq('in_stock', true)
        .order('material')

      if (filamentsData && filamentsData.length > 0) {
        filaments = filamentsData as unknown as Filament[]
      }
    }
  }

  const requestPrinter: RequestPrinterView = (shop && primaryPrinter)
    ? {
        ...shop,
        printer_model: primaryPrinter.printer_model,
        printer_model_id: primaryPrinter.printer_model_id,
        filament_costs: primaryPrinter.filament_costs,
        power_watts: primaryPrinter.power_watts,
        machine_rate_per_hour: primaryPrinter.machine_rate_per_hour,
        bed_type: primaryPrinter.bed_type,
        grams_per_roll: primaryPrinter.grams_per_roll,
      }
    : fallbackPrinter

  const buildVolume = requestPrinter.printer_model_id
    ? (PRINTER_MODELS.find((m) => m.id === requestPrinter.printer_model_id)?.build_volume ?? '220 × 220 × 250 mm')
    : '220 × 220 × 250 mm'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 mb-2">
          <span>Creality Ender-3 V3 SE · Direct Drive Sprite</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
          Custom 3D Print Request
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload your files and select your filament specifications. We review every model to ensure clean layer adhesion and structural integrity.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <RequestForm
          printer={requestPrinter}
          profiles={profiles}
          buildVolume={buildVolume}
          filaments={filaments}
        />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <p>🔒 No account required · Secure tracking link provided on submission</p>
        <p>📍 Ampang, Selangor · Semenanjung &amp; East Malaysia</p>
      </div>
    </div>
  )
}
