export interface StudioConfig {
  name: string
  tagline: string
  city: string
  state: string
  country: string
  pickupAddress: string
  whatsappNumber: string
  whatsappLink: string
  bankDetails: {
    bankName: string
    accountNumber: string
    accountHolder: string
    duitnowId: string
    qrCodeImage: string
  }
  printer: {
    brand: string
    model: string
    buildBed: {
      x: number // width in mm
      y: number // depth in mm
      z: number // height in mm
    }
    extruder: string
    maxSpeed: number // mm/s
    defaultNozzleMm: number
    powerWatts: number
  }
  shipping: {
    pickup: { label: string; fee: number; eta: string }
    courierWest: { label: string; fee: number; eta: string; couriers: string }
    courierEast: { label: string; fee: number; eta: string; couriers: string }
    runner: { label: string; ratePerKm: number; eta: string }
  }
}

export const STUDIO_CONFIG: StudioConfig = {
  name: '3MF Studio',
  tagline: 'Custom 3D Printing & 3MF Fabrication · Ampang, Selangor',
  city: 'Ampang',
  state: 'Selangor',
  country: 'Malaysia',
  pickupAddress: 'Sekolah Kebangsaan Ampang, Ampang, Selangor',
  whatsappNumber: '60173587894',
  whatsappLink: 'https://wa.me/60173587894',
  bankDetails: {
    bankName: 'Bank Islam',
    accountNumber: '12261020024818',
    accountHolder: 'Muhammad Naqiyuddin Bin Azmi',
    duitnowId: '12261020024818',
    qrCodeImage: '/duitnow-qr.png',
  },
  printer: {
    brand: 'Creality',
    model: 'Ender-3 V3 SE',
    buildBed: {
      x: 220,
      y: 220,
      z: 250,
    },
    extruder: 'Sprite Direct Drive Extruder',
    maxSpeed: 250,
    defaultNozzleMm: 0.4,
    powerWatts: 180,
  },
  shipping: {
    pickup: {
      label: 'Self-Pickup (Ampang Studio)',
      fee: 0,
      eta: 'Ready in 24-48 Hours',
    },
    courierWest: {
      label: 'Semenanjung Malaysia',
      fee: 8.0,
      eta: '1-3 Business Days',
      couriers: 'J&T Express / Pos Laju',
    },
    courierEast: {
      label: 'Sabah & Sarawak',
      fee: 15.0,
      eta: '3-5 Business Days',
      couriers: 'Pos Laju / J&T Cargo',
    },
    runner: {
      label: 'Klang Valley Same-Day Runner',
      ratePerKm: 1.0,
      eta: 'Same Day on Completion',
    },
  },
}
