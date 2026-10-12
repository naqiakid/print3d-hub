import Link from 'next/link'
import { ShieldCheck, PackageSearch, Lock } from 'lucide-react'
import AuthForm from '@/components/AuthForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staff & Admin Portal | 3MF Studio',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        {/* Admin Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-orange-400 shadow-xl">
            <Lock className="h-6 w-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-2">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-300" />
            <span>Studio Console Access</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            3MF STUDIO
          </h1>
          <p className="mt-1 text-xs text-neutral-400 max-w-xs mx-auto">
            Authorized sign-in for studio owners, print technicians, and administrators.
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-7 shadow-2xl backdrop-blur-md">
          <AuthForm mode="login" />
          <div className="mt-4 pt-4 border-t border-neutral-800 text-center">
            <Link
              href="/signup"
              className="text-xs font-mono text-neutral-400 hover:text-white transition"
            >
              First time setup? Register your admin account →
            </Link>
          </div>
        </div>

        {/* Customer Guidance Notice */}
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950/60 p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-neutral-200 mb-1">
            <PackageSearch className="h-4 w-4 text-orange-400" />
            <span>Are you a customer tracking an order?</span>
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            You do not need an account or password to check your 3D print status.
          </p>
          <Link
            href="/track"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-medium text-neutral-200 hover:border-neutral-500 hover:text-white transition shadow-sm"
          >
            <span>Track Order with Request ID</span>
            <span>→</span>
          </Link>
        </div>

        <p className="text-center text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
          3MF Studio Precision Engineering · Ampang, Selangor
        </p>
      </div>
    </div>
  )
}
