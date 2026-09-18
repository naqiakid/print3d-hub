'use client'

import dynamic from 'next/dynamic'
import { RotateCw } from 'lucide-react'

const Ender3BedViewerFromUrls = dynamic(() => import('./Ender3BedViewerFromUrls'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 dark:bg-slate-900 text-slate-500 shadow-sm">
      <div className="flex flex-col items-center gap-2.5">
        <RotateCw className="h-6 w-6 animate-spin text-orange-500" />
        <span className="text-xs font-semibold">Loading Ender-3 3D Bed Viewer...</span>
      </div>
    </div>
  ),
})

export default Ender3BedViewerFromUrls
