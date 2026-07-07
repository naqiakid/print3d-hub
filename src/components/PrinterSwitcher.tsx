'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Printer as PrinterIcon, Plus } from 'lucide-react'

type SwitcherPrinter = { id: string; name: string; printer_model: string }

export default function PrinterSwitcher({
  printers,
  currentId,
}: {
  printers: SwitcherPrinter[]
  currentId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (printers.length < 2) return null

  const current = printers.find((p) => p.id === currentId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
      >
        <PrinterIcon className="h-3.5 w-3.5 text-slate-400" />
        {current?.name ?? 'Select printer'}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <p className="px-3 py-2 text-xs font-medium text-slate-400">Your printers</p>
            {printers.map((p) => (
              <button
                key={p.id}
                onClick={() => { setOpen(false); router.push(`/dashboard/${p.id}`) }}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                  p.id === currentId ? 'bg-orange-50' : ''
                }`}
              >
                <span className={`font-medium ${p.id === currentId ? 'text-orange-700' : 'text-slate-800'}`}>{p.name}</span>
                <span className="text-xs text-slate-400">{p.printer_model}</span>
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button
              onClick={() => { setOpen(false); router.push('/register') }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add another printer
            </button>
          </div>
        </>
      )}
    </div>
  )
}
