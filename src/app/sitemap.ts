import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://print3d-hub.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const { data: printerRows } = await supabase.from('printers').select('owner_id')
  const ownerIds = [...new Set((printerRows ?? []).map((p) => p.owner_id))]

  const { data: shops } = ownerIds.length
    ? await supabase.from('profiles').select('id, created_at').eq('available', true).in('id', ownerIds)
    : { data: [] }

  const printerEntries: MetadataRoute.Sitemap = (shops ?? []).map((p) => ({
    url: `${APP_URL}/printers/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const staticEntries: MetadataRoute.Sitemap = [
    { url: APP_URL, changeFrequency: 'daily', priority: 1.0 },
    { url: `${APP_URL}/request`, changeFrequency: 'daily', priority: 0.95 },
    { url: `${APP_URL}/browse/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${APP_URL}/browse/ready`, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${APP_URL}/browse/custom`, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${APP_URL}/printers`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${APP_URL}/terms`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${APP_URL}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${APP_URL}/refund-policy`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  return [...staticEntries, ...printerEntries]
}
