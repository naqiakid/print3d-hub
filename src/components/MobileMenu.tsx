'use client'

import { useState, useEffect } from 'react'
import { Menu, X, Printer, Compass, ShoppingBag, LayoutDashboard, Wrench, Settings, HelpCircle, Store, ClipboardList, LogIn, Plus } from 'lucide-react'
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
              <Printer className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Print3D<span className="text-orange-500">Hub</span>
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
          {/* Main Navigation */}
          <div>
            <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">Explore</p>
            <div className="mt-3 space-y-1.5">
              <Link
                href="/printers"
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                  pathname.startsWith('/printers')
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Compass className="h-5 w-5" />
                Browse Printers
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
                Browse Products
              </Link>
            </div>
          </div>

          {/* Dashboard / Profile Section */}
          <div>
            <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              {userEmail ? 'Dashboard' : 'Account'}
            </p>
            <div className="mt-3 space-y-1.5">
              {userEmail ? (
                <>
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname === '/dashboard'
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    Dashboard Home
                  </Link>
                  <Link
                    href="/dashboard/listing"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname === '/dashboard/listing'
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Store className="h-5 w-5" />
                    My Listing
                  </Link>
                  <Link
                    href="/dashboard/catalog"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname === '/dashboard/catalog'
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    My Products
                  </Link>
                  <Link
                    href="/dashboard/equipment"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname === '/dashboard/equipment'
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Wrench className="h-5 w-5" />
                    Equipment & Filaments
                  </Link>
                  <Link
                    href="/dashboard/account"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname === '/dashboard/account'
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Settings className="h-5 w-5" />
                    Account settings
                  </Link>
                  <Link
                    href="/dashboard/help"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname === '/dashboard/help'
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <HelpCircle className="h-5 w-5" />
                    Help & Guide
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/track"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname.startsWith('/track')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardList className="h-5 w-5" />
                    Track order
                  </Link>
                  <Link
                    href="/login"
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-semibold transition-all active:scale-[0.98] ${
                      pathname === '/login'
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <LogIn className="h-5 w-5" />
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom CTA (fixed at bottom of container) */}
        {!userEmail && (
          <div className="pt-4 border-t border-slate-100 shrink-0">
            <Link
              href="/register"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" />
              List Your Printer
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
