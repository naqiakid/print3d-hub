import Link from 'next/link'
import { Printer } from 'lucide-react'
import NavLinks from './NavLinks'
import UserMenu from './UserMenu'
import MobileMenu from './MobileMenu'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
            <Printer className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">
            Print3D<span className="text-orange-500">Hub</span>
          </span>
        </Link>

        <NavLinks />

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors sm:block"
              >
                Dashboard
              </Link>
              <UserMenu email={user.email ?? ''} />
            </>
          ) : (
            <>
              <Link
                href="/track"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors sm:block"
              >
                Track order
              </Link>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors sm:block"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="hidden rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 sm:block"
              >
                List Your Printer
              </Link>
            </>
          )}
          <MobileMenu userEmail={user?.email ?? null} />
        </div>
      </div>
    </header>
  )
}
