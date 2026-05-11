export type FilamentCosts = {
  rigid?: number
  flexible?: number
  tough?: number
}

export type PrintType = 'everyday' | 'strong' | 'colorful'
export type MaterialFeel = 'rigid' | 'flexible' | 'tough'
export type PrintSize = 'small' | 'medium' | 'large'
export type PrintQuality = 'draft' | 'standard' | 'premium'
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
  print_types: PrintType[]
  materials: MaterialFeel[]
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
}

export type PrintRequest = {
  id: string
  printer_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  description: string
  file_url: string | null
  print_type: PrintType
  material: MaterialFeel
  size: PrintSize
  quality: PrintQuality
  deadline: string
  notes: string
  status: RequestStatus
  quoted_price: number | null
  quoted_by_date: string | null
  quote_message: string | null
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
  everyday: ' Everyday',
  strong: ' Strong',
  colorful: ' Colorful',
}

export const PRINT_TYPE_DESCRIPTIONS: Record<PrintType, string> = {
  everyday: 'Hooks, cases, toys, everyday items',
  strong: 'Brackets, gears, mechanical parts',
  colorful: 'Multi-color designs and art',
}

export const MATERIAL_LABELS: Record<MaterialFeel, string> = {
  rigid: 'Rigid',
  flexible: 'Flexible',
  tough: 'Tough',
}

export const MATERIAL_DESCRIPTIONS: Record<MaterialFeel, string> = {
  rigid: 'Hard standard plastic (PLA, PETG, ABS)',
  flexible: 'Bendy, rubber-like (TPU)',
  tough: 'Impact & heat resistant (Nylon, PC)',
}

export const SIZE_LABELS: Record<PrintSize, string> = {
  small: 'Small (up to 10cm)',
  medium: 'Medium (up to 25cm)',
  large: 'Large (25cm+)',
}

export const QUALITY_LABELS: Record<PrintQuality, string> = {
  draft: 'Draft — faster, rougher finish',
  standard: 'Standard — balanced quality',
  premium: 'Premium — slow, smooth finish',
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
