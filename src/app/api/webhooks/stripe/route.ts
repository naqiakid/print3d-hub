import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'
import { stripe } from '@/lib/payment/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature')
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    let event: Stripe.Event

    // ── 1. Cryptographic Signature Verification ──
    if (stripe && webhookSecret && !webhookSecret.includes('placeholder') && signature) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid signature'
        console.error('Stripe webhook signature verification failed:', msg)
        return NextResponse.json({ error: `Webhook signature error: ${msg}` }, { status: 400 })
      }
    } else {
      // Allow json parsing fallback for test simulation or direct sandbox trigger
      try {
        event = JSON.parse(rawBody) as Stripe.Event
      } catch {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
      }
    }

    // ── 2. Handle Checkout Completed ──
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const requestId = session.client_reference_id || session.metadata?.request_id

      if (!requestId) {
        console.warn('Webhook received checkout.session.completed without request_id')
        return NextResponse.json({ received: true, note: 'No request_id found' })
      }

      const paymentMethod = session.payment_method_types?.[0] || 'stripe'

      const supabase = createAdminClient()

      // Verify request exists
      const { data: requestRow } = await supabase
        .from('requests')
        .select('id, status, customer_name, quoted_price, delivery_cost')
        .eq('id', requestId)
        .maybeSingle()

      if (!requestRow) {
        console.error(`Request ${requestId} not found in database`)
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      }

      // Update payment status to paid & ensure status is accepted
      const updatePayload: Record<string, unknown> = {
        payment_status: 'paid',
        payment_method: paymentMethod,
      }

      // If customer accepted quote via direct payment, ensure status moves to accepted
      if (requestRow.status === 'quoted') {
        updatePayload.status = 'accepted'
      }

      const { error: updateErr } = await supabase
        .from('requests')
        .update(updatePayload)
        .eq('id', requestId)

      if (updateErr) {
        console.error(`Failed to update request ${requestId}:`, updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      console.log(`Payment successfully confirmed via webhook for Order #${requestId.slice(0, 8)}`)

      revalidatePath(`/track/${requestId}`)
      revalidatePath('/dashboard')
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    console.error('Stripe webhook processing error:', err)
    const msg = err instanceof Error ? err.message : 'Webhook error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
