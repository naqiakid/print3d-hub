import type { PrintType, FilamentMaterial, PrintSize } from './types'

export type PrinterModelPreset = {
  id: string
  brand: string
  name: string
  build_volume: string
  max_size: PrintSize
  print_types: PrintType[]
  materials: FilamentMaterial[]
  power_watts: number
  note?: string
}

// power_watts = average active-printing draw (after warm-up), not PSU rating.
// Sources: Bambu Lab Wiki, Prusa KB, reviewer Blitzwolf plug measurements (3DPrintBeginner, ThePhonograph.net).
export const PRINTER_MODELS: PrinterModelPreset[] = [
  // ── Bambu Lab ──────────────────────────────────────────────
  // ── Bambu Lab ──────────────────────────────────────────────
  // X1C / P1S: fully enclosed → all materials
  {
    id: 'bambu-x1c',
    brand: 'Bambu Lab',
    name: 'X1C',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 120,
  },
  {
    id: 'bambu-x1c-ams',
    brand: 'Bambu Lab',
    name: 'X1C + AMS',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 130,
    note: 'Multi-color via AMS',
  },
  {
    id: 'bambu-p1s',
    brand: 'Bambu Lab',
    name: 'P1S',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 115,
  },
  {
    id: 'bambu-p1s-ams',
    brand: 'Bambu Lab',
    name: 'P1S + AMS',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 130,
    note: 'Multi-color via AMS',
  },
  // P1P: open frame → no ABS/Nylon/PC reliably
  {
    id: 'bambu-p1p',
    brand: 'Bambu Lab',
    name: 'P1P',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 60,
  },
  // A1 / A1 Mini: open frame, no high-temp support
  {
    id: 'bambu-a1',
    brand: 'Bambu Lab',
    name: 'A1',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 95,
  },
  {
    id: 'bambu-a1-combo',
    brand: 'Bambu Lab',
    name: 'A1 Combo',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'colorful'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 105,
    note: 'Multi-color via AMS Lite',
  },
  {
    id: 'bambu-a1-mini',
    brand: 'Bambu Lab',
    name: 'A1 Mini',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday'],
    materials: ['pla', 'petg'],
    power_watts: 60,
  },
  {
    id: 'bambu-a1-mini-combo',
    brand: 'Bambu Lab',
    name: 'A1 Mini Combo',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday', 'colorful'],
    materials: ['pla', 'petg'],
    power_watts: 65,
    note: 'Multi-color via AMS Lite',
  },

  // ── Prusa ──────────────────────────────────────────────────
  // MK4S / MK3S+: open frame but quality hotend → PLA, PETG, ABS (with care), TPU, Nylon
  {
    id: 'prusa-mk4s',
    brand: 'Prusa',
    name: 'MK4S',
    build_volume: '250 × 210 × 220 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon'],
    power_watts: 90,
  },
  {
    id: 'prusa-mk3s',
    brand: 'Prusa',
    name: 'MK3S+',
    build_volume: '250 × 210 × 210 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon'],
    power_watts: 90,
  },
  // Mini+: compact open frame
  {
    id: 'prusa-mini',
    brand: 'Prusa',
    name: 'Mini+',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 65,
  },
  // XL: large format, can be enclosed → all materials
  {
    id: 'prusa-xl',
    brand: 'Prusa',
    name: 'XL',
    build_volume: '360 × 360 × 360 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 165,
    note: 'Multi-tool multi-color',
  },

  // ── Creality ───────────────────────────────────────────────
  // Ender 3 / CR-10: open frame
  {
    id: 'creality-ender3-v3',
    brand: 'Creality',
    name: 'Ender 3 V3',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 125,
  },
  {
    id: 'creality-ender3-v3-se',
    brand: 'Creality',
    name: 'Ender 3 V3 SE',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 110,
  },
  // K1C / K1 Max: enclosed with active filtration → all materials
  {
    id: 'creality-k1c',
    brand: 'Creality',
    name: 'K1C',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 175,
    note: 'Carbon fibre capable',
  },
  {
    id: 'creality-k1-max',
    brand: 'Creality',
    name: 'K1 Max',
    build_volume: '300 × 300 × 300 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 225,
  },
  {
    id: 'creality-cr10',
    brand: 'Creality',
    name: 'CR-10 Smart Pro',
    build_volume: '300 × 300 × 400 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 75,
  },

  // ── AnkerMake ──────────────────────────────────────────────
  {
    id: 'ankermake-m5c',
    brand: 'AnkerMake',
    name: 'M5C',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 85,
  },

  // ── Voron ──────────────────────────────────────────────────
  // All Voron builds are fully enclosed → all materials
  {
    id: 'voron-24',
    brand: 'Voron',
    name: 'Voron 2.4',
    build_volume: '300 × 300 × 300 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 165,
    note: 'Enclosed, high-temp capable',
  },
  {
    id: 'voron-trident',
    brand: 'Voron',
    name: 'Voron Trident',
    build_volume: '250 × 250 × 250 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 170,
    note: 'Enclosed, high-temp capable',
  },
  {
    id: 'voron-0',
    brand: 'Voron',
    name: 'Voron 0.2',
    build_volume: '120 × 120 × 120 mm',
    max_size: 'medium',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 50,
    note: 'Compact enclosed build',
  },
]

export const BRANDS = [...new Set(PRINTER_MODELS.map((p) => p.brand))]

export function getPresetById(id: string): PrinterModelPreset | undefined {
  return PRINTER_MODELS.find((p) => p.id === id)
}
