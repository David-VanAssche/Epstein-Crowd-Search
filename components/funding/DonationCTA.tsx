// components/funding/DonationCTA.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useFundingStatus } from '@/lib/hooks/useFunding'

interface DonationCTAProps {
  variant: 'bar' | 'card' | 'banner'
}

export function DonationCTA({ variant }: DonationCTAProps) {
  const { data } = useFundingStatus()
  const raised = data?.raised ?? 0
  const goal = data?.goal ?? 16000
  const percentage = Math.min(data?.percentage ?? 0, 100)
  const gofundmeUrl = process.env.NEXT_PUBLIC_GOFUNDME_URL || '#'

  // Banner starts hidden to prevent flash, then reads localStorage
  const [dismissed, setDismissed] = useState(variant === 'banner')
  useEffect(() => {
    if (variant === 'banner') {
      try {
        const pref = localStorage.getItem('funding-banner-dismissed')
        setDismissed(pref === 'true')
      } catch {
        setDismissed(false)
      }
    } else {
      setDismissed(false)
    }
  }, [variant])

  if (dismissed && variant === 'banner') return null

  if (variant === 'bar') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2">
        <Progress value={percentage} className="h-2 flex-1" />
        <span className="whitespace-nowrap text-sm">
          ${raised.toLocaleString()} of ${(goal / 1000).toFixed(0)}K raised
        </span>
        <span className="text-sm text-muted-foreground">&mdash;</span>
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          Your $5 processes 2,400 pages
        </span>
        <a href={gofundmeUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            Donate
          </Button>
        </a>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <Card className="border-border bg-surface">
        <CardContent className="pt-6 text-center">
          <h3 className="mb-2 text-lg font-semibold">Help Process the Evidence</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Every dollar goes directly to making documents searchable. Your $5 makes 2,400 pages available to researchers.
          </p>
          <Progress value={percentage} className="mb-3 h-2" />
          <p className="mb-4 text-xs text-muted-foreground">
            ${raised.toLocaleString()} of ${goal.toLocaleString()} raised
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/funding">See Your Impact</Link>
            </Button>
            <a href={gofundmeUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm">Donate Now</Button>
            </a>
          </div>
        </CardContent>
      </Card>
    )
  }

  // variant === 'banner'
  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-3">
        <Progress value={percentage} className="h-2 w-32" />
        <span className="text-sm">
          {percentage}% of documents processed. Help unlock the rest.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <a href={gofundmeUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            Donate
          </Button>
        </a>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              localStorage.setItem('funding-banner-dismissed', 'true')
            } catch {
              // localStorage unavailable
            }
            setDismissed(true)
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
