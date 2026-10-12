import React from 'react'
import Image from 'next/image'

interface Dice3MFLogoProps {
  className?: string
  iconOnly?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: '3d' | 'flat' | 'raster'
  theme?: 'dark' | 'light' | 'auto'
}

/**
 * 3MF Studio Precision Dice Logo Mark (Authentic 3D Render Asset)
 * Directly extracted from the user's 3D render asset:
 * - Top Face: 3 Pips (• • •)
 * - Left Face: M Pips
 * - Right Face: F Pips
 */
export function Dice3MFLogoIcon({
  className = 'h-8 w-8',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center select-none ${className}`}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/dice-cube-transparent.png"
        alt="3MF Studio Calibration Dice"
        className="h-full w-full object-contain drop-shadow-md"
        loading="eager"
      />
    </div>
  )
}

function LegacySvgDiceIcon({
  className = 'h-8 w-8',
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Soft realistic lighting gradients */}
        <linearGradient id="diceTop" x1="16" y1="10" x2="48" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#E8EAED" />
          <stop offset="100%" stopColor="#D2D6DC" />
        </linearGradient>

        <linearGradient id="diceLeft" x1="12" y1="20" x2="32" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E5E9" />
          <stop offset="60%" stopColor="#BFC5CE" />
          <stop offset="100%" stopColor="#9AA2AD" />
        </linearGradient>

        <linearGradient id="diceRight" x1="32" y1="20" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B3B9C2" />
          <stop offset="60%" stopColor="#7B8491" />
          <stop offset="100%" stopColor="#515A66" />
        </linearGradient>

        <linearGradient id="pipGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>

        <filter id="diceShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* BASE CUBE SILHOUETTE (Smooth Beveled Hexagon) */}
      <g filter="url(#diceShadow)">
        {/* TOP FACE */}
        <path
          d="M32 9.5C32.8 9.5 33.6 9.9 34.2 10.3L50.5 20.2C51.6 20.9 52 22.1 51.5 23.2C51 24.1 49.8 24.6 48.8 25.1L33.8 33.5C32.7 34.1 31.3 34.1 30.2 33.5L15.2 25.1C14.2 24.6 13 24.1 12.5 23.2C12 22.1 12.4 20.9 13.5 20.2L29.8 10.3C30.4 9.9 31.2 9.5 32 9.5Z"
          fill="url(#diceTop)"
        />

        {/* LEFT FACE */}
        <path
          d="M12.5 23.2C12.8 23.9 13.5 24.6 14.5 25.2L30.2 33.7C31 34.1 31.6 34.7 31.6 35.6V52.8C31.6 54.2 30.5 55.4 29.2 55.1C28.2 54.8 27.2 54.2 26.5 53.7L13.8 44.8C12.7 44 12 42.7 12 41.3V25.2C12 24.3 12.2 23.6 12.5 23.2Z"
          fill="url(#diceLeft)"
        />

        {/* RIGHT FACE */}
        <path
          d="M51.5 23.2C51.8 23.6 52 24.3 52 25.2V41.3C52 42.7 51.3 44 50.2 44.8L37.5 53.7C36.8 54.2 35.8 54.8 34.8 55.1C33.5 55.4 32.4 54.2 32.4 52.8V35.6C32.4 34.7 33 34.1 33.8 33.7L49.5 25.2C50.5 24.6 51.2 23.9 51.5 23.2Z"
          fill="url(#diceRight)"
        />
      </g>

      {/* ============================================================== */}
      {/* TOP FACE: 3 PIPS (• • •)                                        */}
      {/* Arranged vertically in isometric perspective                   */}
      {/* ============================================================== */}
      <g id="pips-top-3">
        {/* Back Pip */}
        <ellipse cx="32" cy="14.8" rx="2.5" ry="1.5" fill="url(#pipGrad)" />
        {/* Middle Pip */}
        <ellipse cx="32" cy="21.5" rx="2.6" ry="1.6" fill="url(#pipGrad)" />
        {/* Front Pip */}
        <ellipse cx="32" cy="28.2" rx="2.7" ry="1.7" fill="url(#pipGrad)" />
      </g>

      {/* ============================================================== */}
      {/* LEFT FACE: 5 PIPS FORMING 'M'                                  */}
      {/* (Left column pair, center dip, right column pair)              */}
      {/* ============================================================== */}
      <g id="pips-left-m">
        {/* Top-Left */}
        <ellipse cx="17" cy="28.5" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Bottom-Left */}
        <ellipse cx="17" cy="40.5" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Center Dip */}
        <ellipse cx="22" cy="37" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Top-Right */}
        <ellipse cx="27" cy="33.8" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Bottom-Right */}
        <ellipse cx="27" cy="45.8" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
      </g>

      {/* ============================================================== */}
      {/* RIGHT FACE: 5 PIPS FORMING 'F'                                 */}
      {/* (Left column 3 pips, top arm pip, middle arm pip)              */}
      {/* ============================================================== */}
      <g id="pips-right-f">
        {/* Top-Left */}
        <ellipse cx="37" cy="33.8" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Mid-Left */}
        <ellipse cx="37" cy="40" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Bot-Left */}
        <ellipse cx="37" cy="46.2" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Top Arm Extension */}
        <ellipse cx="44" cy="30" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
        {/* Mid Arm Extension */}
        <ellipse cx="43.5" cy="36.5" rx="2.2" ry="2.6" fill="url(#pipGrad)" />
      </g>
    </svg>
  )
}

/**
 * 3MF Studio Flat Vector Monochrome Dice Mark
 * As specified in the Brand Guidelines sheet: "WEBSITE FOOTER (MONOCHROME)" & "FLAT"
 * Solid white beveled cube with black divider seams and black pips (3-top, M-left, F-right)
 */
export function Dice3MFFlatIcon({
  className = 'h-8 w-8',
  invert = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { invert?: boolean }) {
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center select-none ${className}`}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/footer-flat-icon.png"
        alt="3MF Studio Monochrome Flat Logo"
        className={`h-full w-full object-contain ${invert ? 'filter invert' : ''}`}
        loading="eager"
      />
    </div>
  )
}

export default function Dice3MFLogo({
  className = '',
  iconOnly = false,
  size = 'md',
  variant = '3d',
  theme = 'auto',
}: Dice3MFLogoProps) {
  const iconSizeClass =
    size === 'xs'
      ? 'h-5 w-5'
      : size === 'sm'
      ? 'h-7 w-7'
      : size === 'lg'
      ? 'h-10 w-10'
      : size === 'xl'
      ? 'h-14 w-14'
      : 'h-8 w-8'

  const textClass =
    size === 'xs'
      ? 'text-xs'
      : size === 'sm'
      ? 'text-sm'
      : size === 'lg'
      ? 'text-lg'
      : size === 'xl'
      ? 'text-2xl'
      : 'text-base'

  const textColor =
    theme === 'dark'
      ? 'text-white'
      : theme === 'light'
      ? 'text-slate-900'
      : 'text-slate-900 dark:text-white'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Icon */}
      <div className="relative flex shrink-0 items-center justify-center transition-transform duration-200 hover:scale-105">
        {variant === 'flat' ? (
          <Dice3MFFlatIcon className={iconSizeClass} invert={theme === 'dark'} />
        ) : variant === 'raster' ? (
          <div className={`relative overflow-hidden rounded-xl bg-slate-950 p-1 ${iconSizeClass}`}>
            <Image
              src="/brand/dice-logo.jpg"
              alt="3MF Studio Logo"
              width={56}
              height={56}
              className="object-contain"
            />
          </div>
        ) : (
          <Dice3MFLogoIcon className={iconSizeClass} />
        )}
      </div>

      {/* Brand Wordmark matching user's exact "3MF STUDIO" font style */}
      {!iconOnly && (
        <div className="flex flex-col leading-none">
          <span
            className={`${textClass} ${textColor} font-semibold uppercase tracking-[0.22em] antialiased select-none`}
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            3MF STUDIO
          </span>
          <span className="text-[8.5px] font-medium uppercase tracking-[0.3em] text-slate-400 mt-0.5">
            Creative Design & Innovation
          </span>
        </div>
      )}
    </div>
  )
}
