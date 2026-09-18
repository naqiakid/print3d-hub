'use client'

import dynamic from 'next/dynamic'
import type { Filament, RequestPrinterView } from '@/lib/types'

type Props = {
  printer: RequestPrinterView
  filaments: Filament[]
}

const PriceConfigurator = dynamic(() => import('./PriceConfigurator'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl">
      <div className="flex flex-col items-center gap-2">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
        <span className="text-xs font-semibold text-slate-500">Loading 3D Slicer &amp; Price Engine…</span>
      </div>
    </div>
  ),
})

export default function PriceConfiguratorWrapper(props: Props) {
  return <PriceConfigurator {...props} />
}
