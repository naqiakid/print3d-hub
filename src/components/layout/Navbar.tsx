import Link from 'next/link'
import { Printer } from 'lucide-react'
import NavLinks from './NavLinks'
import UserMenu from './UserMenu'
import MobileMenu from './MobileMenu'
import StudioLogo from './StudioLogo'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md supports-[backdrop-filter]:bg-neutral-950/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="transition hover:opacity-90">
          <StudioLogo size="md" />
        </Link>

        <NavLinks />

        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2.5">
              <Link
                href="/dashboard"
                className="hidden items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-neutral-200 shadow-sm transition hover:border-neutral-700 hover:bg-neutral-800 sm:flex"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Admin Console</span>
              </Link>
              <UserMenu email={user.email ?? ''} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/#quote"
                className="hidden rounded-xl border border-neutral-700 bg-neutral-900/90 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-black/30 transition-all hover:border-neutral-500 hover:bg-neutral-800 hover:shadow-orange-500/10 active:scale-95 sm:block"
              >
                Upload 3D File
              </Link>
            </div>
          )}
          <MobileMenu userEmail={user?.email ?? null} />
        </div>
      </div>
    </header>
  )
}
