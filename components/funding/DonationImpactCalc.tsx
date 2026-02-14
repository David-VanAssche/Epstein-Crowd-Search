// components/funding/DonationImpactCalc.tsx
'use client'

import { useState, useMemo } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function sliderToAmount(value: number): number {
  if (value <= 0) return 1
  const amount = Math.round(Math.exp((value / 100) * Math.log(1000)))
  return Math.max(1, Math.min(amount, 1000))
}

function amountToSlider(amount: number): number {
  if (amount <= 1) return 0
  return Math.round((Math.log(amount) / Math.log(1000)) * 100)
}

const COST_PER_PAGE = 2.10 / 1000
const ENTITIES_PER_PAGE = 2.5

export function DonationImpactCalc() {
  const [sliderValue, setSliderValue] = useState([amountToSlider(25)])
  const [isLoading, setIsLoading] = useState(false)
  const amount = useMemo(() => sliderToAmount(sliderValue[0]), [sliderValue])
  const pages = Math.round(amount / COST_PER_PAGE)
  const entities = Math.round(pages * ENTITIES_PER_PAGE)

  async function handleCheckout() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_slug: 'general',
          amount_cents: amount * 100,
        }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-xl">Your Dollar, Visualized</CardTitle>
        <p className="text-sm text-muted-foreground">
          Drag the slider to see exactly what your donation makes possible.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <span className="text-4xl font-bold text-primary">${amount}</span>
        </div>

        <Slider
          aria-label="Donation amount"
          value={sliderValue}
          onValueChange={setSliderValue}
          max={100}
          step={1}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>$1</span>
          <span>$10</span>
          <span>$100</span>
          <span>$1,000</span>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pages processed:</span>
            <span className="text-lg font-bold text-foreground">{pages.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Entity mentions uncovered:</span>
            <span className="text-lg font-bold text-foreground">~{entities.toLocaleString()}</span>
          </div>

          <div className="flex flex-wrap gap-1 py-2">
            {Array.from({ length: Math.min(Math.ceil(pages / 500), 40) }).map((_, i) => (
              <div
                key={i}
                className="h-3 w-2 rounded-sm bg-primary/60 transition-all"
                style={{ animationDelay: `${i * 30}ms` }}
              />
            ))}
            {pages > 20000 && (
              <span className="flex items-center text-xs text-muted-foreground">
                +{(pages - 20000).toLocaleString()} more
              </span>
            )}
          </div>

          <p className="text-sm text-accent">
            Your ${amount} would process {pages.toLocaleString()} pages, uncovering approximately{' '}
            {entities.toLocaleString()} entity mentions.
          </p>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleCheckout}
          disabled={isLoading}
        >
          {isLoading ? 'Redirecting to checkout...' : `Fund $${amount} Now`}
        </Button>
      </CardContent>
    </Card>
  )
}
