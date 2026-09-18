'use client'

import { useState, useEffect } from 'react'
import {
  Menu,
  X,
  Printer,
  Compass,
  ShoppingBag,
  LayoutDashboard,
  Wrench,
  Settings,
  HelpCircle,
  Store,
  ClipboardList,
  Calculator,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MobileMenuProps {
  userEmail: string | null
}

export default function MobileMenu({ userEmail }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close menu when pathname changes
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div className="sm:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition active:scale-95"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Slide-over backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex h-screen h-[100dvh] w-[85vw] max-w-[340px] flex-col bg-white p-5 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full invisible'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 shadow-md shadow-orange-200">
              <span className="font-black text-white text-base">Q</span>
            </div>
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">
              Qid<span className="text-orange-500">3D</span> Studio
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition active:scale-90"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Links list (scrollable area) */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6 min-h-0 pr-1">
          {/* Main Customer Navigation */}
          <div>
            <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Services &amp; Shop
            </p>
            <div className="mt-3 space-y-1.5">
              <Link
                href="/#quote"
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                  pathname === '/#quote'
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Compass className="h-5 w-5" />
                Instant 3D Quote
              </Link>
              <Link
                href="/browse/products"
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                  pathname.startsWith('/browse/products')
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="h-5 w-5" />
                Shop Catalog
              </Link>
              <Link
                href="/#materials"
                className="flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98]"
              >
                <Wrench className="h-5 w-5" />
                Materials &amp; Specs
              </Link>
              <Link
                href="/track"
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                  pathname.startsWith('/track')
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="h-5 w-5" />
                Track Order
              </Link>
            </div>
          </div>

          {/* Authenticated Staff & Admin Navigation */}
          {userEmail && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-3">
              <div className="flex items-center gap-1.5 px-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider text-orange-800">
                  Staff &amp; Operations
                </p>
              </div>
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    pathname === '/dashboard'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-orange-100/70'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Order Queue &amp; Jobs
                </Link>
                <Link
                  href="/dashboard/materials"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    pathname === '/dashboard/materials'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-orange-100/70'
                  }`}
                >
                  <Wrench className="h-4 w-4" />
                  Spools &amp; Inventory
                </Link>
                <Link
                  href="/dashboard/catalog"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    pathname === '/dashboard/catalog'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-orange-100/70'
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Catalog Products
                </Link>
                <Link
                  href="/dashboard/equipment"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    pathname === '/dashboard/equipment'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-orange-100/70'
                  }`}
                >
                  <Printer className="h-4 w-4" />
                  Ender-3 Hardware
                </Link>
                <Link
                  href="/dashboard/price-calculator"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    pathname === '/dashboard/price-calculator'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-orange-100/70'
                  }`}
                >
                  <Calculator className="h-4 w-4" />
                  Price Calculator
                </Link>
                <Link
                  href="/dashboard/account"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    pathname === '/dashboard/account'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-orange-100/70'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Store Settings
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Bottom CTA (fixed at bottom of container) */}
        <div className="pt-4 border-t border-slate-100 shrink-0 space-y-3">
          <Link
            href="/#quote"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98]"
          >
            Upload 3D File (Get Quote)
          </Link>

          {!userEmail && (
            <Link
              href="/admin"
              className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition py-1"
            >
              <Lock className="h-3 w-3" />
              <span>Staff &amp; Admin Portal</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
