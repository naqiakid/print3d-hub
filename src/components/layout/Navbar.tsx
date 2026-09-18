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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 shadow-sm shadow-orange-500/30">
            <span className="font-black text-white text-sm">Q</span>
          </div>
          <span className="text-base font-extrabold text-slate-900 tracking-tight">
            Qid<span className="text-orange-500">3D</span> Studio
          </span>
        </Link>

        <NavLinks />

        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2.5">
              <Link
                href="/dashboard"
                className="hidden items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-1.5 text-xs font-bold text-orange-800 shadow-sm transition hover:bg-orange-100 sm:flex"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Admin Dashboard</span>
              </Link>
              <UserMenu email={user.email ?? ''} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/#quote"
                className="hidden rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-95 sm:block"
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
