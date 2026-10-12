import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import StudioLogo from '@/components/layout/StudioLogo'
import ReferralTracker from '@/components/ReferralTracker'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="flex min-h-full flex-col bg-neutral-950 text-neutral-100 antialiased selection:bg-orange-500/25 selection:text-orange-200">
        <ReferralTracker />
        <Navbar />
        <main className="flex-1">{children}</main>
        
        {/* ── Dark Luxury Footer (Website Footer Monochrome Guidelines) ── */}
        <footer className="mt-auto border-t border-neutral-900 bg-neutral-950 text-neutral-300 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
              
              {/* Col 1: Brand & Bio */}
              <div className="md:col-span-2 space-y-4">
                <StudioLogo size="md" variant="flat" />
                <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
                  Personal additive manufacturing studio based in Ampang, Selangor. Specializing in rapid prototyping, functional engineering parts, and custom 3MF/STL models with nationwide delivery.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 border border-neutral-800 px-3 py-1 text-[11px] font-semibold text-neutral-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      Studio Active &amp; Queue Open · Ampang, Selangor
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 flex items-center gap-2 pt-0.5">
                    <span>✉️</span>
                    <a href="mailto:3mfstudio@gmail.com" className="font-medium text-neutral-200 hover:text-orange-400 transition underline underline-offset-4">
                      3mfstudio@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Col 2: Navigation Links */}
              <div className="space-y-3 text-xs text-neutral-400">
                <p className="font-bold text-white uppercase tracking-[0.2em] text-[11px]">Explore</p>
                <ul className="space-y-2">
                  <li><a href="/#quote" className="hover:text-white transition">Instant 3D Slicing &amp; Quote</a></li>
                  <li><a href="/browse/products" className="hover:text-white transition">Ready-to-Print Shop</a></li>
                  <li><a href="/#materials" className="hover:text-white transition">Supported Materials &amp; Specs</a></li>
                  <li><a href="/track" className="hover:text-white transition">Track Active Print Order</a></li>
                </ul>
              </div>

              {/* Col 3: Customer & Payment */}
              <div className="space-y-3 text-xs text-neutral-400">
                <p className="font-bold text-white uppercase tracking-[0.2em] text-[11px]">Customer &amp; Legal</p>
                <ul className="space-y-2">
                  <li><a href="/terms" className="hover:text-white transition">Terms of Service</a></li>
                  <li><a href="/privacy" className="hover:text-white transition">Privacy Policy (PDPA)</a></li>
                  <li><a href="/refund-policy" className="hover:text-white transition">Reprint &amp; Guarantee Policy</a></li>
                </ul>
                <div className="pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-1.5">Payment Channels</p>
                  <div className="flex flex-wrap gap-1 text-[10px] font-medium text-neutral-300">
                    <span className="rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800">DuitNow QR</span>
                    <span className="rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800">FPX Online</span>
                    <span className="rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800">GrabPay</span>
                    <span className="rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800">Card</span>
                  </div>
                </div>
                <div className="pt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-1.5">Dispatch Couriers</p>
                  <div className="flex flex-wrap gap-1 text-[10px] font-medium text-neutral-300">
                    <span className="rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800">J&amp;T Express</span>
                    <span className="rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800">Pos Laju</span>
                    <span className="rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800">Runner</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Bar */}
            <div className="border-t border-neutral-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
              <p>© {new Date().getFullYear()} 3MF Studio. Precision Additive Manufacturing.</p>
              <div className="flex items-center gap-3">
                <span>Handcrafted with precision in Ampang, Malaysia</span>
                <span>•</span>
                <a href="/admin" className="hover:text-neutral-300 transition flex items-center gap-1">
                  <span>Staff Portal</span>
                  <span className="text-[10px]">🔒</span>
                </a>
              </div>
            </div>
          </div>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
