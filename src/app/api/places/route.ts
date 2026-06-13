import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 3) return NextResponse.json([])

  const key = process.env.GOOGLE_MAPS_API_KEY

  if (key) {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:my&types=address&key=${key}&language=en`
    try {
      const res = await fetch(url)
      const data = await res.json() as {
        status: string
        predictions: { description: string; place_id: string }[]
      }
      if (data.status === 'OK') {
        return NextResponse.json(
          data.predictions.map((p) => ({
            display_name: p.description,
            place_id: p.place_id,
            source: 'google' as const,
          }))
        )
      }
    } catch {
      // fall through to Nominatim
    }
  }

  // Fallback: OpenStreetMap Nominatim
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=my&addressdetails=0`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'print3d-hub/1.0', 'Accept-Language': 'en' },
    })
    const data = await res.json() as {
      display_name: string
      place_id: number
      lat: string
      lon: string
    }[]
    return NextResponse.json(
      data.map((d) => ({
        display_name: d.display_name,
        place_id: String(d.place_id),
        lat: d.lat,
        lon: d.lon,
        source: 'nominatim' as const,
      }))
    )
  } catch {
    return NextResponse.json([])
  }
}
