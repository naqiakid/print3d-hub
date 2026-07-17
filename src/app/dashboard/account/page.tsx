import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const createdAt = new Date(user.created_at).toLocaleDateString('en-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-slate-900">Account settings</h1>

      {/* Profile info */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <div>
          <p className="text-xs text-slate-400">Email address</p>
          <p className="mt-0.5 text-sm font-medium text-slate-900">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Member since</p>
          <p className="mt-0.5 text-sm font-medium text-slate-900">{createdAt}</p>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Change password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  )
}
