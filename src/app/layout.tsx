import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import ReferralTracker from '@/components/ReferralTracker'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: '3MF Studio | Custom 3D Printing & 3MF Models · Ampang, KL',
    template: '%s | 3MF Studio'
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
    '3mf studio',
    'rapid prototyping selangor'
  ],
  openGraph: {
    type: 'website',
    locale: 'en_MY',
    url: 'https://print3d-hub.vercel.app',
    siteName: '3MF Studio',
    title: '3MF Studio | Custom 3D Printing & 3MF Models · Ampang, KL',
    description: 'High-precision personal 3D printing studio in Ampang, Selangor. Instant quotes for STL/3MF files, ready-to-order catalog, and flexible TPU printing.',
  },
  twitter: {
    card: 'summary_large_image',
    title: '3MF Studio | Custom 3D Printing & 3MF Models · Ampang, KL',
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
        
        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              {/* Col 1: Brand & Bio */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white font-black text-xs">
                    3D
                  </span>
                  <span className="font-bold text-slate-900 tracking-tight text-base">
                    3MF Studio
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                  Personal 3D printing studio based in Ampang, Selangor. Custom prototyping, engineering parts, and ready-to-buy catalog models delivered nationwide across Malaysia.
                </p>
                <div className="pt-2 flex flex-col gap-1.5">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Studio Accepting Orders · Ampang, Selangor
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <span>✉️</span>
                    <a href="mailto:3mfstudio@gmail.com" className="font-medium text-slate-700 hover:text-orange-600 transition underline underline-offset-2">
                      3mfstudio@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Col 2: Navigation Links */}
              <div className="space-y-2.5 text-xs text-slate-600">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Quick Links</p>
                <ul className="space-y-2">
                  <li><a href="/" className="hover:text-orange-600 transition">Instant Price Estimator</a></li>
                  <li><a href="/catalog" className="hover:text-orange-600 transition">Ready-to-Order Catalog</a></li>
                  <li><a href="/request" className="hover:text-orange-600 transition">Request Custom Print</a></li>
                  <li><a href="/track" className="hover:text-orange-600 transition">Track Your Order</a></li>
                </ul>
              </div>

              {/* Col 3: Compliance & Logistics */}
              <div className="space-y-2.5 text-xs text-slate-600">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Customer &amp; Legal</p>
                <ul className="space-y-2">
                  <li><a href="/terms" className="hover:text-orange-600 transition">Terms of Service</a></li>
                  <li><a href="/privacy" className="hover:text-orange-600 transition">Privacy Policy (PDPA)</a></li>
                  <li><a href="/refund-policy" className="hover:text-orange-600 transition">Refund &amp; Reprint Policy</a></li>
                </ul>
                <div className="pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Supported Payments</p>
                  <div className="flex flex-wrap gap-1 text-[10px] font-medium text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">DuitNow QR</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">FPX Online Banking</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">GrabPay</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">Visa / Mastercard</span>
                  </div>
                </div>
                <div className="pt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Domestic Couriers</p>
                  <div className="flex flex-wrap gap-1 text-[10px] font-medium text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">J&amp;T Express</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">Pos Laju</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">Ninja Van</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <p>© {new Date().getFullYear()} 3MF Studio. All rights reserved.</p>
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
