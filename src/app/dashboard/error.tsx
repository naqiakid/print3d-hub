'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h2 className="mb-2 text-xl font-bold text-red-600">Something went wrong</h2>
      <pre className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 overflow-auto">
        {error.message}
        {error.digest ? `\n\nDigest: ${error.digest}` : ''}
      </pre>
      <button
        onClick={reset}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Try again
      </button>
    </div>
  )
}
