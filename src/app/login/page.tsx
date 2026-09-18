import Link from 'next/link'
import { ShieldCheck, PackageSearch, Lock } from 'lucide-react'
import AuthForm from '@/components/AuthForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staff & Admin Portal | Qid3D Studio',
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-orange-500 shadow-md shadow-slate-900/10">
            <Lock className="h-7 w-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 mb-2">
            <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
            <span>Staff &amp; Operations Access</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Qid<span className="text-orange-500">3D</span> Studio Admin
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
            Authorized sign-in for studio owner, print operators, and website administrators.
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <AuthForm mode="login" />
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <Link
              href="/signup"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline transition"
            >
              ⚡ First time setup? Register your admin account →
            </Link>
          </div>
        </div>

        {/* Customer Guidance Notice */}
        <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-orange-950 mb-1">
            <PackageSearch className="h-4 w-4 text-orange-600" />
            <span>Are you a customer tracking an order?</span>
          </div>
          <p className="text-xs text-orange-800/80 mb-3">
            You do not need an account or password to check your 3D print status.
          </p>
          <Link
            href="/track"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-orange-700 shadow-sm border border-orange-200 hover:bg-orange-50 transition"
          >
            <span>Track Order with Request ID</span>
            <span>→</span>
          </Link>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Qid3D Studio Internal System · Ampang, Selangor
        </p>
      </div>
    </div>
  )
}
