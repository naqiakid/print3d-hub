'use client'

import dynamic from 'next/dynamic'
import type { CatalogItem, Filament, PrintProfile, RequestPrinterView } from '@/lib/types'

type Props = {
  item: CatalogItem
  printer: RequestPrinterView
  profiles: PrintProfile[]
  filaments: Filament[]
  shopName: string
}

const CatalogOrderForm = dynamic(() => import('./CatalogOrderForm'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center bg-slate-50 rounded-xl">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
        <span className="text-xs text-slate-400">Loading order form…</span>
      </div>
    </div>
  ),
})

export default function CatalogOrderFormWrapper(props: Props) {
  return <CatalogOrderForm {...props} />
}
