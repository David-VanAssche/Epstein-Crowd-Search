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
        .select('id, campaign_id, amount_cents')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single()

      if (contribution) {
        // Mark as refunded
        await supabase
          .from('contributions')
          .update({
            status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', contribution.id)

        // Decrement campaign funded_amount
        if (contribution.campaign_id) {
          await supabase.rpc('allocate_contribution', {
            p_contribution_id: contribution.id,
          })
          // Re-aggregate since the contribution is now refunded (excluded from SUM)
          await supabase.rpc('recompute_funding_status')
        }

        // Recompute global funding status
        await supabase.rpc('recompute_funding_status')
      }
    }
  }

  return NextResponse.json({ received: true })
}
