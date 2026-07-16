import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { fetchCatalogBrowseItems } from '@/lib/catalog-browse'
import CatalogBrowse from '@/components/CatalogBrowse'

export const metadata: Metadata = {
  title: 'Ready-Made Products | Print3D Hub',
  description: 'Browse finished 3D printed products available to order now — no customisation needed.',
}

export default async function BrowseReadyPage() {
  const items = await fetchCatalogBrowseItems('ready')

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Home
      </Link>
      <CatalogBrowse items={items} mode="ready" />
    </div>
  )
}
