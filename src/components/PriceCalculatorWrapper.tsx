'use client'

import dynamic from 'next/dynamic'
import type { Filament, RequestPrinterView } from '@/lib/types'

type Props = {
  printer: RequestPrinterView
  filaments: Filament[]
}

const PriceCalculator = dynamic(() => import('./PriceCalculator'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center bg-slate-50 rounded-xl">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
        <span className="text-xs text-slate-400">Loading price calculator…</span>
      </div>
    </div>
  ),
})

export default function PriceCalculatorWrapper(props: Props) {
  return <PriceCalculator {...props} />
}
