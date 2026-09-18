import Stripe from 'stripe'
import type { PrintRequest } from '@/lib/types'
import { cleanDescription } from '@/lib/types'

// Initialize Stripe instance if key is present
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || ''
export const isStripeConfigured =
  Boolean(stripeSecretKey) &&
  !stripeSecretKey.includes('placeholder') &&
  (stripeSecretKey.startsWith('sk_test_') || stripeSecretKey.startsWith('sk_live_'))

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as unknown as Stripe.LatestApiVersion,
      appInfo: {
        name: 'Print3D Hub Malaysia',
        version: '1.0.0',
      },
    })
  : null

export interface CreateCheckoutResult {
  url: string
  sessionId: string
  isSimulation?: boolean
}

/**
 * Creates a Stripe Checkout Session for a 3D print order
 * Supports Malaysian FPX Online Banking, Credit/Debit Cards, and GrabPay in MYR.
 */
export async function createStripeCheckoutSession(
  request: PrintRequest,
  baseUrl: string
): Promise<{ data?: CreateCheckoutResult; error?: string }> {
  const printPrice = request.quoted_price ?? 0
  const deliveryCost = request.delivery_cost ?? 0
  const totalAmount = printPrice + deliveryCost

  if (totalAmount <= 0) {
    return { error: 'Order total must be greater than RM 0.00' }
  }

  const orderRef = `QID-${request.id.slice(0, 8).toUpperCase()}`

  // ── 1. If real Stripe credentials configured, call Stripe API ──
  if (stripe && isStripeConfigured) {
    try {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price_data: {
            currency: 'myr',
            unit_amount: Math.round(printPrice * 100),
            product_data: {
              name: `3D Print: ${cleanDescription(request.description || 'Custom Model')}`,
              description: `Job #${orderRef} · ${request.material?.toUpperCase() || 'PLA'} (${request.color || 'Standard'})`,
            },
          },
          quantity: 1,
        },
      ]

      if (deliveryCost > 0) {
        lineItems.push({
          price_data: {
            currency: 'myr',
            unit_amount: Math.round(deliveryCost * 100),
            product_data: {
              name: 'Pos Laju / J&T Express Parcel Delivery',
              description: `Delivery to ${request.delivery_address || 'Customer shipping destination'}`,
            },
          },
          quantity: 1,
        })
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['fpx', 'card', 'grabpay'],
        mode: 'payment',
        customer_email: request.customer_email || undefined,
        client_reference_id: request.id,
        line_items: lineItems,
        metadata: {
          request_id: request.id,
          order_ref: orderRef,
          customer_name: request.customer_name,
          customer_phone: request.customer_phone,
        },
        success_url: `${baseUrl}/track/${request.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/track/${request.id}?payment=cancelled`,
      })

      if (!session.url) {
        return { error: 'Failed to generate Stripe checkout URL' }
      }

      return {
        data: {
          url: session.url,
          sessionId: session.id,
          isSimulation: false,
        },
      }
    } catch (err: unknown) {
      console.error('Stripe API error:', err)
      const message = err instanceof Error ? err.message : 'Stripe checkout initialization failed'
      return { error: message }
    }
  }

  // ── 2. Sandbox Simulation Mode for Localhost Development ──
  // If user hasn't added real sk_test_ keys yet, redirect to built-in simulated sandbox gateway
  const simSessionId = `sim_cs_${Date.now()}_${request.id.slice(0, 8)}`
  const simulationUrl = `${baseUrl}/checkout/sandbox?requestId=${request.id}&sessionId=${simSessionId}&amount=${totalAmount.toFixed(2)}`

  return {
    data: {
      url: simulationUrl,
      sessionId: simSessionId,
      isSimulation: true,
    },
  }
}
