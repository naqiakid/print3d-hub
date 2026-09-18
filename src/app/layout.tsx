import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import ReferralTracker from '@/components/ReferralTracker'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Qid3D Studio | Custom 3D Printing & 3MF Models · Ampang, KL',
    template: '%s | Qid3D Studio'
  },
  description:
    'High-precision personal 3D printing studio in Ampang, Selangor. Upload STL/3MF files for instant pricing or shop ready-to-order models. Specializing in PLA, durable PETG, and flexible TPU with local pickup & nationwide shipping.',
  keywords: [
    '3d printing ampang',
    '3d printing malaysia',
    'custom 3d prints',
    'stl printing kl',
    'ender 3 v3 se printing',
    'tpu flexible 3d print',
    'petg functional parts',
    '3mf model figures',
    'qid3d studio',
    'rapid prototyping selangor'
  ],
  openGraph: {
    type: 'website',
    locale: 'en_MY',
    url: 'https://print3d-hub.vercel.app',
    siteName: 'Qid3D Studio',
    title: 'Qid3D Studio | Custom 3D Printing & 3MF Models · Ampang, KL',
    description: 'High-precision personal 3D printing studio in Ampang, Selangor. Instant quotes for STL/3MF files, ready-to-order catalog, and flexible TPU printing.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Qid3D Studio | Custom 3D Printing & 3MF Models · Ampang, KL',
    description: 'High-precision personal 3D printing studio in Ampang, Selangor. Instant quotes for STL/3MF files and flexible TPU printing.',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <ReferralTracker />
        <Navbar />
        <main className="flex-1">{children}</main>
        
        {/* Rich Malaysian E-Commerce Footer */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
              
              {/* Col 1: Brand & Identity */}
              <div className="space-y-3 md:col-span-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 font-black text-white text-sm shadow-sm">
                    Q
                  </div>
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                    Qid<span className="text-orange-500">3D</span> Studio
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Precision custom 3D printing &amp; rapid prototyping studio based in Ampang, Selangor. Direct-drive FDM printing in PLA, PETG, and flexible TPU.
                </p>
                <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                  <p>📍 Ampang, Selangor, Malaysia</p>
                  <p>📦 Self-Pickup &amp; Nationwide Delivery</p>
                </div>
              </div>

              {/* Col 2: Services & Shop */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Services &amp; Shop
                </h4>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li>
                    <a href="/#quote" className="hover:text-orange-600 transition">Instant STL/3MF Quote</a>
                  </li>
                  <li>
                    <a href="/browse/products" className="hover:text-orange-600 transition">Ready-to-Buy Catalog</a>
                  </li>
                  <li>
                    <a href="/#materials" className="hover:text-orange-600 transition">Materials &amp; Machine Specs</a>
                  </li>
                  <li>
                    <a href="/track" className="hover:text-orange-600 transition">Track Your Order</a>
                  </li>
                  <li>
                    <a href="/admin" className="hover:text-slate-900 transition flex items-center gap-1.5 text-slate-500 hover:text-orange-600">
                      <span>Admin &amp; Staff Portal</span>
                      <span className="text-[10px]">🔒</span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Col 3: Legal & Consumer Compliance */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Legal &amp; Policies
                </h4>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li>
                    <a href="/terms" className="hover:text-orange-600 transition">Terms of Service</a>
                  </li>
                  <li>
                    <a href="/refund-policy" className="hover:text-orange-600 transition">Refund &amp; Reprint Policy</a>
                  </li>
                  <li>
                    <a href="/privacy" className="hover:text-orange-600 transition">Privacy Notice (PDPA 2010)</a>
                  </li>
                </ul>
                <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-400 border border-slate-150 leading-normal">
                  Operating under Consumer Protection (E-Commerce Transactions) Regulations 2012.
                </div>
              </div>

              {/* Col 4: Payment & Delivery Trust */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Payment &amp; Couriers
                </h4>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700 mb-1">Supported Payments</p>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">DuitNow QR</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">FPX Online Banking</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">Cards</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700 mb-1">Courier Partners</p>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">J&amp;T Express</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">Pos Laju</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">Ninja Van</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <p>© {new Date().getFullYear()} Qid3D Studio. All rights reserved.</p>
              <div className="flex items-center gap-3">
                <span>Handcrafted with precision in Ampang, Malaysia</span>
                <span>•</span>
                <a href="/admin" className="hover:text-slate-600 transition flex items-center gap-1">
                  <span>Staff Access</span>
                  <span className="text-[10px]">🔒</span>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
