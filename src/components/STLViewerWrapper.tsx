'use client'

import dynamic from 'next/dynamic'

const STLViewer = dynamic(() => import('./STLViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-50 rounded-xl">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
        <span className="text-xs text-slate-400">Loading 3D model…</span>
      </div>
    </div>
  ),
})

export default STLViewer
