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

export function parseMeshMapping(description: string | null | undefined): Record<number, number> {
  if (!description) return {}
  const match = description.match(/<!-- MESH_MAPPING: (.*?) -->/)
  if (match) {
    try {
      return JSON.parse(match[1])
    } catch {
      return {}
    }
  }
  return {}
}

export function parseAllowedFilaments(description: string | null | undefined): string[] {
  if (!description) return []
  const match = description.match(/<!-- ALLOWED_FILAMENTS: (.*?) -->/)
  if (match) {
    try {
      return JSON.parse(match[1])
    } catch {
      return []
    }
  }
  return []
}

export function parseTextMeshIndex(description: string | null | undefined): number | null {
  if (!description) return null
  const match = description.match(/<!-- TEXT_MESH_INDEX: (.*?) -->/)
  if (match) {
    const parsed = parseInt(match[1], 10)
    return isNaN(parsed) ? null : parsed
  }
  return null
}

export interface DesignerMetadata {
  name?: string
  tipUrl?: string
  license?: string
  commercialAllowed?: boolean
}

export function parseDesignerMetadata(description: string | null | undefined): DesignerMetadata | null {
  if (!description) return null
  const match = description.match(/<!-- DESIGNER_METADATA: (.*?) -->/)
  if (match) {
    try {
      return JSON.parse(match[1])
    } catch {
      return null
    }
  }
  return null
}

export function cleanDescription(description: string | null | undefined): string {
  if (!description) return ''
  return description
    .replace(/\s*<!-- ASSEMBLY_METADATA: .*? -->/g, '')
    .replace(/\s*<!-- MESH_MAPPING: .*? -->/g, '')
    .replace(/\s*<!-- ALLOWED_FILAMENTS: .*? -->/g, '')
    .replace(/\s*<!-- TEXT_MESH_INDEX: .*? -->/g, '')
    .replace(/\s*<!-- GCODE_STATS: .*? -->/g, '')
    .replace(/\s*<!-- DESIGNER_METADATA: .*? -->/g, '')
    .trim()
}

export function stripHtml(description: string | null | undefined): string {
  if (!description) return ''
  const clean = cleanDescription(description)
  return clean
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function serializeAssemblyMetadata(
  description: string,
  metadata: PartAssembly[],
  meshMapping?: Record<number, number>,
  allowedFilaments?: string[],
  textMeshIndex?: number | null
): string {
  const clean = cleanDescription(description)
  let result = clean
  if (metadata && metadata.length > 0) {
    result += `\n\n<!-- ASSEMBLY_METADATA: ${JSON.stringify(metadata)} -->`
  }
  if (meshMapping && Object.keys(meshMapping).length > 0) {
    result += `\n\n<!-- MESH_MAPPING: ${JSON.stringify(meshMapping)} -->`
  }
  if (allowedFilaments && allowedFilaments.length > 0) {
    result += `\n\n<!-- ALLOWED_FILAMENTS: ${JSON.stringify(allowedFilaments)} -->`
  }
  if (textMeshIndex !== undefined && textMeshIndex !== null) {
    result += `\n\n<!-- TEXT_MESH_INDEX: ${textMeshIndex} -->`
  }
  return result
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

  // Explicit override flags in URL hash or query params
  if (lower.includes('#part') || lower.includes('?part') || lower.includes('&part')) {
    return false
  }
  if (lower.includes('#preview') || lower.includes('?preview') || lower.includes('&preview')) {
    return true
  }

  // Filename contains preview/assemble keywords
  if (lower.includes('preview') || lower.includes('assemble') || lower.includes('assembly')) {
    return true
  }

  // Google Drive and Dropbox links default to preview files if they don't have .stl anywhere
  if (lower.includes('drive.google.com') || lower.includes('dropbox.com')) {
    if (lower.includes('.stl')) return false
    return true
  }

  return (
    lower.endsWith('.3mf') ||
    lower.includes('.3mf')
  )
}

export interface RotationOffset {
  rx: number
  ry: number
  rz: number
}

export function parseUrlRotation(url: string | null | undefined): RotationOffset {
  const result = { rx: 0, ry: 0, rz: 0 }
  if (!url) return result
  const hash = url.split('#')[1]
  if (!hash) return result

  const params = new URLSearchParams(hash)
  const rx = parseFloat(params.get('rx') || '0')
  const ry = parseFloat(params.get('ry') || '0')
  const rz = parseFloat(params.get('rz') || '0')

  result.rx = isNaN(rx) ? 0 : rx
  result.ry = isNaN(ry) ? 0 : ry
  result.rz = isNaN(rz) ? 0 : rz
  return result
}

export interface TranslationOffset {
  x: number
  y: number
  z: number
}

export function parseUrlTranslation(url: string | null | undefined): TranslationOffset {
  const result = { x: 0, y: 0, z: 0 }
  if (!url) return result
  const hash = url.split('#')[1]
  if (!hash) return result

  const params = new URLSearchParams(hash)
  const x = parseFloat(params.get('x') || '0')
  const y = parseFloat(params.get('y') || '0')
  const z = parseFloat(params.get('z') || '0')

  result.x = isNaN(x) ? 0 : x
  result.y = isNaN(y) ? 0 : y
  result.z = isNaN(z) ? 0 : z
  return result
}


export const COLOR_PRESETS = [
  { name: 'Black',   hex: '#1a1a1a' },
  { name: 'White',   hex: '#f5f5f5' },
  { name: 'Grey',    hex: '#6b7280' },
  { name: 'Natural', hex: '#d4b896' },
  { name: 'Red',     hex: '#dc2626' },
  { name: 'Blue',    hex: '#2563eb' },
  { name: 'Green',   hex: '#16a34a' },
  { name: 'Yellow',  hex: '#ca8a04' },
  { name: 'Orange',  hex: '#ea580c' },
  { name: 'Purple',  hex: '#7c3aed' },
]

export function getColorHexByName(colorName: string): string {
  const clean = colorName.trim().toLowerCase()
  if (clean === 'any' || clean === 'owner decides') return '#888888'
  
  if (clean.includes('white')) return '#ffffff'
  if (clean.includes('black')) return '#1a1a1a'
  if (clean.includes('grey') || clean.includes('gray')) return '#6b7280'
  if (clean.includes('red')) return '#dc2626'
  if (clean.includes('orange')) return '#f97316'
  if (clean.includes('yellow')) return '#eab308'
  if (clean.includes('green')) return '#22c55e'
  if (clean.includes('blue')) return '#3b82f6'
  if (clean.includes('purple')) return '#a855f7'
  if (clean.includes('pink')) return '#ec4899'
  if (clean.includes('gold')) return '#ffd700'
  if (clean.includes('silver')) return '#c0c0c0'
  if (clean.includes('bronze')) return '#cd7f32'
  if (clean.includes('copper')) return '#b87333'
  
  const colorMap: Record<string, string> = {
    amber: '#f59e0b',
    lime: '#84cc16',
    emerald: '#10b981',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    sky: '#0ea5e9',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    fuchsia: '#d946ef',
    rose: '#f43f5e',
    slate: '#64748b',
    zinc: '#71717a',
    neutral: '#737373',
    stone: '#78716c',
    brown: '#78350f',
  }
  return colorMap[clean] || '#888888'
}

export type GcodeStats = {
  weight_g: number
  hours: number
}

export function parseGcodeStats(description: string | null | undefined): GcodeStats | null {
  if (!description) return null
  const match = description.match(/<!-- GCODE_STATS: (\{.*?\}) -->/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export function serializeGcodeStats(stats: GcodeStats | null | undefined): string {
  if (!stats) return ''
  return `<!-- GCODE_STATS: ${JSON.stringify(stats)} -->`
}
