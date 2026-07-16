'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, LayoutDashboard, Wrench, Settings, LogOut, Store, ShoppingBag, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { logout } from '@/lib/actions'

export default function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const initial = email[0]?.toUpperCase() ?? '?'

  function handleLogout() {
    startTransition(async () => {
      await logout()
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 transition"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
          {initial}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="truncate text-sm font-medium text-slate-700">{email}</p>
            </div>

            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <LayoutDashboard className="h-4 w-4 text-slate-400" /> Dashboard
            </Link>
            <Link
              href="/dashboard/listing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Store className="h-4 w-4 text-slate-400" /> My Listing
            </Link>
            <Link
              href="/dashboard/catalog"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <ShoppingBag className="h-4 w-4 text-slate-400" /> My Products
            </Link>
            <Link
              href="/dashboard/equipment"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Wrench className="h-4 w-4 text-slate-400" /> Equipment
            </Link>
            <Link
              href="/dashboard/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Settings className="h-4 w-4 text-slate-400" /> Account settings
            </Link>
            <Link
              href="/dashboard/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <HelpCircle className="h-4 w-4 text-slate-400" /> Help & Guide
            </Link>

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={handleLogout}
              disabled={isPending}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {isPending ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
