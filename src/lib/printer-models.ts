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
  image_url?: string
}

// power_watts = peak active-printing draw: what the printer pulls at the wall plug during the
// opening minutes of a print when all heaters are at 100% duty cycle (bed + hotend + motors).
// This is the WORST CASE during normal printing — used for cost to protect owners from undercharging.
// It is NOT the PSU nameplate rating (that's the max the supply CAN deliver, ~350W for most printers).
// Sources: smart-plug measurements at print-start from 3DPrintBeginner, ThePhonograph.net, r/3Dprinting.
// image_url = official product image from manufacturer website (may need updating if CDN paths change).
export const PRINTER_MODELS: PrinterModelPreset[] = [
  // ── Bambu Lab ──────────────────────────────────────────────
  {
    id: 'bambu-x1c',
    brand: 'Bambu Lab',
    name: 'X1C',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 200,
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-x1-carbon/bambu-lab-x1-carbon-main-img-new.webp',
  },
  {
    id: 'bambu-x1c-ams',
    brand: 'Bambu Lab',
    name: 'X1C + AMS',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 210,
    note: 'Multi-color via AMS',
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-x1-carbon/bambu-lab-x1-carbon-combo-new.webp',
  },
  {
    id: 'bambu-p1s',
    brand: 'Bambu Lab',
    name: 'P1S',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 190,
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-p1s/bambu-lab-p1s-main-img.webp',
  },
  {
    id: 'bambu-p1s-ams',
    brand: 'Bambu Lab',
    name: 'P1S + AMS',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 200,
    note: 'Multi-color via AMS',
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-p1s/bambu-lab-p1s-combo-main-img.webp',
  },
  {
    id: 'bambu-p1p',
    brand: 'Bambu Lab',
    name: 'P1P',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 120,
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-p1p/bambu-lab-p1p-main-img.webp',
  },
  {
    id: 'bambu-a1',
    brand: 'Bambu Lab',
    name: 'A1',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 140,
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-a1/bambu-lab-a1-main-img.webp',
  },
  {
    id: 'bambu-a1-combo',
    brand: 'Bambu Lab',
    name: 'A1 Combo',
    build_volume: '256 × 256 × 256 mm',
    max_size: 'large',
    print_types: ['everyday', 'colorful'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 150,
    note: 'Multi-color via AMS Lite',
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-a1/bambu-lab-a1-combo-main-img.webp',
  },
  {
    id: 'bambu-a1-mini',
    brand: 'Bambu Lab',
    name: 'A1 Mini',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday'],
    materials: ['pla', 'petg'],
    power_watts: 85,
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-a1-mini/bambu-lab-a1-mini-main-img.webp',
  },
  {
    id: 'bambu-a1-mini-combo',
    brand: 'Bambu Lab',
    name: 'A1 Mini Combo',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday', 'colorful'],
    materials: ['pla', 'petg'],
    power_watts: 90,
    note: 'Multi-color via AMS Lite',
    image_url: 'https://public-cdn.bambulab.com/upgrade/product/bambu-lab-a1-mini/bambu-lab-a1-mini-combo-main-img.webp',
  },

  // ── Prusa ──────────────────────────────────────────────────
  {
    id: 'prusa-mk4s',
    brand: 'Prusa',
    name: 'MK4S',
    build_volume: '250 × 210 × 220 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon'],
    power_watts: 140,
    image_url: 'https://cdn.prusa3d.com/media/catalog/product/cache/b7b1f29b2ae3d8cbc6f8c1d2ac2da4ee/o/r/original-prusa-mk4s-assembled-kit_1.jpg',
  },
  {
    id: 'prusa-mk3s',
    brand: 'Prusa',
    name: 'MK3S+',
    build_volume: '250 × 210 × 210 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon'],
    power_watts: 130,
    image_url: 'https://cdn.prusa3d.com/media/catalog/product/cache/b7b1f29b2ae3d8cbc6f8c1d2ac2da4ee/o/r/original-prusa-i3-mk3s_-assembled-printer_1.jpg',
  },
  {
    id: 'prusa-mini',
    brand: 'Prusa',
    name: 'Mini+',
    build_volume: '180 × 180 × 180 mm',
    max_size: 'medium',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 90,
    image_url: 'https://cdn.prusa3d.com/media/catalog/product/cache/b7b1f29b2ae3d8cbc6f8c1d2ac2da4ee/o/r/original-prusa-mini-_-semi-assembled_1.jpg',
  },
  {
    id: 'prusa-xl',
    brand: 'Prusa',
    name: 'XL',
    build_volume: '360 × 360 × 360 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong', 'colorful'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 240,
    note: 'Multi-tool multi-color',
    image_url: 'https://cdn.prusa3d.com/media/catalog/product/cache/b7b1f29b2ae3d8cbc6f8c1d2ac2da4ee/o/r/original-prusa-xl-assembled-single-toolhead_1.jpg',
  },

  // ── Creality ───────────────────────────────────────────────
  {
    id: 'creality-ender3-v3',
    brand: 'Creality',
    name: 'Ender 3 V3',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 180,
    image_url: 'https://store.creality.com/cdn/shop/products/3_aae03a89-2e47-4df4-b7c3-28c45f6e27f3.jpg',
  },
  {
    id: 'creality-ender3-v3-se',
    brand: 'Creality',
    name: 'Ender 3 V3 SE',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 180,
    image_url: 'https://store.creality.com/cdn/shop/files/ender3-v3-se-1.jpg',
  },
  {
    id: 'creality-k1c',
    brand: 'Creality',
    name: 'K1C',
    build_volume: '220 × 220 × 250 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 220,
    note: 'Carbon fibre capable',
    image_url: 'https://store.creality.com/cdn/shop/files/k1c-1.jpg',
  },
  {
    id: 'creality-k1-max',
    brand: 'Creality',
    name: 'K1 Max',
    build_volume: '300 × 300 × 300 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 280,
    image_url: 'https://store.creality.com/cdn/shop/files/k1-max-1.jpg',
  },
  {
    id: 'creality-cr10',
    brand: 'Creality',
    name: 'CR-10 Smart Pro',
    build_volume: '300 × 300 × 400 mm',
    max_size: 'large',
    print_types: ['everyday'],
    materials: ['pla', 'petg', 'tpu'],
    power_watts: 220,
    image_url: 'https://store.creality.com/cdn/shop/products/CR-10-Smart-Pro_1.jpg',
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
    power_watts: 150,
    image_url: 'https://cdn.ankermake.com/o/ankermake-martech/20230602/2cbb97a5-0b3c-4d83-b3f3-17aa4dd7ff53.png',
  },

  // ── Voron ──────────────────────────────────────────────────
  {
    id: 'voron-24',
    brand: 'Voron',
    name: 'Voron 2.4',
    build_volume: '300 × 300 × 300 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 280,
    note: 'Enclosed, high-temp capable',
    image_url: 'https://vorondesign.com/images/v2.4.jpg',
  },
  {
    id: 'voron-trident',
    brand: 'Voron',
    name: 'Voron Trident',
    build_volume: '250 × 250 × 250 mm',
    max_size: 'large',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 260,
    note: 'Enclosed, high-temp capable',
    image_url: 'https://vorondesign.com/images/trident.jpg',
  },
  {
    id: 'voron-0',
    brand: 'Voron',
    name: 'Voron 0.2',
    build_volume: '120 × 120 × 120 mm',
    max_size: 'medium',
    print_types: ['everyday', 'strong'],
    materials: ['pla', 'petg', 'abs', 'tpu', 'nylon', 'pc'],
    power_watts: 70,
    note: 'Compact enclosed build',
    image_url: 'https://vorondesign.com/images/v0.2.jpg',
  },
]

export const BRANDS = [...new Set(PRINTER_MODELS.map((p) => p.brand))]

export function getPresetById(id: string): PrinterModelPreset | undefined {
  return PRINTER_MODELS.find((p) => p.id === id)
}
