'use client'

import { useState, useTransition } from 'react'
import { ToggleLeft, ToggleRight } from 'lucide-react'
import { updateAvailability } from '@/lib/actions'

export default function AvailabilityToggle({
  initial,
}: {
  initial: boolean
}) {
  const [available, setAvailable] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !available
    setAvailable(next)
    startTransition(async () => {
      const result = await updateAvailability(next)
      if (result?.error) setAvailable(!next)
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="transition hover:opacity-80 disabled:opacity-40"
      aria-label={available ? 'Mark as unavailable' : 'Mark as available'}
    >
      {available ? (
        <ToggleRight className="h-10 w-10 text-green-500" />
      ) : (
        <ToggleLeft className="h-10 w-10 text-slate-300" />
      )}
    </button>
  )
}
