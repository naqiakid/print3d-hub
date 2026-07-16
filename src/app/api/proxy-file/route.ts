import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')
  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    const response = await fetch(targetUrl)
    if (!response.ok) {
      return new NextResponse(`Failed to fetch target URL: ${response.status} ${response.statusText}`, { status: response.status })
    }

    // Forward the file stream with CORS headers
    const headers = new Headers()
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    
    const contentType = response.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    
    const contentLength = response.headers.get('content-length')
    if (contentLength) headers.set('content-length', contentLength)

    return new NextResponse(response.body, {
      status: 200,
      headers
    })
  } catch (err: any) {
    return new NextResponse(`Proxy server error: ${err.message}`, { status: 500 })
  }
}
