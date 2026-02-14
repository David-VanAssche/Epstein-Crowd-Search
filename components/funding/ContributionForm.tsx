'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000] // cents

interface ContributionFormProps {
  campaignSlug: string
  className?: string
}

export function ContributionForm({ campaignSlug, className }: ContributionFormProps) {
  const [selectedCents, setSelectedCents] = useState<number | null>(2500)
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountCents = isCustom
    ? Math.round(parseFloat(customAmount || '0') * 100)
    : (selectedCents ?? 0)

  async function handleCheckout() {
    if (amountCents < 100) {
      setError('Minimum amount is $1')
      return
    }
    if (amountCents > 1_000_000) {
      setError('Maximum amount is $10,000')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_slug: campaignSlug,
          amount_cents: amountCents,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Checkout failed')
        return
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {PRESET_AMOUNTS.map((cents) => (
          <Button
            key={cents}
            variant={!isCustom && selectedCents === cents ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedCents(cents)
              setIsCustom(false)
              setError(null)
            }}
          >
            ${cents / 100}
          </Button>
        ))}
        <Button
          variant={isCustom ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setIsCustom(true)
            setSelectedCents(null)
            setError(null)
          }}
        >
          Custom
        </Button>
      </div>

      {isCustom && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm font-medium">$</span>
          <Input
            type="number"
            min={1}
            max={10000}
            step={1}
            placeholder="Amount"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value)
              setError(null)
            }}
            className="w-28"
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      <Button
        className="mt-3 w-full"
        onClick={handleCheckout}
        disabled={isLoading || amountCents < 100}
      >
        {isLoading
          ? 'Redirecting...'
          : `Fund Processing — $${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`}
      </Button>
    </div>
  )
}
