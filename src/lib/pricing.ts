import type { PrintSize, PrintQuality, MaterialFeel, FilamentCosts } from './types'

export const DEFAULT_ELECTRICITY_RATE = 0.57
export const DEFAULT_GRAMS_PER_ROLL   = 1000
export const DEFAULT_MARKUP_PERCENT   = 30

export const PRINT_ESTIMATES: Record<PrintSize, Record<PrintQuality, { weight_g: number; hours: number }>> = {
  small:  { draft: { weight_g: 15,  hours: 1.5 }, standard: { weight_g: 20,  hours: 2.5 }, premium: { weight_g: 25,  hours: 4  } },
  medium: { draft: { weight_g: 60,  hours: 4   }, standard: { weight_g: 80,  hours: 7   }, premium: { weight_g: 100, hours: 12 } },
  large:  { draft: { weight_g: 150, hours: 10  }, standard: { weight_g: 200, hours: 18  }, premium: { weight_g: 250, hours: 30 } },
}

const MODEL_POWER_WATTS: Record<string, number> = {
  'bambu-x1c':           350,
  'bambu-p1s':           350,
  'bambu-p1p':           350,
  'bambu-a1-mini':       250,
  'bambu-a1':            250,
  'prusa-xl':            200,
  'prusa-mk4s':          120,
  'prusa-mk3s':          120,
  'prusa-mini':          100,
  'creality-k1':         200,
  'creality-ender3':     65,
  'creality-cr10':       80,
  'ankermake-m5c':       180,
  'voron':               300,
}

export function getPowerWatts(modelId: string): number {
  for (const [prefix, watts] of Object.entries(MODEL_POWER_WATTS)) {
    if (modelId.startsWith(prefix)) return watts
  }
  return 150
}

export type EstimateInput = {
  size: PrintSize
  quality: PrintQuality
  material: MaterialFeel
  power_watts: number
  cost_per_roll: number
  grams_per_roll?: number
  electricity_rate?: number
  markup_percent?: number
}

export type EstimateResult = {
  weight_g: number
  hours: number
  filament_cost: number
  electricity_cost: number
  base_cost: number
  suggested_price: number
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const {
    size, quality, power_watts, cost_per_roll,
    grams_per_roll   = DEFAULT_GRAMS_PER_ROLL,
    electricity_rate = DEFAULT_ELECTRICITY_RATE,
    markup_percent   = DEFAULT_MARKUP_PERCENT,
  } = input

  const { weight_g, hours } = PRINT_ESTIMATES[size][quality]
  const filament_cost    = (weight_g / grams_per_roll) * cost_per_roll
  const electricity_cost = hours * (power_watts / 1000) * electricity_rate
  const base_cost        = filament_cost + electricity_cost
  const suggested_price  = base_cost * (1 + markup_percent / 100)

  const r = (n: number) => Math.round(n * 100) / 100
  return {
    weight_g, hours,
    filament_cost:    r(filament_cost),
    electricity_cost: r(electricity_cost),
    base_cost:        r(base_cost),
    suggested_price:  r(suggested_price),
  }
}

export type PriceRangeInput = {
  materials: MaterialFeel[]
  filament_costs: FilamentCosts
  power_watts: number
  grams_per_roll?: number
  electricity_rate?: number
  markup_percent?: number
}

export function calculatePriceRange(input: PriceRangeInput): { price_min: number; price_max: number } {
  const prices: number[] = []

  for (const material of input.materials) {
    const cost_per_roll = input.filament_costs[material]
    if (!cost_per_roll) continue

    const base = { material, power_watts: input.power_watts, cost_per_roll, ...input }
    prices.push(
      calculateEstimate({ ...base, size: 'small', quality: 'draft'   }).suggested_price,
      calculateEstimate({ ...base, size: 'large', quality: 'premium' }).suggested_price,
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
