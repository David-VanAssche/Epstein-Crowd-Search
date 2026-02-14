import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { campaign_slug, amount_cents, donor_display_name, is_anonymous } = body

  // Validate amount: min $1 (100 cents), max $10,000 (1_000_000 cents)
  if (!amount_cents || amount_cents < 100 || amount_cents > 1_000_000) {
    return NextResponse.json(
      { error: 'Amount must be between $1 and $10,000' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(amount_cents)) {
    return NextResponse.json({ error: 'Amount must be an integer (cents)' }, { status: 400 })
  }

  const supabase = await createClient()

  // Look up campaign if slug provided
  let campaignId: string | null = null
  let campaignTitle = 'Epstein Archive Processing'
  if (campaign_slug) {
    const { data: campaign } = await supabase
      .from('processing_campaigns')
      .select('id, title')
      .eq('slug', campaign_slug)
      .single()

    if (campaign) {
      campaignId = campaign.id
      campaignTitle = campaign.title
    }
  }

  // Insert pending contribution
  const { data: contribution, error: insertError } = await supabase
    .from('contributions')
    .insert({
      campaign_id: campaignId,
      amount_cents,
      status: 'pending',
      donor_display_name: donor_display_name || null,
      is_anonymous: is_anonymous !== false,
    })
    .select('id')
    .single()

  if (insertError || !contribution) {
    return NextResponse.json({ error: 'Failed to create contribution' }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amount_cents,
          product_data: {
            name: campaignTitle,
            description: `Fund document processing: ${campaignTitle}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      campaign_slug: campaign_slug || 'general',
      contribution_id: contribution.id,
    },
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout/cancel`,
  })

  // Update contribution with session ID
  await supabase
    .from('contributions')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', contribution.id)

  return NextResponse.json({ checkout_url: session.url })
}
