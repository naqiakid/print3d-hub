import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Print3D Hub | Get Anything 3D Printed Near You',
    template: '%s | Print3D Hub'
  },
  description:
    'Find local 3D printing services in your area. No printer needed. Browse ready-made designs, customize colors or names, and pick up locally.',
  keywords: [
    '3d printing',
    'local 3d printing',
    '3d print service',
    'custom 3d prints',
    'stl printing',
    '3mf assembly',
    '3d printer hub',
    'pla printing',
    'petg printing',
    'local makers',
    'rapid prototyping'
  ],
  openGraph: {
    type: 'website',
    locale: 'en_MY',
    url: 'https://print3d-hub.vercel.app',
    siteName: 'Print3D Hub',
    title: 'Print3D Hub | Local 3D Printing Service Near You',
    description: 'Find local 3D printing services in your area. Browse ready-made designs, customize colors or names, and pick up locally.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Print3D Hub | Local 3D Printing Service Near You',
    description: 'Find local 3D printing services in your area. Browse ready-made designs, customize colors or names, and pick up locally.',
  }
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
