import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Print3DHub — Get Anything 3D Printed Near You',
  description:
    'Find local 3D printing services in your area. No printer needed, no technical knowledge required. Browse, request, and pick up.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
              <p className="text-sm font-semibold text-slate-900">
                Print3D<span className="text-orange-500">Hub</span>
              </p>
              <p className="text-xs text-slate-400">
                Making 3D printing accessible to everyone.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
