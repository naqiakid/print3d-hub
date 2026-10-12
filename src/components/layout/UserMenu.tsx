'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, LayoutDashboard, Wrench, Settings, LogOut, Store, ShoppingBag, HelpCircle, Users } from 'lucide-react'
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
        className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:border-neutral-700 hover:bg-neutral-850 transition"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-black">
          {initial}
        </span>
        <ChevronDown className={`h-3 w-3 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-neutral-800 bg-neutral-950 py-1.5 shadow-2xl backdrop-blur-md">
            <div className="border-b border-neutral-900 px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Staff Account</p>
              <p className="truncate text-xs font-medium text-neutral-200 mt-0.5">{email}</p>
            </div>

            <div className="py-1">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-neutral-400" /> Console Dashboard
              </Link>
              <Link
                href="/dashboard/listing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition"
              >
                <Store className="h-3.5 w-3.5 text-neutral-400" /> Studio Profile
              </Link>
              <Link
                href="/dashboard/catalog"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-neutral-400" /> Catalog Inventory
              </Link>
              <Link
                href="/dashboard/equipment"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition"
              >
                <Wrench className="h-3.5 w-3.5 text-neutral-400" /> Ender-3 Equipment
              </Link>
              <Link
                href="/dashboard/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition"
              >
                <Settings className="h-3.5 w-3.5 text-neutral-400" /> Studio Settings
              </Link>
              <Link
                href="/dashboard/help"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition"
              >
                <HelpCircle className="h-3.5 w-3.5 text-neutral-400" /> Help &amp; Slicing Guide
              </Link>
            </div>

            <div className="my-1 border-t border-neutral-900" />

            <button
              onClick={handleLogout}
              disabled={isPending}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
