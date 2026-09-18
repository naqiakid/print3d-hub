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
    <nav className="hidden items-center gap-6 sm:flex">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`text-sm font-medium transition-colors hover:text-orange-500 ${
            pathname.startsWith(href) ? 'text-orange-500' : 'text-slate-600'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
