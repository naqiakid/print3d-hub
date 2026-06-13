'use client'

import { useState } from 'react'

function PrinterSVG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="14" height="104" rx="3" fill="white" fillOpacity="0.25" />
      <rect x="98" y="8" width="14" height="104" rx="3" fill="white" fillOpacity="0.25" />
      <rect x="8" y="8" width="104" height="12" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="18" y="88" width="84" height="10" rx="2" fill="white" fillOpacity="0.5" />
      <rect x="26" y="96" width="68" height="4" rx="1" fill="white" fillOpacity="0.2" />
      <rect x="18" y="36" width="84" height="6" rx="2" fill="white" fillOpacity="0.4" />
      <rect x="44" y="28" width="32" height="20" rx="4" fill="white" fillOpacity="0.7" />
      <path d="M58 48 L55 56 L60 58 L65 56 L62 48Z" fill="white" fillOpacity="0.9" />
      <rect x="46" y="72" width="28" height="16" rx="2" fill="white" fillOpacity="0.45" />
      <rect x="50" y="68" width="20" height="5" rx="1" fill="white" fillOpacity="0.3" />
    </svg>
  )
}

interface Props {
  imageUrl: string | undefined
  alt: string
  className?: string
  fallbackClassName?: string
}

export default function PrinterDeviceImage({ imageUrl, alt, className, fallbackClassName }: Props) {
  const [failed, setFailed] = useState(!imageUrl)

  if (failed || !imageUrl) {
    return <PrinterSVG className={fallbackClassName ?? 'w-28 h-28'} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
