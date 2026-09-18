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
  // ── PLA Spools (3MF Studio Stock) ──
  {
    id: 'spool-pla-matte-black',
    material: 'pla',
    brand: 'eSUN Matte PLA',
    color: 'Matte Black',
    colorHex: '#1a1a1a',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'matte',
    recommendedFor: 'Gaming figures, tech brackets, stealth aesthetics',
  },
  {
    id: 'spool-pla-matte-white',
    material: 'pla',
    brand: 'eSUN Matte PLA',
    color: 'Matte White',
    colorHex: '#f8fafc',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'matte',
    recommendedFor: 'Architectural models, paintable figurines, lithophanes',
  },
  {
    id: 'spool-pla-matte-grey',
    material: 'pla',
    brand: 'eSUN Matte PLA',
    color: 'Matte Grey',
    colorHex: '#64748b',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'matte',
    recommendedFor: 'Mechanical parts, prototypes, industrial finish',
  },
  {
    id: 'spool-pla-matte-brown',
    material: 'pla',
    brand: 'eSUN Matte PLA',
    color: 'Matte Brown',
    colorHex: '#78350f',
    costPerKg: 55,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'matte',
    recommendedFor: 'Wood-like textures, organic figurines, vintage decor',
  },

  // ── PETG Spools (3MF Studio Stock) ──
  {
    id: 'spool-petg-red',
    material: 'petg',
    brand: 'Sunlu PETG',
    color: 'Solid Red',
    colorHex: '#dc2626',
    costPerKg: 65,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'glossy',
    recommendedFor: 'Car phone mounts, outdoor brackets, waterproof parts',
  },

  // ── TPU (Flexible 95A) Spools (3MF Studio Stock) ──
  {
    id: 'spool-tpu-black',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible Black',
    colorHex: '#18181b',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'rubber',
    recommendedFor: 'Drone landing pads, shock dampeners, phone cases, gaskets',
  },
  {
    id: 'spool-tpu-white',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible White',
    colorHex: '#ffffff',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'rubber',
    recommendedFor: 'Foot pads, watch bands, flexible prototypes',
  },
  {
    id: 'spool-tpu-red',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Flexible Red',
    colorHex: '#ef4444',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'rubber',
    recommendedFor: 'High-visibility bump guards, RC bumpers',
  },
  {
    id: 'spool-tpu-dark-purple',
    material: 'tpu',
    brand: 'eSUN TPU-95A',
    color: 'Dark Purple',
    colorHex: '#581c87',
    costPerKg: 85,
    inStock: true,
    gramsRemaining: 1000,
    finish: 'rubber',
    recommendedFor: 'Custom aesthetic cases, key fobs, gaming accessories',
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
