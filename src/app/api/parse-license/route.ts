import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    // Add User-Agent to prevent getting blocked by anti-bot headers
    const res = await fetch(urlParam, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 3600 } // cache for 1 hour
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Could not load page: ${res.statusText}` }, { status: res.status })
    }

    const html = await res.text()

    // 1. Parse Title
    let title = ''
    const titleMatch = html.match(/<title>(.*?)<\/title>/i)
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1]
        .replace(/ - Thingiverse$/i, '')
        .replace(/ \| Printables\.com$/i, '')
        .replace(/ \| MakerWorld$/i, '')
        .trim()
    }

    // 2. Parse Designer/Author
    let designer = ''
    if (urlParam.includes('printables.com')) {
      const creatorMatch = html.match(/"creator":\s*\{\s*"name":\s*"([^"]+)"/i) || html.match(/class="[^"]*user-name[^"]*"[^>]*>\s*([^<]+)/i)
      if (creatorMatch && creatorMatch[1]) {
        designer = creatorMatch[1].trim()
      }
    } else if (urlParam.includes('thingiverse.com')) {
      const thingiverseMatch = html.match(/"creator":\s*\{\s*"name":\s*"([^"]+)"/i) || html.match(/by\s+<a\s+href="\/([^"]+)"\s+class="Designer/i)
      if (thingiverseMatch && thingiverseMatch[1]) {
        designer = thingiverseMatch[1].trim()
      }
    } else if (urlParam.includes('makerworld.com')) {
      const makerworldMatch = html.match(/"authorName":\s*"([^"]+)"/i) || html.match(/"username":\s*"([^"]+)"/i)
      if (makerworldMatch && makerworldMatch[1]) {
        designer = makerworldMatch[1].trim()
      }
    }

    // Fallback designer search
    if (!designer) {
      const genericAuthor = html.match(/<meta\s+name="author"\s+content="([^"]+)"/i) || html.match(/class="[^"]*author[^"]*"[^>]*>\s*([^<]+)/i)
      if (genericAuthor && genericAuthor[1]) {
        designer = genericAuthor[1].trim()
      }
    }

    // 3. Parse License Type
    let license = 'CC BY 4.0 (Default)'
    let commercialAllowed = true

    const lowerHtml = html.toLowerCase()

    // Match Creative Commons variations
    if (lowerHtml.includes('non-commercial') || lowerHtml.includes('nc') || lowerHtml.includes('creative commons - attribution - non-commercial') || lowerHtml.includes('by-nc')) {
      commercialAllowed = false
      if (lowerHtml.includes('by-nc-sa')) {
        license = 'CC BY-NC-SA (Attribution-NonCommercial-ShareAlike)'
      } else if (lowerHtml.includes('by-nc-nd')) {
        license = 'CC BY-NC-ND (Attribution-NonCommercial-NoDerivatives)'
      } else {
        license = 'CC BY-NC (Attribution-NonCommercial)'
      }
    } else if (lowerHtml.includes('by-nd') || lowerHtml.includes('no derivatives') || lowerHtml.includes('noderivatives')) {
      license = 'CC BY-ND (Attribution-NoDerivatives)'
      commercialAllowed = true // ND allows commercial if unchanged
    } else if (lowerHtml.includes('by-sa') || lowerHtml.includes('share-alike') || lowerHtml.includes('sharealike')) {
      license = 'CC BY-SA (Attribution-ShareAlike)'
      commercialAllowed = true
    } else if (lowerHtml.includes('public domain') || lowerHtml.includes('cc0') || lowerHtml.includes('creative commons - public domain')) {
      license = 'CC0 (Public Domain / Free Use)'
      commercialAllowed = true
    } else if (lowerHtml.includes('creative commons - attribution') || lowerHtml.includes('by-')) {
      license = 'CC BY (Attribution)'
      commercialAllowed = true
    }

    return NextResponse.json({
      title,
      designer,
      license,
      commercialAllowed
    })
  } catch (err: any) {
    console.error('Error scanning license URL:', err)
    return NextResponse.json({ error: 'Failed to scan license URL. Anti-scraping protection may be active.' }, { status: 500 })
  }
}
