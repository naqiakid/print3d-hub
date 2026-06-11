export const NOZZLE_SIZES = [0.2, 0.4, 0.6, 0.8] as const

export const NOZZLE_HINTS: Record<number, string> = {
  0.2: 'Fine detail',
  0.4: 'Standard',
  0.6: 'Fast',
  0.8: 'Very fast',
}

export const BED_TYPES = [
  { value: 'pei_smooth',     label: 'PEI Smooth',                    desc: 'PLA, ABS, ASA, Nylon — clean bottom finish' },
  { value: 'pei_textured',   label: 'PEI Textured / Satin',          desc: 'PETG, TPU, PLA — matte textured bottom' },
  { value: 'bambu_cool',     label: 'Cool Plate (Bambu)',             desc: 'PLA, TPU — Bambu-specific, no glue needed' },
  { value: 'bambu_hightemp', label: 'High-temp / Eng Plate (Bambu)', desc: 'ABS, ASA, PA, PC — Bambu high-temp plate' },
  { value: 'glass',          label: 'Glass / Borosilicate',          desc: 'PLA, ABS — very flat, smooth mirror finish' },
  { value: 'garolite',       label: 'Garolite (G10)',                desc: 'Nylon — best adhesion for PA/Nylon prints' },
  { value: 'buildtak',       label: 'BuildTak',                      desc: 'Most materials — adhesive surface, easy swap' },
  { value: 'other',          label: 'Other',                         desc: 'Carborundum glass, PP sheet, mirror, etc.' },
] as const

export type BedTypeValue = (typeof BED_TYPES)[number]['value']

export function bedLabel(value: string): string {
  return BED_TYPES.find((b) => b.value === value)?.label ?? value
}
