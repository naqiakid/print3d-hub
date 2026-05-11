import Link from 'next/link'
import { Printer } from 'lucide-react'
import AuthForm from '@/components/AuthForm'

export default function SignupPage() {
  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500">
            <Printer className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">List your printer</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a free account to start earning from your 3D printer
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <AuthForm mode="signup" />
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-orange-500 hover:text-orange-600">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
