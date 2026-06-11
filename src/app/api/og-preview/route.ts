import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Always return slug-based fallback alongside any fetch result
  const slugTitle = titleFromSlug(parsed)

  try {
    const res = await fetch(parsed.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(8000),
    })

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return NextResponse.json({ title: slugTitle, description: null, image: null, siteName: siteNameFromHost(parsed) })
    }

    // Only read up to 100KB — OG tags are always in <head>
    const reader = res.body?.getReader()
    if (!reader) return NextResponse.json({ title: slugTitle, description: null, image: null, siteName: siteNameFromHost(parsed) })

    let html = ''
    let bytesRead = 0
    const limit = 100_000
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      html += new TextDecoder().decode(value)
      bytesRead += value.length
      if (bytesRead >= limit) break
    }
    reader.cancel()

    // If we got a bot challenge page, fall back to slug
    if (isBotChallenge(html)) {
      return NextResponse.json({
        title: slugTitle,
        description: null,
        image: null,
        siteName: siteNameFromHost(parsed),
        fromSlug: true,
      })
    }

    const title       = extractOg(html, 'title')      ?? extractTitle(html) ?? slugTitle
    const description = extractOg(html, 'description') ?? extractMetaName(html, 'description')
    const image       = resolveImage(extractOg(html, 'image'), parsed.href)
    const siteName    = extractOg(html, 'site_name')  ?? siteNameFromHost(parsed)

    return NextResponse.json({ title, description, image, siteName })
  } catch {
    // Network error — still return slug-based result
    return NextResponse.json({
      title: slugTitle,
      description: null,
      image: null,
      siteName: siteNameFromHost(parsed),
      fromSlug: true,
    })
  }
}

// ── Bot challenge detection ───────────────────────────────────

function isBotChallenge(html: string): boolean {
  const lower = html.slice(0, 4000).toLowerCase()
  return (
    lower.includes('just a moment') ||
    lower.includes('checking your browser') ||
    lower.includes('cf-browser-verification') ||
    lower.includes('enable javascript and cookies') ||
    lower.includes('_cf_chl') ||
    lower.includes('ray id')
  )
}

// ── Slug → title ─────────────────────────────────────────────

function titleFromSlug(url: URL): string | null {
  const path = url.pathname
    .replace(/\?.*$/, '')   // strip query
    .replace(/#.*$/, '')    // strip fragment

  // Known patterns:
  // MakerWorld:  /en/models/2418368-monitor-phone-holder
  // Printables:  /en/print/123456-model-name
  // Cults3D:     /en/3d-model/model-name-here
  // Thingiverse: /thing:123456  (no slug — nothing useful)
  const m = path.match(/\/(\d+[_-])?([a-z0-9]+(?:[_-][a-z0-9]+)+)\/?$/i)
  if (!m) return null
  return m[2]
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

// ── Site name from hostname ───────────────────────────────────

const KNOWN_SITES: Record<string, string> = {
  'makerworld.com':      'MakerWorld',
  'printables.com':      'Printables',
  'thingiverse.com':     'Thingiverse',
  'cults3d.com':         'Cults3D',
  'myminifactory.com':   'MyMiniFactory',
  'thangs.com':          'Thangs',
  'grabcad.com':         'GrabCAD',
  'yeggi.com':           'Yeggi',
}

function siteNameFromHost(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '')
  return KNOWN_SITES[host] ?? null
}

// ── HTML parsers ─────────────────────────────────────────────

function extractOg(html: string, prop: string): string | null {
  const re1 = new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"'>]+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"'>]+)["'][^>]+property=["']og:${prop}["']`, 'i')
  const m = html.match(re1) ?? html.match(re2)
  return m ? decode(m[1]) : null
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? decode(m[1].trim()) : null
}

function extractMetaName(html: string, name: string): string | null {
  const re1 = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"'>]+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"'>]+)["'][^>]+name=["']${name}["']`, 'i')
  const m = html.match(re1) ?? html.match(re2)
  return m ? decode(m[1]) : null
}

function resolveImage(src: string | null, base: string): string | null {
  if (!src) return null
  try { return new URL(src, base).href } catch { return src }
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}
