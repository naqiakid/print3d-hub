import React from 'react'
import Dice3MFLogo, { Dice3MFLogoIcon, Dice3MFFlatIcon } from './Dice3MFLogo'

interface StudioLogoProps {
  className?: string
  iconOnly?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: '3d' | 'flat' | 'raster'
}

/**
 * 3MF Studio Precision Dice Logo Mark
 * Directly implements the user's brand identity:
 * - Top Face: 3 Pips (• • •)
 * - Left Face: 5 Pips forming 'M'
 * - Right Face: 5 Pips forming 'F'
 */
export function StudioLogoIcon({ className = 'h-8 w-8', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Dice3MFLogoIcon className={className} {...props} />
}

export { Dice3MFFlatIcon }

export default function StudioLogo({
  className = '',
  iconOnly = false,
  size = 'md',
  variant = '3d',
}: StudioLogoProps) {
  return (
    <Dice3MFLogo
      className={className}
      iconOnly={iconOnly}
      size={size}
      variant={variant}
    />
  )
}


