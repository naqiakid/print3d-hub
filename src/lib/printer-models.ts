import type { PrintType, MaterialFeel, PrintSize } from './types'

export type PrinterModelPreset = {
  id: string
  brand: string
  name: string
  build_volume: string
  max_size: PrintSize
  print_types: PrintType[]
  materials: MaterialFeel[]
  power_watts: number
  note?: string
}

// power_watts = average active-printing draw (after warm-up), not PSU rating.
// Sources: Bambu Lab Wiki, Prusa KB, reviewer Blitzwolf plug measurements (3DPrintBeginner, ThePhonograph.net).
export const PRINTER_MODELS: PrinterModelPreset[] = [
  // ── Bambu Lab ──────────────────────────────────────────────
  {
    id: 'bambu-x1c',
    brand: 'Bambu Lab',
    name: 'X1C',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 120,  // ~100–135W measured (forum watt-meter + Bambu wiki)
  },
  {
    id: 'bambu-x1c-ams',
    brand: 'Bambu Lab',
    name: 'X1C + AMS',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 130,  // X1C + ~10W AMS overhead during active feeding
    note: 'Multi-color via AMS',
  },
  {
    id: 'bambu-p1s',
    brand: 'Bambu Lab',
    name: 'P1S',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 115,  // ~100–130W measured (forum + YouTube watt-meter); enclosed similar to X1C
  },
  {
    id: 'bambu-p1s-ams',
    brand: 'Bambu Lab',
    name: 'P1S + AMS',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 130,  // P1S + ~10–15W AMS overhead
    note: 'Multi-color via AMS',
  },
  {
    id: 'bambu-p1p',
    brand: 'Bambu Lab',
    name: 'P1P',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 60,   // ~55–70W measured (open frame, DC bed, forum energy monitor)
  },
  {
    id: 'bambu-a1',
    brand: 'Bambu Lab',
    name: 'A1',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['rigid', 'flexible'],
    power_watts: 95,   // Official Bambu Wiki FAQ: 95W average PLA
  },
  {
    id: 'bambu-a1-combo',
    brand: 'Bambu Lab',
    name: 'A1 Combo',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'colorful'],
    materials: ['rigid', 'flexible'],
    power_watts: 105,  // A1 95W + ~5–10W AMS Lite overhead
    note: 'Multi-color via AMS Lite',
  },
  {
    id: 'bambu-a1-mini',
    brand: 'Bambu Lab',
    name: 'A1 Mini',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday'],
    materials: ['rigid', 'flexible'],
    power_watts: 60,   // Official Bambu Wiki FAQ: 57W average PLA (rounded)
  },
  {
    id: 'bambu-a1-mini-combo',
    brand: 'Bambu Lab',
    name: 'A1 Mini Combo',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday', 'colorful'],
    materials: ['rigid', 'flexible'],
    power_watts: 65,   // A1 Mini 57W + ~5–10W AMS Lite overhead
    note: 'Multi-color via AMS Lite',
  },

  // ── Prusa ──────────────────────────────────────────────────
  {
    id: 'prusa-mk4s',
    brand: 'Prusa',
    name: 'MK4S',
    build_volume: '250 × 210 × 220 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 90,   // Prusa KB: 80W PLA / 120W ABS; ~90W typical mixed use
  },
  {
    id: 'prusa-mk3s',
    brand: 'Prusa',
    name: 'MK3S+',
    build_volume: '250 × 210 × 210 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 90,   // Same PSU/bed as MK4S; Prusa KB + forum measurements
  },
  {
    id: 'prusa-mini',
    brand: 'Prusa',
    name: 'Mini+',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday'],
    materials: ['rigid', 'flexible'],
    power_watts: 65,   // Forum watt-meter: ~60–70W typical PLA; 150W PSU ceiling
  },
  {
    id: 'prusa-xl',
    brand: 'Prusa',
    name: 'XL',
    build_volume: '360 × 360 × 360 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 165,  // Forum: 150–180W (single tool, 1–2 bed tiles active)
    note: 'Multi-tool multi-color',
  },

  // ── Creality ───────────────────────────────────────────────
  {
    id: 'creality-ender3-v3',
    brand: 'Creality',
    name: 'Ender 3 V3',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['rigid', 'flexible'],
    power_watts: 125,  // ~120–130W (Ender 3 architecture, 350W PSU; no V3 KE-specific measurement)
  },
  {
    id: 'creality-ender3-v3-se',
    brand: 'Creality',
    name: 'Ender 3 V3 SE',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['rigid', 'flexible'],
    power_watts: 110,  // SE runs slower, lower bed duty cycle; ~100–120W estimate
  },
  {
    id: 'creality-k1c',
    brand: 'Creality',
    name: 'K1C',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 175,  // ThePhonograph.net Blitzwolf measurement: ~150–200W during stable print
    note: 'Carbon fibre capable',
  },
  {
    id: 'creality-k1-max',
    brand: 'Creality',
    name: 'K1 Max',
    build_volume: '300 × 300 × 300 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 225,  // ~200–250W (larger AC bed; inferred — no clean measurement found)
  },
  {
    id: 'creality-cr10',
    brand: 'Creality',
    name: 'CR-10 Smart Pro',
    build_volume: '300 × 300 × 400 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['rigid', 'flexible'],
    power_watts: 75,   // 3DPrintBeginner Blitzwolf: stabilises to ~75W after heatup
  },

  // ── AnkerMake ──────────────────────────────────────────────
  {
    id: 'ankermake-m5c',
    brand: 'AnkerMake',
    name: 'M5C',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['rigid', 'flexible'],
    power_watts: 85,   // 3DPrintBeginner Blitzwolf: stabilises to ~85W during printing
  },

  // ── Voron ──────────────────────────────────────────────────
  {
    id: 'voron-24',
    brand: 'Voron',
    name: 'Voron 2.4',
    build_volume: '300 × 300 × 300 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 165,  // 300mm build ~150–180W (extrapolated from 350mm forum measurements)
    note: 'Enclosed, high-temp capable',
  },
  {
    id: 'voron-trident',
    brand: 'Voron',
    name: 'Voron Trident',
    build_volume: '250 × 250 × 250 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 170,  // 3DPrintBeginner FYSETC kit Blitzwolf: ~170W stable printing
    note: 'Enclosed, high-temp capable',
  },
  {
    id: 'voron-0',
    brand: 'Voron',
    name: 'Voron 0.2',
    build_volume: '120 × 120 × 120 mm',
    max_size: 'medium',
    print_types: ['everyday', 'strong'],
    materials: ['rigid', 'flexible', 'tough'],
    power_watts: 50,   // 120mm build; 100W bed heater at ~30–40% duty + electronics ~50W total
    note: 'Compact enclosed build',
  },
]

export const BRANDS = [...new Set(PRINTER_MODELS.map((p) => p.brand))]

export function getPresetById(id: string): PrinterModelPreset | undefined {
  return PRINTER_MODELS.find((p) => p.id === id)
}
