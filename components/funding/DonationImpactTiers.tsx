// components/funding/DonationImpactTiers.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const TIERS = [
  { amount: 1, pages: 475, description: 'Process a short FBI interview summary', analogy: 'Like reading one chapter of a book' },
  { amount: 5, pages: 2400, description: 'Process an entire deposition transcript', analogy: 'Like scanning a full legal filing' },
  { amount: 10, pages: 4750, description: 'Process a full box of seized financial records', analogy: 'Like digitizing a banker box of documents' },
  { amount: 25, pages: 12000, description: 'Process an entire year of flight logs', analogy: 'Like cataloging every flight for 12 months' },
  { amount: 50, pages: 24000, description: 'Process every document from a single grand jury proceeding', analogy: 'Like indexing a complete court case' },
  { amount: 100, pages: 48000, description: 'Process half a filing cabinet of correspondence', analogy: 'Like making a small archive searchable' },
  { amount: 250, pages: 119000, description: 'Process an entire FBI field office case file', analogy: 'Like unlocking a complete investigation' },
  { amount: 500, pages: 238000, description: 'Process multiple years of financial transaction records', analogy: 'Like following the money across years' },
  { amount: 1500, pages: 714000, description: 'Process a significant portion of the entire DOJ release', analogy: 'Like opening a vault of evidence' },
  { amount: 5000, pages: 2380000, description: 'Process nearly the entire Epstein document corpus', analogy: 'Like making the full truth searchable' },
]

export function DonationImpactTiers() {
  const gofundmeUrl = process.env.NEXT_PUBLIC_GOFUNDME_URL || '#'

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Impact Tiers</h2>
        <p className="mt-2 text-muted-foreground">
          Every dollar goes directly to processing. Here is exactly what each amount unlocks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {TIERS.map((tier) => (
          <Card
            key={tier.amount}
            className="border-border bg-surface transition-colors hover:bg-surface-elevated"
          >
            <CardContent className="flex h-full flex-col justify-between pt-6">
              <div>
                <div className="mb-2 text-3xl font-bold text-primary">
                  ${tier.amount.toLocaleString()}
                </div>
                <div className="mb-1 text-sm font-semibold text-foreground">
                  {tier.pages.toLocaleString()} pages
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{tier.description}</p>
                <p className="text-xs italic text-muted-foreground">{tier.analogy}</p>
              </div>
              <a
                href={`${gofundmeUrl}?amount=${tier.amount}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block"
              >
                <Button variant="outline" size="sm" className="w-full">
                  Donate ${tier.amount.toLocaleString()}
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
