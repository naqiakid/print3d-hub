'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { incrementAffiliateClicks } from '@/lib/actions'

function TrackerInner() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? searchParams.get('aff')

  useEffect(() => {
    if (refCode) {
      const clean = refCode.trim().toUpperCase()
      
      // Check if we've already tracked this code in the current session
      const currentSessionCode = sessionStorage.getItem('active_affiliate_code')
      
      // Store in session storage
      sessionStorage.setItem('active_affiliate_code', clean)
      // Store in local storage with current timestamp
      localStorage.setItem('affiliate_code', clean)
      localStorage.setItem('affiliate_code_time', String(Date.now()))
      
      // Only increment database click counter if it's a new code for this session
      if (currentSessionCode !== clean) {
        incrementAffiliateClicks(clean).catch(err => {
          console.error('Failed to increment affiliate clicks:', err)
        })
      }
    }
  }, [refCode])

  return null
}

export default function ReferralTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  )
}
