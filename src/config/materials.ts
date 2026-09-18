import type { Filament, FilamentMaterial } from '@/lib/types'

export interface SpoolConfig {
  id: string
  material: FilamentMaterial
  brand: string
  color: string
  colorHex: string
  costPerKg: number // RM per 1000g spool
  inStock: boolean
  gramsRemaining?: number
  finish: 'satin' | 'glossy' | 'rubber' | 'matte'
  recommendedFor: string
}

export interface MaterialMeta {
  material: FilamentMaterial
  label: string
  tagline: string
  baseCostPerKg: number
  pbrRoughness: number
  pbrMetalness: number
  description: string
  features: string[]
}

export const MATERIAL_METAS: Record<FilamentMaterial, MaterialMeta> = {
  pla: {
    material: 'pla',
    label: 'PLA (Polylactic Acid)',
    tagline: 'Crisp detail & vibrant colors for figurines, anime models & prototypes',
    baseCostPerKg: 55,
    pbrRoughness: 0.45,
    pbrMetalness: 0.04,
    description: 'Crisp layer lines, excellent dimensional accuracy, and rigid strength. Ideal for display models, cosplay props, and visual prototypes.',
    features: ['High dimensional accuracy', 'Biodegradable organic corn base', 'Best aesthetic surface finish'],
  },
  petg: {
    material: 'petg',
    label: 'PETG (Polyethylene Terephthalate)',
    tagline: 'High-strength & heat resistant (up to ~75°C) for car parts & brackets',
    baseCostPerKg: 65,
    pbrRoughness: 0.25,
    pbrMetalness: 0.12,
    description: 'Durable and impact-resistant with superior chemical, water, and UV resistance. Resists deformation in hot Malaysian car interiors.',
    features: ['Heat resistant up to ~75°C', 'UV & weather proof', 'Excellent layer adhesion & impact durability'],
  },
  tpu: {
    material: 'tpu',
    label: 'TPU (Flexible 95A Polyurethane)',
    tagline: 'Bendable, rubber-like shock absorption for phone cases & drone bumpers',
    baseCostPerKg: 85,
    pbrRoughness: 0.85,
    pbrMetalness: 0.02,
    description: 'Shore 95A elastomer offering rubber-like flexibility, high tear resistance, and vibration dampening. Feeds flawlessly via Sprite Direct Drive.',
    features: ['Shore 95A rubber-like flexibility', 'Shock absorption & impact damping', 'Will not crack or shatter on bending'],
  },
  abs: {
    material: 'abs',
    label: 'ABS',
    tagline: 'High temperature engineering plastic',
    baseCostPerKg: 65,
    pbrRoughness: 0.5,
    pbrMetalness: 0.05,
    description: 'Requires enclosed chamber for warping control.',
    features: ['High heat resistance', 'Acetone smoothing capable'],
  },
  nylon: {
    material: 'nylon',
    label: 'Nylon',
    tagline: 'Industrial wear-resistant gears',
    baseCostPerKg: 120,
    pbrRoughness: 0.6,
    pbrMetalness: 0.05,
    description: 'Engineering grade high wear resistance.',
    features: ['High tensile strength', 'Self-lubricating'],
  },
  pc: {
    material: 'pc',
    label: 'Polycarbonate',
    tagline: 'High impact engineering grade',
    baseCostPerKg: 140,
    pbrRoughness: 0.4,
    pbrMetalness: 0.1,
    description: 'Extreme thermal and impact resistance.',
    features: ['Extreme temperature resistance', 'Shatter resistant'],
  },
}

/**
 * Active Studio Filament Spools
 * Edit this list to add new colors, update prices, or mark spools in/out of stock.
 */
export const STUDIO_FILAMENTS: SpoolConfig[] = [
  // ── PLA Spools ──
  {
    id: 'spool-pla-black',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Matte Black',
    colorHex: '#1a1a1a',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 850,
    finish: 'matte',
    recommendedFor: 'Gaming figures, tech brackets, stealth aesthetics',
  },
  {
    id: 'spool-pla-white',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Pure White',
    colorHex: '#f8fafc',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 920,
    finish: 'satin',
    recommendedFor: 'Architectural models, paintable figurines, lithophanes',
  },
  {
    id: 'spool-pla-grey',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Titanium Grey',
    colorHex: '#64748b',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 700,
    finish: 'satin',
    recommendedFor: 'Mechanical parts, prototypes, industrial look',
  },
  {
    id: 'spool-pla-red',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Crimson Red',
    colorHex: '#dc2626',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 600,
    finish: 'satin',
    recommendedFor: 'Decorative accents, warning tags, anime figures',
  },
  {
    id: 'spool-pla-blue',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Royal Blue',
    colorHex: '#2563eb',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 550,
    finish: 'satin',
    recommendedFor: 'Keychains, custom enclosures, desk toys',
  },
  {
    id: 'spool-pla-yellow',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Signal Yellow',
    colorHex: '#eab308',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 400,
    finish: 'satin',
    recommendedFor: 'Safety tools, cosplay props',
  },
  {
    id: 'spool-pla-orange',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Vibrant Orange',
    colorHex: '#ea580c',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 650,
    finish: 'satin',
    recommendedFor: 'Maker logos, bright accents',
  },
  {
    id: 'spool-pla-green',
    material: 'pla',
    brand: 'eSUN PLA+',
    color: 'Forest Green',
    colorHex: '#16a34a',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 500,
    finish: 'satin',
    recommendedFor: 'Planters, outdoor items, miniature terrain',
  },

  // ── PETG Spools ──
  {
    id: 'spool-petg-black',
    material: 'petg',
    brand: 'eSUN PETG',
    color: 'Solid Black',
    colorHex: '#1a1a1a',
    costPerKg: 65,
    inStock: true,
    gramsRemaining: 800,
    finish: 'glossy',
    recommendedFor: 'Car phone mounts, outdoor brackets, waterproof parts',
  },
  {
    id: 'spool-petg-white',
    material: 'petg',
    brand: 'eSUN PETG',
    color: 'Clean White',
    colorHex: '#f8fafc',
    costPerKg: 65,
    inStock: true,
    gramsRemaining: 750,
    finish: 'glossy',
    recommendedFor: 'Kitchen organizers, bathroom brackets',
  },
  {
    id: 'spool-petg-grey',
    material: 'petg',
    brand: 'eSUN PETG',
    color: 'Industrial Grey',
    colorHex: '#475569',
    costPerKg: 65,
    inStock: true,
    gramsRemaining: 600,
    finish: 'glossy',
    recommendedFor: 'Heavy duty functional parts, tool hooks',
  },
  {
    id: 'spool-petg-blue',
    material: 'petg',
    brand: 'eSUN PETG',
    color: 'Deep Blue',
    colorHex: '#1d4ed8',
    costPerKg: 65,
    inStock: true,
    gramsRemaining: 450,
    finish: 'glossy',
    recommendedFor: 'Aquarium accessories, outdoor enclosures',
  },
  {
    id: 'spool-petg-orange',
    material: 'petg',
    brand: 'eSUN PETG',
    color: 'Signal Orange',
    colorHex: '#ea580c',
    costPerKg: 65,
    inStock: true,
    gramsRemaining: 500,
    finish: 'glossy',
    recommendedFor: 'High-visibility safety gear, workshop tools',
  },
  {
    id: 'spool-petg-clear',
    material: 'petg',
    brand: 'eSUN PETG',
    color: 'Translucent Clear',
    colorHex: '#e2e8f0',
    costPerKg: 65,
    inStock: true,
    gramsRemaining: 650,
    finish: 'glossy',
    recommendedFor: 'Light diffusers, lamp shades, fluid containers',
  },

  // ── TPU (Flexible 95A) Spools ──
  {
    id: 'spool-tpu-black',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible Black',
    colorHex: '#262626',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 600,
    finish: 'rubber',
    recommendedFor: 'Drone landing pads, shock dampeners, phone cases, gaskets',
  },
  {
    id: 'spool-tpu-white',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible White',
    colorHex: '#f1f5f9',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 500,
    finish: 'rubber',
    recommendedFor: 'Foot pads, watch bands, flexible prototypes',
  },
  {
    id: 'spool-tpu-red',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible Red',
    colorHex: '#b91c1c',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 400,
    finish: 'rubber',
    recommendedFor: 'High-visibility bump guards, RC bumpers',
  },
  {
    id: 'spool-tpu-blue',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible Blue',
    colorHex: '#1e40af',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 450,
    finish: 'rubber',
    recommendedFor: 'Protective casing, flexible grips',
  },
  {
    id: 'spool-tpu-orange',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible Orange',
    colorHex: '#c2410c',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 350,
    finish: 'rubber',
    recommendedFor: 'FPV quadcopter antenna mounts, action cam cases',
  },
]

/**
 * Converts SpoolConfig to the existing Filament type for DB & UI interoperability
 */
export function getStudioFilamentsAsFilaments(ownerId = 'qid-primary'): Filament[] {
  return STUDIO_FILAMENTS.map((s) => ({
    id: s.id,
    owner_id: ownerId,
    material: s.material,
    brand: s.brand,
    color: s.color,
    color_hex: s.colorHex,
    cost_per_kg: s.costPerKg,
    in_stock: s.inStock,
    grams_total: 1000,
    grams_remaining: s.gramsRemaining ?? 1000,
    low_stock_threshold_g: 200,
    created_at: new Date().toISOString(),
  }))
}

export function getInStockFilaments(material?: FilamentMaterial): SpoolConfig[] {
  return STUDIO_FILAMENTS.filter((s) => s.inStock && (!material || s.material === material))
}

export function getColorsForMaterial(material: FilamentMaterial): { name: string; hex: string }[] {
  const inStock = STUDIO_FILAMENTS.filter((s) => s.material === material && s.inStock)
  if (inStock.length > 0) {
    return inStock.map((s) => ({ name: s.color, hex: s.colorHex }))
  }
  return STUDIO_FILAMENTS.filter((s) => s.material === material).map((s) => ({ name: s.color, hex: s.colorHex }))
}
