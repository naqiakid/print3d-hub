'use client'

import { useState } from 'react'
import { Share2, Check, Copy } from 'lucide-react'

interface Props {
  shopName: string
}

export default function ShareShopButton({ shopName }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href
    
    // Try native sharing if supported
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${shopName} | 3D Printing Hub`,
          text: `Check out ${shopName} on Print3D Hub for custom 3D printing services!`,
          url: url,
        })
        return
      } catch {
        // Fall back to clipboard if shared is cancelled or fails
      }
    }

    // Clipboard copy fallback
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link', err)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-95 shadow-sm"
      title="Share link to this 3D printing shop"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-400" />
          <span className="text-green-300">Link Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4 text-white/80" />
          <span>Share Shop</span>
        </>
      )}
    </button>
  )
}
