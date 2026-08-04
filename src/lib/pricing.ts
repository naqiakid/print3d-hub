import type { PrintSize, PrintQuality, FilamentMaterial, FilamentCosts } from './types'

export const DEFAULT_ELECTRICITY_RATE = 0.516
export const DEFAULT_MARKUP_PERCENT   = 30

export const DEFAULT_INFILL: Record<string, number> = {
  basic:    15,
  advanced: 40,
}

export const DEFAULT_WALL_COUNT_BASIC    = 3
export const DEFAULT_WALL_COUNT_ADVANCED = 5

export const NOZZLE_OPTIONS = [
  { value: 0.2, label: '0.2 mm', sublabel: 'Ultra detail · very slow' },
  { value: 0.4, label: '0.4 mm', sublabel: 'Standard · most common' },
  { value: 0.6, label: '0.6 mm', sublabel: 'Fast · less fine detail' },
  { value: 0.8, label: '0.8 mm', sublabel: 'Draft · fastest' },
]

// Time multiplier relative to 0.4mm baseline
export const NOZZLE_TIME_MULTIPLIER: Record<string, number> = {
  '0.2': 2.0,
  '0.4': 1.0,
  '0.6': 0.65,
  '0.8': 0.5,
}

export const DEFAULT_FILAMENT_COST_PER_KG: Record<FilamentMaterial, number> = {
  pla:   55,
  petg:  70,
  abs:   65,
  tpu:   90,
  nylon: 120,
  pc:    150,
}

export const PRINT_ESTIMATES: Record<PrintSize, Record<PrintQuality, { weight_g: number; hours: number }>> = {
  small:  { basic: { weight_g: 15,  hours: 1.5 }, advanced: { weight_g: 25,  hours: 3   } },
  medium: { basic: { weight_g: 60,  hours: 4   }, advanced: { weight_g: 100, hours: 10  } },
  large:  { basic: { weight_g: 150, hours: 10  }, advanced: { weight_g: 260, hours: 28  } },
}

export const DEFAULT_MACHINE_RATE   = 6.00  // RM/hr — depreciation + wear (updated to 6.00)
export const DEFAULT_WASTE_PERCENT  = 8    // % — consumables, failed prints, maintenance
export const MINIMUM_ORDER_PRICE    = 15.00 // RM — minimum order floor price

export type EstimateInput = {
  size: PrintSize
  quality: PrintQuality
  material: FilamentMaterial
  power_watts: number
  cost_per_kg: number
  electricity_rate?: number
  markup_percent?: number
  machine_rate_per_hour?: number  // RM/hr depreciation + wear; default 6.00
  waste_percent?: number          // consumables + maintenance overhead; default 8%
  nozzle_mm?: number              // default 0.4 — affects print time
  custom_infill?: number          // overrides quality default — affects weight
  wall_count?: number             // affects weight via perimeter material (~20% of total)
  ironing?: boolean               // adds 15% print time, smoother top surface
  known_weight_g?: number | null  // from real STL slicing — bypasses the size-bucket weight guess
  known_hours?: number | null     // from real STL slicing — bypasses the size-bucket time guess
  affiliate_discount_pct?: number
  affiliate_commission_pct?: number
  override_suggested_price?: number // bypasses internal cost calculation, sets direct suggested price
}

export type EstimateResult = {
  weight_g: number
  hours: number
  filament_cost: number
  electricity_cost: number
  machine_cost: number
  waste_cost: number
  base_cost: number
  suggested_price: number
  discount_amount: number
  commission_amount: number
  final_price: number
}

// Map legacy DB values to current quality keys
const QUALITY_COMPAT: Record<string, PrintQuality> = {
  draft:       'basic',
  functional:  'basic',
  standard:    'basic',
  presentable: 'basic',
  premium:     'advanced',
  display:     'advanced',
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const {
    size, power_watts, cost_per_kg,
    electricity_rate      = DEFAULT_ELECTRICITY_RATE,
    markup_percent        = DEFAULT_MARKUP_PERCENT,
    machine_rate_per_hour = DEFAULT_MACHINE_RATE,
    waste_percent         = DEFAULT_WASTE_PERCENT,
    nozzle_mm             = 0.4,
    custom_infill,
    wall_count,
    ironing               = false,
  } = input

  const quality = QUALITY_COMPAT[input.quality] ?? input.quality

  const base = PRINT_ESTIMATES[size][quality]

  // Scale weight by infill ratio if owner profile differs from default
  const base_infill = DEFAULT_INFILL[quality]
  const effective_infill = custom_infill ?? base_infill
  // Perimeters are ~20% of total filament; wall count scales that portion
  const default_walls = quality === 'advanced' ? DEFAULT_WALL_COUNT_ADVANCED : DEFAULT_WALL_COUNT_BASIC
  const wall_factor = wall_count != null ? 0.8 + 0.2 * (wall_count / default_walls) : 1.0
  const weight_g = input.known_weight_g ?? (base.weight_g * (effective_infill / base_infill) * wall_factor)

  // Scale time by nozzle multiplier, then add ironing overhead
  const nozzle_mult = NOZZLE_TIME_MULTIPLIER[String(nozzle_mm)] ?? 1.0
  const hours = input.known_hours ?? (base.hours * nozzle_mult * (ironing ? 1.15 : 1))

  const machine_hourly_rate = machine_rate_per_hour
  const filament_cost    = (weight_g / 1000) * cost_per_kg
  const electricity_cost = hours * (power_watts / 1000) * electricity_rate
  const machine_cost     = hours * machine_hourly_rate
  const subtotal         = filament_cost + electricity_cost + machine_cost
  const waste_cost       = subtotal * (waste_percent / 100)
  const base_cost        = subtotal + waste_cost

  let suggested_price  = input.override_suggested_price ?? (base_cost * (1 + markup_percent / 100))
  if (suggested_price < MINIMUM_ORDER_PRICE) {
    suggested_price = MINIMUM_ORDER_PRICE
  }

  const discount_amount = suggested_price * ((input.affiliate_discount_pct ?? 0) / 100)
  const commission_amount = suggested_price * ((input.affiliate_commission_pct ?? 0) / 100)
  let final_price = suggested_price - discount_amount
  if (final_price < MINIMUM_ORDER_PRICE) {
    final_price = MINIMUM_ORDER_PRICE
  }

  const r = (n: number) => Math.round(n * 100) / 100
  return {
    weight_g: r(weight_g), hours: r(hours),
    filament_cost:    r(filament_cost),
    electricity_cost: r(electricity_cost),
    machine_cost:     r(machine_cost),
    waste_cost:       r(waste_cost),
    base_cost:        r(base_cost),
    suggested_price:  r(suggested_price),
    discount_amount:  r(discount_amount),
    commission_amount: r(commission_amount),
    final_price:      r(final_price),
  }
}

export type PriceRangeInput = {
  materials: FilamentMaterial[]
  filament_costs: FilamentCosts
  power_watts: number
  electricity_rate?: number
  markup_percent?: number
  machine_rate_per_hour?: number
  waste_percent?: number
}

export function calculatePriceRange(input: PriceRangeInput): { price_min: number; price_max: number } {
  const prices: number[] = []

  for (const material of input.materials) {
    const cost_per_kg = input.filament_costs[material]
    if (!cost_per_kg) continue

    const base = { material, cost_per_kg, ...input }
    prices.push(
      calculateEstimate({ ...base, size: 'small', quality: 'basic'    }).suggested_price,
      calculateEstimate({ ...base, size: 'large', quality: 'advanced' }).suggested_price,
    )
  }

  if (prices.length === 0) return { price_min: 0, price_max: 0 }
  return {
    price_min: Math.max(1,  Math.round(Math.min(...prices))),
    price_max: Math.round(Math.max(...prices)),
  }
}

export function formatRM(value: number): string {
  return `RM ${value.toFixed(2)}`
}
