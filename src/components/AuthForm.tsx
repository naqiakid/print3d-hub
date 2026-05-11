'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition'

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setPending(true)
    await new Promise((r) => setTimeout(r, 800))
    setPending(false)
    // TODO: connect to Supabase Auth
    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'signup' && (
        <div>
          <label htmlFor="name" className="mb-1 block text-xs font-medium text-slate-600">
            Full name
          </label>
          <input id="name" name="name" type="text" required placeholder="Ahmad Farid" className={inputClass} />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">
          Email
        </label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" className={inputClass} />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-slate-600">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
          minLength={8}
          className={inputClass}
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
      >
        {pending
          ? mode === 'login'
            ? 'Logging in...'
            : 'Creating account...'
          : mode === 'login'
          ? 'Log in'
          : 'Create account'}
      </button>
    </form>
  )
}
