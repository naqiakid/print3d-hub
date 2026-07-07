import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://print3d-hub.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const { data: printers } = await supabase
    .from('printers')
    .select('id, created_at')
    .eq('available', true)

  const printerEntries: MetadataRoute.Sitemap = (printers ?? []).map((p) => ({
    url: `${APP_URL}/printers/${p.id}`,
    lastModified: new Date(p.created_at),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    { url: APP_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${APP_URL}/printers`, changeFrequency: 'daily', priority: 0.9 },
    ...printerEntries,
  ]
}
