'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/#quote',           label: 'Instant 3D Quote' },
  { href: '/browse/products',  label: 'Shop Catalog' },
  { href: '/#materials',       label: 'Materials & Specs' },
  { href: '/track',            label: 'Track Order' },
]

export default function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="hidden items-center gap-7 sm:flex">
      {links.map(({ href, label }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`text-xs uppercase tracking-[0.15em] font-medium transition-all duration-200 ${
              isActive
                ? 'text-white font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
