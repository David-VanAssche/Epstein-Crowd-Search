// app/api/funding/impact/route.ts
import { NextRequest, NextResponse } from 'next/server'

const COST_PER_PAGE = 2.10 / 1000
const ENTITIES_PER_PAGE = 2.5

const DONATION_TIERS = [
  { amount: 1, pages: 475, analogy: 'A short FBI interview summary' },
  { amount: 5, pages: 2400, analogy: 'An entire deposition transcript' },
  { amount: 10, pages: 4750, analogy: 'A full box of seized financial records' },
  { amount: 25, pages: 12000, analogy: 'An entire year of flight logs' },
  { amount: 50, pages: 24000, analogy: 'Every document from a single grand jury proceeding' },
  { amount: 100, pages: 48000, analogy: 'Half a filing cabinet of correspondence' },
  { amount: 250, pages: 119000, analogy: 'An entire FBI field office case file' },
  { amount: 500, pages: 238000, analogy: 'Multiple years of financial transaction records' },
  { amount: 1500, pages: 714000, analogy: 'A significant portion of the entire DOJ release' },
  { amount: 5000, pages: 2380000, analogy: 'Nearly the entire Epstein document corpus' },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const amount = parseFloat(searchParams.get('amount') || '0')

  if (amount <= 0 || isNaN(amount) || amount > 1_000_000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const pages = Math.round(amount / COST_PER_PAGE)
  const entities_estimated = Math.round(pages * ENTITIES_PER_PAGE)

  let analogy = 'Every page brings us closer to the truth'
  for (let i = DONATION_TIERS.length - 1; i >= 0; i--) {
    if (amount >= DONATION_TIERS[i].amount) {
      analogy = DONATION_TIERS[i].analogy
      break
    }
  }

  return NextResponse.json({
    amount,
    pages,
    entities_estimated,
    analogy,
    cost_per_page: COST_PER_PAGE,
  })
}
