'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Dice3MFLogo, { Dice3MFLogoIcon, Dice3MFFlatIcon } from '@/components/layout/Dice3MFLogo'
import { CheckCircle2, ExternalLink, Image as ImageIcon, Sparkles, Layers, Eye } from 'lucide-react'

interface AssetMeta {
  id: string
  name: string
  path: string
  dimensions: string
  format: string
  size: string
  usage: string
  description: string
  hasTransparency: boolean
  isWide?: boolean
}

const BRAND_ASSETS: AssetMeta[] = [
  {
    id: 'hero-banner-wide',
    name: '16:9 Hero Banner (1920 Full-HD)',
    path: '/brand/hero-banner-wide.jpg',
    dimensions: '1920 × 1071 px',
    format: 'JPEG (Lanczos3 Upscale)',
    size: '139.9 KB',
    usage: 'Homepage Hero Showcase (Full Bleed Edge-to-Edge)',
    description: 'High-DPI upscale of the dedicated 16:9 3MF Studio hero banner featuring illuminated calibration die and creative typography.',
    hasTransparency: false,
    isWide: true,
  },
  {
    id: 'hero-banner',
    name: '16:9 Hero Banner (Native High-Res)',
    path: '/brand/hero-banner.jpg',
    dimensions: '1024 × 571 px',
    format: 'JPEG (mozjpeg 95%)',
    size: '58.8 KB',
    usage: 'Mobile / Tablet Responsive Banner Fallback',
    description: 'Direct high-fidelity output from the user-supplied 16:9 hero banner asset.',
    hasTransparency: false,
    isWide: true,
  },
  {
    id: 'dice-cube-transparent',
    name: 'Authentic 3D Calibration Die (Transparent Mark)',
    path: '/brand/dice-cube-transparent.png',
    dimensions: '512 × 512 px',
    format: 'PNG (Alpha Channel)',
    size: '99.6 KB',
    usage: 'Desktop Navbar, Mobile Menu, Favicon & Brand Headers',
    description: 'High-resolution studio calibration die with clean alpha transparency: 3 pips top, M-formation pips left, F-formation pips right, with balanced optical centering.',
    hasTransparency: true,
  },
  {
    id: 'footer-flat-icon',
    name: 'Monochrome Flat Die Icon',
    path: '/brand/footer-flat-icon.png',
    dimensions: '50 × 58 px',
    format: 'PNG (Alpha Channel)',
    size: '4.9 KB',
    usage: 'Website Footer Branding & Minimalist Marks',
    description: 'Extracted directly from the Website Footer flat section: Solid white chamfered die with crisp black pips and facet borders.',
    hasTransparency: true,
  },
  {
    id: 'footer-flat-lockup',
    name: 'Monochrome Flat Lockup (Die + Typography)',
    path: '/brand/footer-flat-lockup.png',
    dimensions: '220 × 58 px',
    format: 'PNG (Alpha Channel)',
    size: '12.7 KB',
    usage: 'Footer Brand Lockup & Monochrome Collateral',
    description: 'Complete horizontal lockup pairing the monochrome flat die with the wide-kerning 3MF STUDIO wordmark.',
    hasTransparency: true,
  },
  {
    id: 'header-horizontal-lockup',
    name: 'Header Horizontal Lockup',
    path: '/brand/header-horizontal-lockup.png',
    dimensions: '457 × 120 px',
    format: 'PNG (Alpha Channel)',
    size: '43.0 KB',
    usage: 'Header Alternate & Marketing Presentation',
    description: 'Carefully extracted horizontal lockup pairing the 3D dice mark with 3MF STUDIO typography and orange dot accent. Balanced 14px padding with zero clipping.',
    hasTransparency: true,
  },
  {
    id: 'dice-cube-square',
    name: 'Square Calibration Die Tile',
    path: '/brand/dice-cube-square.png',
    dimensions: '512 × 512 px',
    format: 'PNG (Alpha Channel)',
    size: '99.6 KB',
    usage: 'Apple Touch Icon & Web App Manifest Icons',
    description: 'High-res studio calibration die centered with 12% breathing room and clean 0-alpha background. Powers favicon.ico, icon-192.png, and icon-512.png.',
    hasTransparency: true,
  },
  {
    id: 'brand-guidelines',
    name: 'Master Brand Guidelines Sheet',
    path: '/brand/brand-guidelines.jpg',
    dimensions: '1024 × 764 px',
    format: 'JPEG',
    size: '128.2 KB',
    usage: 'Source of Truth & Reference Specification',
    description: 'Full resolution master sheet uploaded by user detailing colors, typography, dice pip alignment, and lockups.',
    hasTransparency: false,
    isWide: true,
  },
]

export default function BrandPreviewPage() {
  const [bgPreview, setBgPreview] = useState<'checker' | 'dark' | 'light'>('checker')

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8 md:p-12 space-y-12">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="border-b border-neutral-800 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Asset QA & Verification Portal</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase">
              3MF STUDIO Media Assets
            </h1>
            <p className="text-neutral-400 text-sm md:text-base mt-2 max-w-2xl">
              Inspect all crops, transparency channels, dimensions, and live component integrations extracted directly from your brand guidelines sheet.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs font-medium text-neutral-300 hover:text-white transition"
            >
              <Eye className="w-4 h-4 text-orange-400" />
              <span>View Live Website</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-neutral-950 font-semibold text-xs transition"
            >
              <span>Admin Login</span>
            </Link>
          </div>
        </div>

        {/* Section 1: Interactive Background Preview Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <Layers className="w-4 h-4 text-orange-400" />
            <span className="font-medium">Inspect Alpha Transparency Against:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBgPreview('checker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                bgPreview === 'checker'
                  ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              🏁 Checkerboard (Alpha)
            </button>
            <button
              onClick={() => setBgPreview('dark')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                bgPreview === 'dark'
                  ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              ⬛ Dark Slate (#0a0a0a)
            </button>
            <button
              onClick={() => setBgPreview('light')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                bgPreview === 'light'
                  ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              ⬜ Clean Light (#f8fafc)
            </button>
          </div>
        </div>

        {/* Section 2: Master Asset Catalog Cards */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-400" />
              <span>Extracted Media Asset Catalog</span>
            </h2>
            <span className="text-xs font-mono text-neutral-500">{BRAND_ASSETS.length} Verified Assets</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BRAND_ASSETS.map((asset) => {
              const bgClass =
                bgPreview === 'checker'
                  ? 'bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:12px_12px] bg-neutral-950'
                  : bgPreview === 'dark'
                  ? 'bg-neutral-950'
                  : 'bg-slate-100'

              return (
                <div
                  key={asset.id}
                  className={`bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl transition hover:border-neutral-700 ${
                    asset.isWide ? 'md:col-span-2 lg:col-span-3' : ''
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-base leading-snug">{asset.name}</h3>
                        <p className="text-xs font-mono text-orange-400/90 mt-0.5">{asset.path}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {asset.format}
                      </span>
                    </div>
                  </div>

                  {/* Card Visual Preview */}
                  <div className="px-5 py-2">
                    <div
                      className={`relative w-full rounded-xl border border-neutral-800/80 overflow-hidden flex items-center justify-center ${bgClass} ${
                        asset.isWide ? 'aspect-[1920/565] max-h-[340px]' : 'aspect-square max-h-[260px]'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.path}
                        alt={asset.name}
                        className={`object-contain ${
                          asset.isWide ? 'w-full h-full' : 'max-h-[85%] max-w-[85%] drop-shadow-md'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Card Metadata & Usage */}
                  <div className="p-5 pt-3 space-y-3">
                    <p className="text-xs text-neutral-400 leading-relaxed">{asset.description}</p>
                    
                    <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400">
                      <div>
                        <span className="text-neutral-500">Dim: </span>
                        <strong className="text-neutral-200">{asset.dimensions}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Size: </span>
                        <strong className="text-neutral-200">{asset.size}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Alpha: </span>
                        <strong className={asset.hasTransparency ? 'text-emerald-400' : 'text-neutral-400'}>
                          {asset.hasTransparency ? 'Yes (Clean)' : 'Solid'}
                        </strong>
                      </div>
                    </div>

                    <div className="bg-neutral-950/70 rounded-xl p-2.5 border border-neutral-800/70 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{asset.usage}</span>
                      </div>
                      <a
                        href={asset.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-orange-400 hover:text-orange-300 flex items-center gap-1 ml-2 shrink-0 transition"
                      >
                        <span>Raw</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3: Live Component Verification Showcase */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-8">
          <div className="border-b border-neutral-800 pb-4">
            <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase">Interactive Integration Test</span>
            <h2 className="text-2xl font-bold text-white mt-1">Live Website Components in Action</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Verifying authentic 3D dice mark &amp; monochrome flat mark rendering across different UI contexts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Header Navbar Component (Dark) */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  Navbar Implementation (Dark Theme)
                </span>
                <p className="text-xs text-neutral-400 mt-1">
                  Active in website top navigation with authentic 3D dice cutout.
                </p>
              </div>
              <div className="py-8 flex flex-col items-center justify-center gap-4 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
                <Dice3MFLogo size="lg" theme="dark" />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>Components: &lt;Dice3MFLogo /&gt;</span>
                <span className="text-emerald-400 font-medium">3D Isolated Asset</span>
              </div>
            </div>

            {/* Header Navbar Component (Light) */}
            <div className="bg-white rounded-2xl p-6 flex flex-col justify-between space-y-6 text-neutral-950">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  Navbar Implementation (Light Theme)
                </span>
                <p className="text-xs text-neutral-600 mt-1">
                  High-contrast test ensuring zero dark fringe on light backgrounds.
                </p>
              </div>
              <div className="py-8 flex flex-col items-center justify-center gap-4 bg-slate-50 rounded-xl border border-slate-200">
                <Dice3MFLogo size="lg" theme="light" />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-600 font-mono">
                <span>Theme: Light</span>
                <span className="text-emerald-600 font-medium">Zero Fringe Halo</span>
              </div>
            </div>

            {/* Footer Monochrome Flat Die */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  Footer Component (Monochrome Flat)
                </span>
                <p className="text-xs text-neutral-400 mt-1">
                  Solid white die with black seams and drilled pips from guidelines.
                </p>
              </div>
              <div className="py-8 flex flex-col items-center justify-center gap-4 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
                <Dice3MFLogo size="lg" variant="flat" theme="dark" />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>Component: &lt;Dice3MFFlatIcon /&gt;</span>
                <span className="text-emerald-400 font-medium">footer-flat-icon.png</span>
              </div>
            </div>

            {/* App Icon / Tab Favicon Scaling */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  Favicon &amp; App Icon Multi-Scale Test
                </span>
                <p className="text-xs text-neutral-400 mt-1">
                  Legibility verification from 16px tab icon to 180px iOS homescreen bookmark.
                </p>
              </div>
              <div className="py-6 flex items-center justify-around flex-wrap gap-4 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-5 h-5 bg-neutral-900 rounded p-0.5 border border-neutral-800 flex items-center justify-center">
                    <Dice3MFLogoIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">16px</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-9 h-9 bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex items-center justify-center">
                    <Dice3MFLogoIcon className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">32px</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 bg-neutral-900 rounded-xl p-2 border border-neutral-800 flex items-center justify-center">
                    <Dice3MFLogoIcon className="w-10 h-10" />
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">48px</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 bg-neutral-900 rounded-2xl p-3 border border-neutral-800 flex items-center justify-center shadow-xl">
                    <Dice3MFLogoIcon className="w-16 h-16" />
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">180px</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>Targets: favicon.ico + icon.tsx</span>
                <span className="text-emerald-400 font-medium">Pips Legible at 16px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Full Bleed Hero Banner Demonstration */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="border-b border-neutral-800 pb-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase">Edge-to-Edge Panoramic Test</span>
              <h2 className="text-2xl font-bold text-white mt-1">Hero Banner Bleed &amp; Crop Verification</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Zero side gutters across desktop, tablet, and mobile with bottom shadow transition into content.
              </p>
            </div>
            <a
              href="/brand/hero-banner-wide.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition"
            >
              <span>Inspect 1920×1071 Banner</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="relative w-full aspect-[1920/1071] rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/hero-banner-wide.jpg"
              alt="Panoramic Hero Banner Showcase"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/30 pointer-events-none" />
            <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between pointer-events-none">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-orange-400 bg-neutral-950/80 px-2.5 py-1 rounded border border-neutral-800">
                  Full Bleed 16:9 Showcase
                </span>
                <h3 className="text-lg md:text-2xl font-bold text-white mt-2 drop-shadow-md">
                  Welcome to 3MF Studio
                </h3>
              </div>
              <span className="text-xs font-mono text-neutral-400 bg-neutral-950/80 px-2 py-1 rounded hidden sm:inline-block">
                1920 × 1071 px (Lanczos3 Upscale)
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Master Guidelines Reference Overlay */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="border-b border-neutral-800 pb-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase">Original Source of Truth</span>
              <h2 className="text-2xl font-bold text-white mt-1">Uploaded Brand Guidelines Sheet</h2>
              <p className="text-xs text-neutral-400 mt-1">
                The reference image provided with all crops mapped to this source sheet.
              </p>
            </div>
            <a
              href="/brand/brand-guidelines.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition"
            >
              <span>View Source JPEG</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="relative w-full aspect-[4/3] md:aspect-[16/10] rounded-2xl overflow-hidden bg-black border border-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/brand-guidelines.jpg"
              alt="Uploaded Brand Guidelines Sheet"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

      </div>
    </div>
  )
}
