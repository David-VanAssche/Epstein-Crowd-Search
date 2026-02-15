import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const contributionId = session.metadata?.contribution_id
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

    if (contributionId) {
      // Mark contribution as paid
      await supabase
        .from('contributions')
        .update({
          status: 'paid',
          stripe_payment_intent_id: paymentIntentId || null,
          stripe_customer_email: session.customer_details?.email || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contributionId)

      // Call allocate_contribution to update campaign funding + global stats
      await supabase.rpc('allocate_contribution', {
        p_contribution_id: contributionId,
      })
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id

    if (paymentIntentId) {
      // Find the contribution by payment intent
      const { data: contribution } = await supabase
        .from('contributions')
        .select('id, campaign_id, amount_cents, status')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single()

      if (contribution) {
        // Idempotency: skip if already fully refunded
        if (contribution.status === 'refunded') {
          return NextResponse.json({ received: true })
        }

        // Determine actual refund amount from Stripe (handles partial refunds)
        // charge.amount_refunded is the cumulative refunded amount in cents
        const refundedCents = (charge as any).amount_refunded || contribution.amount_cents
        const isFullRefund = refundedCents >= contribution.amount_cents

        // Update contribution status
        await supabase
          .from('contributions')
          .update({
            status: isFullRefund ? 'refunded' : 'partial_refund',
            updated_at: new Date().toISOString(),
          })
          .eq('id', contribution.id)

        // Recompute global funding status from all paid contributions
        // This re-sums all contributions with status='paid', so a full refund
        // (status='refunded') is automatically excluded. For partial refunds,
        // the original amount_cents stays unchanged and is still counted.
        await supabase.rpc('recompute_funding_status')
      }
    }
  }

  return NextResponse.json({ received: true })
}
