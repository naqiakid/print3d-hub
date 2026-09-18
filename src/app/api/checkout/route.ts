import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PrintRequest } from '@/lib/types'
import { createStripeCheckoutSession } from '@/lib/payment/stripe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestId } = body

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid requestId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: requestRow, error: fetchErr } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()

    if (fetchErr || !requestRow) {
      return NextResponse.json({ error: 'Print request not found' }, { status: 404 })
    }

    const request = requestRow as unknown as PrintRequest

    if (!['quoted', 'accepted'].includes(request.status)) {
      return NextResponse.json(
        { error: 'Order is not in an active payable status' },
        { status: 400 }
      )
    }

    const host = req.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    const result = await createStripeCheckoutSession(request, baseUrl)

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error || 'Failed to create checkout' }, { status: 500 })
    }

    return NextResponse.json({
      url: result.data.url,
      sessionId: result.data.sessionId,
      isSimulation: result.data.isSimulation ?? false,
    })
  } catch (err: unknown) {
    console.error('Checkout route error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
