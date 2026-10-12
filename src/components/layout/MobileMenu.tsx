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
import StudioLogo from './StudioLogo'

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
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white transition active:scale-95"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Slide-over backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex h-screen h-[100dvh] w-[85vw] max-w-[340px] flex-col bg-neutral-950 border-l border-neutral-850 p-6 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full invisible'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-900 pb-5 shrink-0">
          <Link href="/" onClick={() => setOpen(false)}>
            <StudioLogo size="sm" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition active:scale-90"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Links list (scrollable area) */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6 min-h-0 pr-1">
          {/* Main Customer Navigation */}
          <div>
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
              Services &amp; Catalog
            </p>
            <div className="mt-3 space-y-1.5">
              <Link
                href="/#quote"
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                  pathname === '/#quote'
                    ? 'bg-neutral-900 text-white border border-neutral-800'
                    : 'text-neutral-300 hover:bg-neutral-900/60 hover:text-white'
                }`}
              >
                <Compass className="h-4 w-4 text-orange-400" />
                Instant 3D Quote
              </Link>
              <Link
                href="/browse/products"
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                  pathname.startsWith('/browse/products')
                    ? 'bg-neutral-900 text-white border border-neutral-800'
                    : 'text-neutral-300 hover:bg-neutral-900/60 hover:text-white'
                }`}
              >
                <ShoppingBag className="h-4 w-4 text-orange-400" />
                Shop Catalog
              </Link>
              <Link
                href="/#materials"
                className="flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold text-neutral-300 hover:bg-neutral-900/60 hover:text-white transition-all active:scale-[0.98]"
              >
                <Wrench className="h-4 w-4 text-orange-400" />
                Materials &amp; Specs
              </Link>
              <Link
                href="/track"
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                  pathname.startsWith('/track')
                    ? 'bg-neutral-900 text-white border border-neutral-800'
                    : 'text-neutral-300 hover:bg-neutral-900/60 hover:text-white'
                }`}
              >
                <ClipboardList className="h-4 w-4 text-orange-400" />
                Track Active Order
              </Link>
            </div>
          </div>

          {/* Authenticated Staff & Admin Navigation */}
          {userEmail && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
              <div className="flex items-center gap-1.5 px-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                  Staff Console
                </p>
              </div>
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    pathname === '/dashboard'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Order Queue &amp; Jobs
                </Link>
                <Link
                  href="/dashboard/materials"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    pathname === '/dashboard/materials'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Spools &amp; Inventory
                </Link>
                <Link
                  href="/dashboard/catalog"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    pathname === '/dashboard/catalog'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Catalog Products
                </Link>
                <Link
                  href="/dashboard/equipment"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    pathname === '/dashboard/equipment'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Ender-3 Hardware
                </Link>
                <Link
                  href="/dashboard/account"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    pathname === '/dashboard/account'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Studio Settings
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="pt-4 border-t border-neutral-900 shrink-0 space-y-3">
          <Link
            href="/#quote"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-white/5 transition hover:bg-neutral-200 active:scale-[0.98]"
          >
            Upload 3D File (Get Quote)
          </Link>

          {!userEmail && (
            <Link
              href="/admin"
              className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition py-1"
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
