import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id') ?? ''
  const key = process.env.GOOGLE_MAPS_API_KEY

  if (!key) return NextResponse.json({ error: 'Google Maps not configured' }, { status: 400 })

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${key}&language=en`
  const res = await fetch(url)
  const data = await res.json() as {
    status: string
    result?: {
      geometry: { location: { lat: number; lng: number } }
      formatted_address: string
    }
  }

  if (data.status === 'OK' && data.result) {
    return NextResponse.json({
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
      address: data.result.formatted_address,
    })
  }

  return NextResponse.json({ error: data.status }, { status: 400 })
}
