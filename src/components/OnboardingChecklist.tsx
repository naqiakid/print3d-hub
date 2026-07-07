'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X } from 'lucide-react'

type Step = { key: string; label: string; done: boolean; href?: string }

export default function OnboardingChecklist({
  printerId,
  hasFilaments,
  isAvailable,
  hasCatalogItem,
  hasRequest,
}: {
  printerId: string
  hasFilaments: boolean
  isAvailable: boolean
  hasCatalogItem: boolean
  hasRequest: boolean
}) {
  const storageKey = `onboarding_dismissed_${printerId}`
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === '1')
    setMounted(true)
  }, [storageKey])

  if (!mounted || dismissed) return null

  const steps: Step[] = [
    { key: 'filaments', label: 'Add your filament stock', done: hasFilaments, href: `/dashboard/${printerId}/equipment` },
    { key: 'available', label: 'Turn on availability', done: isAvailable, href: `/dashboard/${printerId}/listing` },
    { key: 'catalog', label: 'List a product in your catalog', done: hasCatalogItem, href: `/dashboard/${printerId}/catalog` },
    { key: 'request', label: 'Get your first request', done: hasRequest },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length

  function dismiss() {
    localStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  if (allDone) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
        <span className="text-sm font-medium text-green-700">
          ✓ You&apos;re all set up! ({doneCount}/{steps.length})
        </span>
        <button type="button" onClick={dismiss} className="text-green-600 hover:text-green-800 transition">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50/40 p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Getting started · {doneCount}/{steps.length} done</p>
          <p className="mt-0.5 text-xs text-slate-500">
            A few quick steps to get your printer ready for real customers.
          </p>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 text-slate-400 hover:text-slate-600 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {steps.map((step) => {
          const row = (
            <div
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                step.done
                  ? 'border-green-200 bg-green-50'
                  : 'border-slate-200 bg-white hover:border-orange-200'
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-300" />
              )}
              <span className={`text-sm ${step.done ? 'text-slate-400 line-through' : 'font-medium text-slate-700'}`}>
                {step.label}
              </span>
            </div>
          )
          return step.href && !step.done ? (
            <Link key={step.key} href={step.href}>{row}</Link>
          ) : (
            <div key={step.key}>{row}</div>
          )
        })}
      </div>

      <Link
        href="/dashboard/help"
        className="mt-3 inline-block text-xs font-medium text-orange-600 hover:text-orange-700 transition"
      >
        Need more detail? View the full guide →
      </Link>
    </div>
  )
}
