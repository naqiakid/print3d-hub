'use client'

import { useState } from 'react'
import { CheckCircle, Upload } from 'lucide-react'
import type { Printer, PrintType, MaterialFeel, PrintSize, PrintQuality } from '@/lib/types'
import {
  PRINT_TYPE_LABELS,
  PRINT_TYPE_DESCRIPTIONS,
  MATERIAL_LABELS,
  MATERIAL_DESCRIPTIONS,
  SIZE_LABELS,
  QUALITY_LABELS,
} from '@/lib/types'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

export default function RequestForm({ printer }: { printer: Printer }) {
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [printType, setPrintType] = useState<PrintType | ''>('')
  const [material, setMaterial] = useState<MaterialFeel | ''>('')
  const [size, setSize] = useState<PrintSize | ''>('')
  const [quality, setQuality] = useState<PrintQuality | ''>('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!printType || !material || !size || !quality) return
    setPending(true)
    await new Promise((r) => setTimeout(r, 1000))
    setPending(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-900">Request sent!</h2>
        <p className="max-w-sm text-sm text-slate-600">
          <strong>{printer.name}</strong> will review your request and email you a quote
          within {printer.turnaround}.
        </p>
        <a
          href="/printers"
          className="mt-6 text-sm font-medium text-orange-500 hover:text-orange-600"
        >
          Browse more printers →
        </a>
      </div>
    )
  }

  const allSelected = printType && material && size && quality

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer info */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Your contact details</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-slate-600">
              Name <span className="text-red-500">*</span>
            </label>
            <input id="name" name="name" type="text" required placeholder="Ahmad Farid" className={inputClass} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-xs font-medium text-slate-600">
              WhatsApp / Phone <span className="text-red-500">*</span>
            </label>
            <input id="phone" name="phone" type="tel" required placeholder="+601X-XXXXXXX" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">
              Email <span className="text-red-500">*</span>
            </label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" className={inputClass} />
          </div>
        </div>
      </div>

      {/* What to print */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">What do you want printed?</h3>
        <textarea
          name="description"
          required
          rows={3}
          placeholder="Describe what you need. e.g. A small phone stand for my desk, roughly 10cm tall..."
          className={`${inputClass} resize-none`}
        />
        {/* File upload */}
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50 transition">
          <Upload className="h-4 w-4" />
          <span>Upload file (STL / OBJ / 3MF) — optional</span>
          <input name="file" type="file" accept=".stl,.obj,.3mf" className="hidden" />
        </label>
      </div>

      {/* Print type */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">
          Print type <span className="text-red-500">*</span>
        </h3>
        <p className="mb-3 text-xs text-slate-400">What kind of print do you need?</p>
        <div className="flex flex-wrap gap-2">
          {printer.print_types.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setPrintType(type)}
              className={`rounded-xl border px-4 py-2.5 text-left transition ${
                printType === type
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
              }`}
            >
              <p className="text-sm font-medium">{PRINT_TYPE_LABELS[type]}</p>
              <p className="text-xs text-slate-500">{PRINT_TYPE_DESCRIPTIONS[type]}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Material */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">
          Material feel <span className="text-red-500">*</span>
        </h3>
        <p className="mb-3 text-xs text-slate-400">How should it feel?</p>
        <div className="flex flex-wrap gap-2">
          {printer.materials.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMaterial(m)}
              className={`rounded-xl border px-4 py-2.5 text-left transition ${
                material === m
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
              }`}
            >
              <p className="text-sm font-medium">{MATERIAL_LABELS[m]}</p>
              <p className="text-xs text-slate-500">{MATERIAL_DESCRIPTIONS[m]}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Size + Quality */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            Size <span className="text-red-500">*</span>
          </h3>
          <div className="flex flex-col gap-2">
            {(['small', 'medium', 'large'] as PrintSize[]).map((s) => {
              const allowed =
                s === 'small' ||
                (s === 'medium' && printer.max_size !== 'small') ||
                (s === 'large' && printer.max_size === 'large')
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!allowed}
                  onClick={() => setSize(s)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    size === s
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : allowed
                      ? 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                  }`}
                >
                  {SIZE_LABELS[s]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            Quality <span className="text-red-500">*</span>
          </h3>
          <div className="flex flex-col gap-2">
            {(['draft', 'standard', 'premium'] as PrintQuality[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  quality === q
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                }`}
              >
                {QUALITY_LABELS[q]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deadline + Notes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="deadline" className="mb-1 block text-xs font-medium text-slate-600">
            When do you need it? <span className="text-red-500">*</span>
          </label>
          <input id="deadline" name="deadline" type="date" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="notes" className="mb-1 block text-xs font-medium text-slate-600">
            Any other notes?
          </label>
          <input id="notes" name="notes" type="text" placeholder="Colour preference, quantity..." className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || !allSelected}
        className="w-full rounded-xl bg-orange-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Sending request...' : 'Send Request'}
      </button>
    </form>
  )
}
