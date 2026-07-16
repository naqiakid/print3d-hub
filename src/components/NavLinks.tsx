'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/printers',        label: 'Browse Printers' },
  { href: '/browse/products', label: 'Browse Products' },
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
