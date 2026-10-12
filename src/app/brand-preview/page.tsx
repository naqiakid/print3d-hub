import React from 'react'
import Image from 'next/image'
import Dice3MFLogo, { Dice3MFLogoIcon, Dice3MFFlatIcon } from '@/components/layout/Dice3MFLogo'

export default function BrandPreviewPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10 space-y-12">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="border-b border-neutral-800 pb-6">
          <span className="text-xs font-semibold tracking-widest text-orange-400 uppercase">
            Official Brand Implementation
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider text-white uppercase mt-1">
            3MF STUDIO — Brand System
          </h1>
          <p className="text-neutral-400 text-sm mt-2 max-w-2xl">
            Precision 3D calibration dice mark featuring <strong>3 pips on top</strong>, <strong>M-formation pips on bottom-left</strong>, and <strong>F-formation pips on bottom-right</strong>.
          </p>
        </div>

        {/* Section 1: User Uploaded Asset vs Vector Implementation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* User's Original Render */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-4">
                <h2 className="text-base font-bold text-white tracking-wide uppercase">Your Original 3D Asset</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded">
                  Source Image
                </span>
              </div>
              <p className="text-xs text-neutral-400 mb-4">
                Rendered with photorealistic subsurface scattering and beveled blind pips.
              </p>
            </div>
            
            <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-black/60 border border-neutral-800/80 flex items-center justify-center">
              <Image
                src="/brand/dice-logo.jpg"
                alt="3MF Studio Original Dice"
                fill
                className="object-contain p-4"
              />
            </div>
            <div className="text-center pt-3">
              <span className="text-[11px] text-neutral-500 font-mono">public/brand/dice-logo.jpg</span>
            </div>
          </div>

          {/* Isolated 3D Asset Mark */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-4">
                <h2 className="text-base font-bold text-white tracking-wide uppercase">Authentic 3D Dice Asset Mark</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Active Brand Asset
                </span>
              </div>
              <p className="text-xs text-neutral-400 mb-4">
                Pixel-for-pixel cutout from your render with transparent background for navbars &amp; headers.
              </p>
            </div>

            <div className="aspect-[16/9] w-full rounded-xl bg-black/60 border border-neutral-800/80 flex flex-col items-center justify-center gap-4">
              <Dice3MFLogoIcon className="w-24 h-24 drop-shadow-2xl" />
              <span className="text-sm font-semibold tracking-[0.25em] text-white uppercase">
                3MF STUDIO
              </span>
            </div>
            <div className="text-center pt-3">
              <span className="text-[11px] text-neutral-500 font-mono">public/brand/dice-cube-transparent.png</span>
            </div>
          </div>
        </div>

        {/* Section 2: Header Lockups across Light & Dark */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide uppercase">Website Header Lockups</h2>
              <p className="text-xs text-neutral-400">
                As specified in your brand sheet: Horizontal Navbar &amp; Compact styles
              </p>
            </div>
            <span className="text-xs text-neutral-400 font-mono">Navbar Theme</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dark Mode Navbar */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-8 flex flex-col items-center justify-center gap-6">
              <span className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Dark Header</span>
              <Dice3MFLogo size="lg" theme="dark" />
              <div className="w-full h-px bg-neutral-900 my-1" />
              <div className="flex items-center gap-6">
                <Dice3MFLogo size="sm" theme="dark" />
                <Dice3MFLogo size="md" theme="dark" />
              </div>
            </div>

            {/* Light Mode Navbar */}
            <div className="bg-white rounded-xl p-8 flex flex-col items-center justify-center gap-6">
              <span className="text-xs text-neutral-400 font-mono uppercase tracking-wider">Light Header</span>
              <Dice3MFLogo size="lg" theme="light" />
              <div className="w-full h-px bg-neutral-100 my-1" />
              <div className="flex items-center gap-6">
                <Dice3MFLogo size="sm" theme="light" />
                <Dice3MFLogo size="md" theme="light" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Authentic Website Footer Monochrome Flat Asset */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide uppercase">Website Footer (Monochrome Flat)</h2>
              <p className="text-xs text-neutral-400">
                Extracted directly from your brand guidelines sheet: solid white dice with black pips &amp; seams.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
              Extracted from Asset
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Component */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-8 flex flex-col items-center justify-center gap-4">
              <span className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Footer Component (Dark)</span>
              <Dice3MFLogo size="lg" variant="flat" theme="dark" />
            </div>

            {/* Direct Crop from Guidelines */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-8 flex flex-col items-center justify-center gap-4">
              <span className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Direct Asset Crop</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/footer-flat-lockup.png"
                alt="Original Footer Monochrome Lockup"
                className="h-9 object-contain"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Favicon & App Icon Scale Test */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-neutral-800 pb-4">
            <h2 className="text-base font-bold text-white tracking-wide uppercase">Favicon &amp; App Icon Scale Test</h2>
            <p className="text-xs text-neutral-400">
              Testing legibility of the dice pips across small tab sizes and high-res mobile icons.
            </p>
          </div>

          <div className="bg-neutral-950 rounded-xl p-6 border border-neutral-800 flex items-center justify-around flex-wrap gap-6">
            {/* 16px Favicon */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 bg-neutral-900 rounded p-0.5 border border-neutral-800 flex items-center justify-center">
                <Dice3MFLogoIcon className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">16px (Tab)</span>
            </div>

            {/* 32px Standard Icon */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex items-center justify-center">
                <Dice3MFLogoIcon className="w-7 h-7" />
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">32px (Menu)</span>
            </div>

            {/* 48px Touch Icon */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-neutral-900 rounded-xl p-2 border border-neutral-800 flex items-center justify-center">
                <Dice3MFLogoIcon className="w-10 h-10" />
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">48px (Touch)</span>
            </div>

            {/* 80px App Tile */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 bg-neutral-900 rounded-2xl p-3 border border-neutral-800 flex items-center justify-center">
                <Dice3MFLogoIcon className="w-18 h-18" />
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">80px (App Tile)</span>
            </div>

            {/* 180px Apple Icon */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-36 h-36 bg-neutral-900 rounded-3xl p-4 border border-neutral-800 flex items-center justify-center shadow-2xl">
                <Dice3MFLogoIcon className="w-28 h-28" />
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">180px (Apple Touch)</span>
            </div>
          </div>
        </div>

        {/* Section 5: Brand Guidelines Sheet Reference */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide uppercase">Brand Sheet Reference</h2>
              <p className="text-xs text-neutral-400">
                Full brand identity package provided by the creator.
              </p>
            </div>
            <a
              href="/brand/brand-guidelines.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 hover:text-orange-300 transition underline underline-offset-4"
            >
              Open Full Resolution
            </a>
          </div>

          <div className="relative aspect-[4/3] md:aspect-[16/9] w-full rounded-xl overflow-hidden bg-black/80 border border-neutral-800">
            <Image
              src="/brand/brand-guidelines.jpg"
              alt="Brand Guidelines"
              fill
              className="object-contain"
            />
          </div>
        </div>

      </div>
    </div>
  )
}
