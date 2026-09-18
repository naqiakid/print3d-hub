import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Gateway | Qid3D Studio',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If already authenticated as owner or staff, redirect straight to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // Otherwise, route to the dedicated staff & admin login
  redirect('/login?portal=admin')
}
