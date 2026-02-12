// app/(public)/funding/page.tsx
import Link from 'next/link'
import { Heart, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function FundingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Fund the Investigation</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Every dollar goes directly to AI processing. No salaries, no overhead.
          Your contribution makes pages of evidence searchable for everyone.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-12">
        {[
          { amount: '$5', pages: '2,400', desc: 'Makes a small deposition searchable' },
          { amount: '$25', pages: '12,000', desc: 'Processes an entire FBI case file' },
          { amount: '$100', pages: '48,000', desc: 'Unlocks a full evidence collection' },
        ].map(({ amount, pages, desc }) => (
          <Card key={amount} className="border-border bg-surface text-center">
            <CardHeader>
              <CardTitle className="text-3xl text-primary">{amount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold mb-1">{pages} pages</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4">
        <a
          href={process.env.NEXT_PUBLIC_GOFUNDME_URL || 'https://www.gofundme.com/f/the-epstein-archive'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" className="gap-2">
            <Heart className="h-5 w-5" />
            Donate on GoFundMe
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
        <p className="text-xs text-muted-foreground">
          All spending is transparent.{' '}
          <Link href="/sources" className="text-primary hover:underline">
            View processing status
          </Link>
        </p>
      </div>
    </div>
  )
}
