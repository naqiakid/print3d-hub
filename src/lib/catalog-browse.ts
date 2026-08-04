import { createClient } from '@/lib/supabase/server'
import { parseDesignerMetadata } from '@/lib/types'
import type { CatalogItem, Shop } from '@/lib/types'
import type { CatalogItemWithShop } from '@/components/CatalogBrowse'

type BrowseFilter = 'all' | 'custom' | 'ready'

function applyFilter(items: CatalogItem[], filter: BrowseFilter): CatalogItem[] {
  if (filter === 'custom') {
    return items.filter(
      (i) => i.allow_custom_text || i.allow_color_choice || i.allow_resize || i.allow_material_choice,
    )
  }
  if (filter === 'ready') {
    return items.filter(
      (i) => !i.allow_custom_text && !i.allow_color_choice && !i.allow_resize && !i.allow_material_choice,
    )
  }
  return items
}

/**
 * Fetches all active catalog items, optionally filtered by customisation type,
 * joins each item with its shop's location and availability, and sorts
 * available shops to the top.
 */
export async function fetchCatalogBrowseItems(
  filter: BrowseFilter = 'all',
): Promise<CatalogItemWithShop[]> {
  const supabase = await createClient()

  const { data: itemRows } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const allItems = ((itemRows ?? []) as unknown as CatalogItem[]).filter((item) => {
    const designer = parseDesignerMetadata(item.description)
    const isUnverified = (designer?.license ?? '').includes('License Unverified') || (designer?.license ?? '').includes('Check Manually')
    const commercialAllowed = designer?.commercialAllowed ?? true
    
    let permissionStatus = item.permission_status || designer?.permissionStatus
    if (!permissionStatus) {
      if (!commercialAllowed || isUnverified) {
        permissionStatus = 'pending_permission'
      } else {
        permissionStatus = 'not_required'
      }
    }
    return permissionStatus === 'approved' || permissionStatus === 'not_required'
  })

  const filtered = applyFilter(allItems, filter)

  const ownerIds = [...new Set(filtered.map((i) => i.owner_id))]

  const { data: shopRows } = ownerIds.length
    ? await supabase
        .from('profiles')
        .select('id, name, lat, lng, available')
        .in('id', ownerIds)
    : { data: [] }

  const shopMap = new Map<string, Pick<Shop, 'name' | 'lat' | 'lng' | 'available'>>(
    (shopRows ?? []).map((s: Pick<Shop, 'id' | 'name' | 'lat' | 'lng' | 'available'>) => [s.id, s]),
  )

  return filtered
    .map((item) => {
      const shop = shopMap.get(item.owner_id)
      return {
        ...item,
        shop_name:      shop?.name      ?? 'Unknown maker',
        shop_lat:       shop?.lat       ?? null,
        shop_lng:       shop?.lng       ?? null,
        shop_available: shop?.available ?? false,
      }
    })
    .sort((a, b) => Number(b.shop_available) - Number(a.shop_available))
}
