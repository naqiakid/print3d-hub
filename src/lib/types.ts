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
export type PrintQuality = 'functional' | 'presentable' | 'display'
export type RequestStatus =
  | 'new'
  | 'quoted'
  | 'accepted'
  | 'printing'
  | 'done'
  | 'collected'
  | 'declined'
  | 'cancelled'
  | 'reviewed'

export type Printer = {
  id: string
  owner_id: string
  name: string
  description: string
  printer_model: string
  printer_model_id: string | null
  print_types: PrintType[]
  materials: FilamentMaterial[]
  max_size: PrintSize
  price_min: number
  price_max: number
  turnaround: string
  contact_phone: string
  sample_photos: string[]
  lat: number
  lng: number
  available: boolean
  rating: number
  review_count: number
  created_at: string
  electricity_rate: number | null
  filament_costs: FilamentCosts | null
  markup_percent: number | null
  power_watts: number | null
  grams_per_roll: number | null
  bed_type: string[] | null
  pickup_address: string | null
  delivery_available: boolean
  delivery_rate_per_km: number | null
  machine_rate_per_hour: number | null
  waste_percent: number | null
}

export type PlateFilament = {
  material: FilamentMaterial
  color: string
  color_hex: string
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
  printer_id: string
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
  created_at: string
}

export type PrintProfile = {
  id: string
  printer_id: string
  name: string
  nozzle_mm: number
  infill_draft: number
  infill_standard: number
  infill_premium: number
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
  created_at: string
}

export type CatalogItem = {
  id: string
  printer_id: string
  name: string
  description: string
  photo_url: string | null
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
  base_price: number | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export type Review = {
  id: string
  request_id: string
  printer_id: string
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
  functional:  'Functional — shape matters, surface marks are fine',
  presentable: 'Presentable — looks good, layer lines acceptable',
  display:     'Display quality — as close to the reference as possible',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New Request',
  quoted: 'Quote Sent',
  accepted: 'Accepted',
  printing: 'Printing',
  done: 'Ready for Pickup',
  collected: 'Collected',
  declined: 'Declined',
  cancelled: 'Cancelled',
  reviewed: 'Reviewed',
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  quoted: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  printing: 'bg-purple-100 text-purple-700',
  done: 'bg-teal-100 text-teal-700',
  collected: 'bg-slate-100 text-slate-600',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
  reviewed: 'bg-slate-100 text-slate-500',
}
