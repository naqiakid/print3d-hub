'use client'

import dynamic from 'next/dynamic'

// ssr: false — gcode-preview uses WebGL which is browser-only.
// This wrapper must be a 'use client' file; dynamic with ssr:false is not
// allowed directly inside Server Components.
const GcodeViewer = dynamic(() => import('./GcodeViewer'), { ssr: false })

export default GcodeViewer
