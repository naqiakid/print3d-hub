import Link from 'next/link'
import { ShieldCheck, Lock } from 'lucide-react'
import AuthForm from '@/components/AuthForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Setup Admin Account | Qid3D Studio',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SignupPage() {
  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-orange-500 shadow-md shadow-slate-900/10">
            <Lock className="h-7 w-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 mb-2">
            <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
            <span>Initial Setup</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Create Admin Account
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Register your administrator credentials for Qid3D Studio
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <AuthForm mode="signup" />
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-orange-500 hover:text-orange-600">
            Log in to Admin Portal
          </Link>
        </p>
      </div>
    </div>
  )
}
