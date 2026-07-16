import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { fetchCatalogBrowseItems } from '@/lib/catalog-browse'
import CatalogBrowse from '@/components/CatalogBrowse'

export const metadata: Metadata = {
  title: 'Browse Products | Print3D Hub',
  description: 'Browse all 3D printed products available from local makers near you.',
}

export default async function BrowseProductsPage() {
  const items = await fetchCatalogBrowseItems('all')

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Home
      </Link>
      <CatalogBrowse items={items} mode="all" />
    </div>
  )
}
