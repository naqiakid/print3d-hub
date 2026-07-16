export type FilamentMaterial = 'pla' | 'petg' | 'abs' | 'tpu' | 'nylon' | 'pc'

export type FilamentCosts = {
  pla?: number
  petg?: number
  abs?: number
  tpu?: number
  nylon?: number
  pc?: number
}

export type PrintType = 'everyday' | 'strong' | 'colorful'
/** @deprecated use FilamentMaterial */
export type MaterialFeel = FilamentMaterial
export type PrintSize = 'small' | 'medium' | 'large'
export type PrintQuality = 'basic' | 'advanced'
export type RequestStatus =
  | 'new'
  | 'quoted'
  | 'accepted'
  | 'printing'
  | 'done'
  | 'shipping'
  | 'collected'
  | 'declined'
  | 'cancelled'
  | 'reviewed'

// A shop is the public-facing business — one per owner. Customers pick a
// shop, not a specific machine; printers (below) are internal equipment.
export type Shop = {
  id: string // == owner_id == profiles.id == auth.users.id
  name: string
  description: string
  whatsapp: string
  print_types: PrintType[]
  materials: FilamentMaterial[]
  max_size: PrintSize
  price_min: number
  price_max: number
  turnaround: string
  sample_photos: string[]
  lat: number | null
  lng: number | null
  available: boolean
  rating: number
  review_count: number
  pickup_address: string | null
  delivery_available: boolean
  delivery_rate_per_km: number | null
  electricity_rate: number | null
  markup_percent: number | null
  waste_percent: number | null
  advanced_available: boolean
  created_at: string
}

// Combined shop + one representative machine's specs — used when a customer
// is requesting a print. The customer never picks a specific machine, but a
// live cost estimate needs one representative printer's cost drivers.
export type RequestPrinterView = Shop & Pick<Printer,
  'printer_model' | 'printer_model_id' | 'filament_costs' | 'power_watts' | 'machine_rate_per_hour' | 'bed_type' | 'grams_per_roll'
>

// A printer is equipment owned by a shop — not independently public.
export type Printer = {
  id: string
  owner_id: string
  printer_model: string
  printer_model_id: string | null
  materials: FilamentMaterial[]
  power_watts: number | null
  machine_rate_per_hour: number | null
  filament_costs: FilamentCosts | null
  grams_per_roll: number | null
  bed_type: string[] | null
  available: boolean
  created_at: string
}

export type PlateFilament = {
  material: FilamentMaterial
  color: string
  color_hex: string
  weight_g?: number | null
}

export type ColorPreference = {
  part_number: number
  part_index?: number
  part_name?: string
  file_name: string
  color: string
  color_hex: string
}

export type PrintRequest = {
  id: string
  owner_id: string
  printer_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  description: string
  model_url: string | null
  model_title: string | null
  model_image: string | null
  file_url: string | null
  stl_url: string | null
  stl_urls: string[]
  gcode_urls: string[]
  quote_model_url: string | null
  plate_filaments: PlateFilament[]
  color_preferences: ColorPreference[]
  weight_g: number | null
  print_hours: number | null
  print_type: PrintType
  material: FilamentMaterial
  color: string
  color_hex: string
  supports: boolean
  size: PrintSize
  quality: PrintQuality
  custom_infill: number | null
  custom_wall_count: number | null
  deadline: string
  notes: string
  profile_id: string | null
  selected_addons: string[]
  declined_addons: string[]
  confirmed_addons: string[]
  catalog_item_id: string | null
  fulfillment: 'pickup' | 'delivery'
  delivery_address: string | null
  status: RequestStatus
  quoted_price: number | null
  quoted_by_date: string | null
  quote_message: string | null
  delivery_cost: number | null
  created_at: string
}

export type PrintProfile = {
  id: string
  printer_id: string
  name: string
  nozzle_mm: number
  infill_basic: number
  wall_count_basic: number
  supports_available: boolean
  ironing_available: boolean
  color_change_available: boolean
  pause_insert_available: boolean
  fuzzy_skin_available: boolean
  text_on_surface_available: boolean
  is_default: boolean
  is_active: boolean
  created_at: string
}

export type Filament = {
  id: string
  owner_id: string
  material: FilamentMaterial
  brand: string
  color: string
  color_hex: string
  cost_per_kg: number
  in_stock: boolean
  grams_total: number | null
  grams_remaining: number | null
  low_stock_threshold_g: number
  created_at: string
}

export type CatalogItem = {
  id: string
  owner_id: string
  name: string
  description: string
  photo_url: string | null      // legacy single photo (kept for back-compat)
  photo_urls: string[]          // uploaded product photos
  video_url: string | null      // YouTube / direct video link
  model_url: string | null
  stl_urls: string[]
  allow_custom_text: boolean
  text_prompt: string
  allow_color_choice: boolean
  allow_resize: boolean
  resize_min_pct: number
  resize_max_pct: number
  allow_material_choice: boolean
  available_materials: string[]
  material_prices: Record<string, number>
  material: string | null
  color: string | null
  color_hex: string | null
  base_price: number | null
  category: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export type Review = {
  id: string
  request_id: string
  owner_id: string
  rating: number
  comment: string
  created_at: string
}

// ─── Display helpers ────────────────────────────────────────────

export const PRINT_TYPE_LABELS: Record<PrintType, string> = {
  everyday: 'Everyday / Decorative',
  strong: 'Strong / Functional',
  colorful: 'Multi-color',
}

export const PRINT_TYPE_DESCRIPTIONS: Record<PrintType, string> = {
  everyday: 'Hooks, cases, toys, everyday items',
  strong: 'Brackets, gears, mechanical parts',
  colorful: 'Multi-color designs and art',
}

export const MATERIAL_LABELS: Record<FilamentMaterial, string> = {
  pla:   'PLA',
  petg:  'PETG',
  abs:   'ABS',
  tpu:   'TPU',
  nylon: 'Nylon',
  pc:    'PC',
}

export const MATERIAL_DESCRIPTIONS: Record<FilamentMaterial, string> = {
  pla:   'Easiest to print · great for everyday items, decor & prototypes',
  petg:  'Moisture-resistant · functional parts, food-safe containers',
  abs:   'Heat & impact resistant · enclosures, durable parts',
  tpu:   'Flexible rubber-like · phone cases, gaskets, wearables',
  nylon: 'High-strength & wear-resistant · gears, hinges, load-bearing parts',
  pc:    'Engineering-grade · highest heat & impact resistance',
}

export const SIZE_LABELS: Record<PrintSize, string> = {
  small: 'Small (up to 10cm)',
  medium: 'Medium (up to 25cm)',
  large: 'Large (25cm+)',
}

export const QUALITY_LABELS: Record<PrintQuality, string> = {
  basic:    'Basic — standard settings',
  advanced: 'Advanced — higher infill & walls',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New Request',
  quoted: 'Quote Sent',
  accepted: 'Accepted',
  printing: 'Printing',
  done: 'Ready for Pickup',
  shipping: 'Shipped',
  collected: 'Collected',
  declined: 'Declined',
  cancelled: 'Cancelled',
  reviewed: 'Reviewed',
}

export function getStatusLabel(status: RequestStatus, fulfillment?: 'pickup' | 'delivery' | null): string {
  if (status === 'done' && fulfillment === 'delivery') return 'Ready for Delivery'
  if (status === 'collected' && fulfillment === 'delivery') return 'Delivered'
  return STATUS_LABELS[status]
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  quoted: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  printing: 'bg-purple-100 text-purple-700',
  done: 'bg-teal-100 text-teal-700',
  shipping: 'bg-blue-100 text-blue-700',
  collected: 'bg-slate-100 text-slate-600',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
  reviewed: 'bg-slate-100 text-slate-500',
}

export function getWhatsAppLink(phone: string, message: string): string {
  let cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '60' + cleanPhone.slice(1)
  } else if (!cleanPhone.startsWith('60') && (cleanPhone.length === 9 || cleanPhone.length === 10)) {
    cleanPhone = '60' + cleanPhone
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

export interface PartAssembly {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
}

export function parseAssemblyMetadata(description: string | null | undefined): PartAssembly[] {
  if (!description) return []
  const match = description.match(/<!-- ASSEMBLY_METADATA: (.*?) -->/)
  if (match) {
    try {
      return JSON.parse(match[1])
    } catch {
      return []
    }
  }
  return []
}

export function cleanDescription(description: string | null | undefined): string {
  if (!description) return ''
  return description.replace(/\s*<!-- ASSEMBLY_METADATA: .*? -->/g, '').trim()
}

export function serializeAssemblyMetadata(description: string, metadata: PartAssembly[]): string {
  const clean = cleanDescription(description)
  return `${clean}\n\n<!-- ASSEMBLY_METADATA: ${JSON.stringify(metadata)} -->`
}

export function getDirectDownloadUrl(url: string | null | undefined): string {
  if (!url) return ''
  
  // Dropbox link conversion (change dl=0 to raw=1)
  if (url.includes('dropbox.com')) {
    return url.replace(/[?&]dl=0/g, '?raw=1').replace(/[?&]dl=1/g, '?raw=1')
  }
  
  // Google Drive link conversion (extract ID and route via CORS proxy)
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (driveMatch && driveMatch[1]) {
    const rawUrl = `https://docs.google.com/uc?export=download&id=${driveMatch[1]}`
    return `/api/proxy-file?url=${encodeURIComponent(rawUrl)}`
  }
  
  return url
}

export function isPreviewFile(url: string | null | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return (
    lower.includes('drive.google.com') ||
    lower.includes('dropbox.com') ||
    lower.endsWith('.3mf') ||
    lower.includes('.3mf')
  )
}
