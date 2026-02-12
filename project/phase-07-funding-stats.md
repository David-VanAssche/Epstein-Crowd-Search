# Phase 7: Funding & Stats Dashboard

> **Sessions:** 2 | **Dependencies:** Phase 3 (UI pages), Phase 4 (API routes) | **Parallel with:** Phase 5 (Interactive Features)

## Summary

Build the live funding tracker page, donation impact calculator, spend transparency log, corpus stats page, corpus coverage heatmap, document completeness dashboard, "This Day in the Files" feature, research activity tracking, and prosecutor overview. Funding visibility is critical for driving donations — every page should connect users to the funding story and show exactly where attention is needed. Every dollar and every processing run should be visible and accountable. The stats dashboard shows community progress: documents processed, redactions solved, entities discovered, and where the blind spots are.

## IMPORTANT: Cost Model

The $2.10 per 1,000 pages cost model is the basis for all impact calculations throughout this phase. Spend log entries are created by the batch processing pipeline (Phase 6) — this phase only reads and displays them. The GoFundMe widget uses a placeholder `<iframe>` with a comment explaining how to get the real widget URL.

---

## Step-by-Step Execution

### Step 1: Create component directories

```bash
mkdir -p components/funding
mkdir -p components/stats
```

### Step 2: Install additional shadcn/ui components

```bash
# These are needed by Phase 7 pages (some may already exist from Phase 3)
npx shadcn@latest add progress
npx shadcn@latest add slider
npx shadcn@latest add scroll-area
npx shadcn@latest add table
npx shadcn@latest add tabs
npx shadcn@latest add tooltip
npx shadcn@latest add separator
npx shadcn@latest add select
npx shadcn@latest add checkbox
npx shadcn@latest add label
```

Answer "yes" to all prompts. All components go into `components/ui/`.

### Step 3: Create Funding API routes

These API routes provide data to all the funding-related components.

#### Funding Status API — `app/api/funding/status/route.ts`

```typescript
// app/api/funding/status/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Fetch from funding_status table (single row, updated periodically)
  const { data, error } = await supabase
    .from('funding_status')
    .select('*')
    .single()

  if (error || !data) {
    // Return sensible defaults if no data yet
    return NextResponse.json({
      raised: 0,
      goal: 16000,
      percentage: 0,
      donor_count: 0,
      last_updated: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    raised: data.amount_raised ?? 0,
    goal: data.goal_amount ?? 16000,
    percentage: data.goal_amount
      ? Math.round(((data.amount_raised ?? 0) / data.goal_amount) * 100)
      : 0,
    donor_count: data.donor_count ?? 0,
    last_updated: data.updated_at ?? new Date().toISOString(),
  })
}
```

#### Donation Impact API — `app/api/funding/impact/route.ts`

```typescript
// app/api/funding/impact/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Cost model: $2.10 per 1,000 pages
const COST_PER_PAGE = 2.10 / 1000 // $0.0021 per page
const ENTITIES_PER_PAGE = 2.5 // average estimated entities per page

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

  if (amount <= 0 || isNaN(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const pages = Math.round(amount / COST_PER_PAGE)
  const entities_estimated = Math.round(pages * ENTITIES_PER_PAGE)

  // Find the closest tier for an analogy
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
```

#### Spend Log API — `app/api/funding/spend-log/route.ts`

```typescript
// app/api/funding/spend-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const service = searchParams.get('service') // optional filter
  const date_from = searchParams.get('date_from') // optional filter
  const date_to = searchParams.get('date_to') // optional filter

  const supabase = await createClient()

  let query = supabase
    .from('processing_spend_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (service) {
    query = query.eq('service', service)
  }
  if (date_from) {
    query = query.gte('created_at', date_from)
  }
  if (date_to) {
    query = query.lte('created_at', date_to)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ entries: [], total: 0, page, limit })
  }

  return NextResponse.json({
    entries: data ?? [],
    total: count ?? 0,
    page,
    limit,
    total_pages: Math.ceil((count ?? 0) / limit),
  })
}
```

### Step 4: Create funding hooks

File: `lib/hooks/useFunding.ts`

```typescript
// lib/hooks/useFunding.ts
'use client'

import { useQuery } from '@tanstack/react-query'

interface FundingStatus {
  raised: number
  goal: number
  percentage: number
  donor_count: number
  last_updated: string
}

interface DonationImpact {
  amount: number
  pages: number
  entities_estimated: number
  analogy: string
  cost_per_page: number
}

interface SpendLogEntry {
  id: string
  created_at: string
  amount: number
  service: string
  description: string
  pages_processed: number
  entities_extracted: number
  redactions_found: number
}

interface SpendLogResponse {
  entries: SpendLogEntry[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export function useFundingStatus() {
  return useQuery<FundingStatus>({
    queryKey: ['funding', 'status'],
    queryFn: () => fetch('/api/funding/status').then((r) => r.json()),
    refetchInterval: 15 * 60 * 1000, // Refresh every 15 minutes
    staleTime: 5 * 60 * 1000,
  })
}

export function useDonationImpact(amount: number) {
  return useQuery<DonationImpact>({
    queryKey: ['funding', 'impact', amount],
    queryFn: () => fetch(`/api/funding/impact?amount=${amount}`).then((r) => r.json()),
    enabled: amount > 0,
  })
}

export function useSpendLog(options?: {
  page?: number
  limit?: number
  service?: string
  date_from?: string
  date_to?: string
}) {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.service) params.set('service', options.service)
  if (options?.date_from) params.set('date_from', options.date_from)
  if (options?.date_to) params.set('date_to', options.date_to)

  return useQuery<SpendLogResponse>({
    queryKey: ['funding', 'spend-log', options],
    queryFn: () => fetch(`/api/funding/spend-log?${params.toString()}`).then((r) => r.json()),
  })
}
```

### Step 5: Build funding components — Session 1

#### FundingTracker — `components/funding/FundingTracker.tsx`

```tsx
// components/funding/FundingTracker.tsx
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { useFundingStatus } from '@/lib/hooks/useFunding'

interface FundingTrackerProps {
  compact?: boolean
}

export function FundingTracker({ compact = false }: FundingTrackerProps) {
  const { data, isLoading } = useFundingStatus()
  const [displayedAmount, setDisplayedAmount] = useState(0)

  // Animate the number counting up
  useEffect(() => {
    if (!data) return
    const target = data.raised
    const duration = 1500 // ms
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setDisplayedAmount(target)
        clearInterval(timer)
      } else {
        setDisplayedAmount(Math.round(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [data])

  const raised = data?.raised ?? 0
  const goal = data?.goal ?? 16000
  const percentage = data?.percentage ?? 0
  const donorCount = data?.donor_count ?? 0

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Progress value={percentage} className="h-2 flex-1" />
        <span className="whitespace-nowrap text-sm font-medium">
          ${displayedAmount.toLocaleString()} / ${(goal / 1000).toFixed(0)}K
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-5xl font-bold text-primary">
          <span className="tabular-nums">${displayedAmount.toLocaleString()}</span>
        </div>
        <p className="mt-1 text-lg text-muted-foreground">
          raised of <span className="font-semibold text-foreground">${goal.toLocaleString()}</span> goal
        </p>
      </div>

      {/* Large progress bar with animated fill and subtle glow */}
      <div className="relative">
        <Progress value={percentage} className="h-6 rounded-full" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/20 blur-md transition-all duration-1000"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {percentage}%
        </span>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {donorCount > 0 ? `${donorCount} donors` : 'Be the first donor'}
        {data?.last_updated && (
          <span> &middot; Updated {new Date(data.last_updated).toLocaleDateString()}</span>
        )}
      </p>
    </div>
  )
}
```

#### DonationImpactCalc — `components/funding/DonationImpactCalc.tsx`

```tsx
// components/funding/DonationImpactCalc.tsx
'use client'

import { useState, useMemo } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Logarithmic scale: slider position 0-100 maps to $1-$1000
function sliderToAmount(value: number): number {
  if (value <= 0) return 1
  const amount = Math.round(Math.exp((value / 100) * Math.log(1000)))
  return Math.max(1, Math.min(amount, 1000))
}

function amountToSlider(amount: number): number {
  if (amount <= 1) return 0
  return Math.round((Math.log(amount) / Math.log(1000)) * 100)
}

// Cost model: $2.10 per 1,000 pages
const COST_PER_PAGE = 2.10 / 1000
const ENTITIES_PER_PAGE = 2.5

export function DonationImpactCalc() {
  const [sliderValue, setSliderValue] = useState([amountToSlider(25)])
  const amount = useMemo(() => sliderToAmount(sliderValue[0]), [sliderValue])
  const pages = Math.round(amount / COST_PER_PAGE)
  const entities = Math.round(pages * ENTITIES_PER_PAGE)

  const gofundmeUrl = process.env.NEXT_PUBLIC_GOFUNDME_URL || '#'

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-xl">Your Dollar, Visualized</CardTitle>
        <p className="text-sm text-muted-foreground">
          Drag the slider to see exactly what your donation makes possible.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Amount display */}
        <div className="text-center">
          <span className="text-4xl font-bold text-primary">${amount}</span>
        </div>

        {/* Logarithmic slider */}
        <Slider
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

        {/* Impact visualization */}
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pages processed:</span>
            <span className="text-lg font-bold text-foreground">{pages.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Entity mentions uncovered:</span>
            <span className="text-lg font-bold text-foreground">~{entities.toLocaleString()}</span>
          </div>

          {/* Visual page flip animation placeholder */}
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

        {/* Donate button */}
        <a
          href={`${gofundmeUrl}?amount=${amount}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button size="lg" className="w-full">
            Donate ${amount} Now
          </Button>
        </a>
      </CardContent>
    </Card>
  )
}
```

#### DonationImpactTiers — `components/funding/DonationImpactTiers.tsx`

```tsx
// components/funding/DonationImpactTiers.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const TIERS = [
  {
    amount: 1,
    pages: 475,
    description: 'Process a short FBI interview summary',
    analogy: 'Like reading one chapter of a book',
  },
  {
    amount: 5,
    pages: 2400,
    description: 'Process an entire deposition transcript',
    analogy: 'Like scanning a full legal filing',
  },
  {
    amount: 10,
    pages: 4750,
    description: 'Process a full box of seized financial records',
    analogy: 'Like digitizing a banker box of documents',
  },
  {
    amount: 25,
    pages: 12000,
    description: 'Process an entire year of flight logs',
    analogy: 'Like cataloging every flight for 12 months',
  },
  {
    amount: 50,
    pages: 24000,
    description: 'Process every document from a single grand jury proceeding',
    analogy: 'Like indexing a complete court case',
  },
  {
    amount: 100,
    pages: 48000,
    description: 'Process half a filing cabinet of correspondence',
    analogy: 'Like making a small archive searchable',
  },
  {
    amount: 250,
    pages: 119000,
    description: 'Process an entire FBI field office case file',
    analogy: 'Like unlocking a complete investigation',
  },
  {
    amount: 500,
    pages: 238000,
    description: 'Process multiple years of financial transaction records',
    analogy: 'Like following the money across years',
  },
  {
    amount: 1500,
    pages: 714000,
    description: 'Process a significant portion of the entire DOJ release',
    analogy: 'Like opening a vault of evidence',
  },
  {
    amount: 5000,
    pages: 2380000,
    description: 'Process nearly the entire Epstein document corpus',
    analogy: 'Like making the full truth searchable',
  },
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
```

#### SpendTransparencyLog — `components/funding/SpendTransparencyLog.tsx`

```tsx
// components/funding/SpendTransparencyLog.tsx
'use client'

import { useState } from 'react'
import { useSpendLog } from '@/lib/hooks/useFunding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const SERVICE_TYPES = [
  { value: 'all', label: 'All Services' },
  { value: 'openai', label: 'OpenAI (GPT-4o)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'ocr', label: 'OCR Processing' },
  { value: 'embedding', label: 'Embeddings' },
  { value: 'whisper', label: 'Audio Transcription' },
  { value: 'supabase', label: 'Supabase Storage' },
]

export function SpendTransparencyLog() {
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useSpendLog({
    page,
    limit: 20,
    service: serviceFilter === 'all' ? undefined : serviceFilter,
  })

  const entries = data?.entries ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Every Dollar Accounted For</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete transparency log of all processing spend.
            </p>
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by service" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()} &middot;{' '}
                        {entry.service}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-accent">
                      ${entry.amount.toFixed(2)}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{entry.pages_processed.toLocaleString()} pages</span>
                    <span>{entry.entities_extracted.toLocaleString()} entities</span>
                    <span>{entry.redactions_found.toLocaleString()} redactions</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No processing spend yet. Spend entries will appear here as documents are processed.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

#### ProcessingLiveFeed — `components/funding/ProcessingLiveFeed.tsx`

```tsx
// components/funding/ProcessingLiveFeed.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface ProcessingEvent {
  id: string
  filename: string
  pages: number
  entities: number
  timestamp: string
}

export function ProcessingLiveFeed() {
  // Poll for recent processing events every 10 seconds
  const { data } = useQuery<ProcessingEvent[]>({
    queryKey: ['processing', 'live-feed'],
    queryFn: () => fetch('/api/processing/recent').then((r) => r.json()),
    refetchInterval: 10_000,
    // Disabled until API route exists — Phase 6 batch pipeline produces processing events
    enabled: false,
  })

  const events = data ?? []
  const isActive = events.length > 0

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Live Processing Feed</CardTitle>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Processing' : 'Pipeline Idle'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isActive ? (
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded border border-border bg-background px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">Just processed: </span>
                  <span className="font-medium">{event.filename}</span>
                  <span className="text-muted-foreground">
                    {' '}({event.pages} pages, {event.entities} entities)
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Pipeline idle. Processing events will appear here in real time when batch processing is running.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

#### DonationCTA — `components/funding/DonationCTA.tsx`

```tsx
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
  const percentage = data?.percentage ?? 0
  const gofundmeUrl = process.env.NEXT_PUBLIC_GOFUNDME_URL || '#'

  // Banner: dismissible via localStorage
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    if (variant === 'banner') {
      const pref = localStorage.getItem('funding-banner-dismissed')
      setDismissed(pref === 'true')
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
            <Link href="/funding">
              <Button variant="outline" size="sm">See Your Impact</Button>
            </Link>
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
            localStorage.setItem('funding-banner-dismissed', 'true')
            setDismissed(true)
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
```

### Step 6: Build the Funding Page

File: `app/(public)/funding/page.tsx`

```tsx
// app/(public)/funding/page.tsx
import { FundingTracker } from '@/components/funding/FundingTracker'
import { DonationImpactCalc } from '@/components/funding/DonationImpactCalc'
import { DonationImpactTiers } from '@/components/funding/DonationImpactTiers'
import { SpendTransparencyLog } from '@/components/funding/SpendTransparencyLog'
import { ProcessingLiveFeed } from '@/components/funding/ProcessingLiveFeed'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Funding & Impact — Epstein Files',
  description: 'See exactly where your donations go. Every dollar funds AI processing of the Epstein document corpus.',
}

export default function FundingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero: Giant progress bar */}
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Fund the Truth
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Every dollar goes directly to AI processing. Every penny is accounted for.
        </p>
        <div className="mx-auto max-w-2xl">
          <FundingTracker />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Interactive calculator */}
      <section className="mb-12">
        <div className="mx-auto max-w-2xl">
          <DonationImpactCalc />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Impact tiers */}
      <section className="mb-12">
        <DonationImpactTiers />
      </section>

      <Separator className="my-8" />

      {/* Spend transparency + live feed side by side */}
      <section className="mb-12 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SpendTransparencyLog />
        </div>
        <div>
          <ProcessingLiveFeed />
        </div>
      </section>

      <Separator className="my-8" />

      {/* GoFundMe embed */}
      <section className="mb-12 text-center">
        <h2 className="mb-4 text-2xl font-bold">Every Penny Accounted For</h2>
        <p className="mb-6 text-muted-foreground">
          We process documents using OpenAI GPT-4o for entity extraction, Whisper for audio
          transcription, and Supabase for storage. Cost: $2.10 per 1,000 pages.
        </p>
        <div className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-8">
          {/* GoFundMe widget embed placeholder.
              To get the real widget URL:
              1. Go to your GoFundMe campaign page
              2. Click "Share" then "Embed"
              3. Copy the iframe src URL
              4. Replace the src below with the real URL
          */}
          <iframe
            src="about:blank"
            title="GoFundMe Donation Widget"
            className="h-64 w-full rounded"
          />
          <p className="mt-4 text-xs text-muted-foreground">
            GoFundMe widget will load here. Replace the iframe src with your campaign widget URL.
          </p>
        </div>
      </section>

      {/* Spend category breakdown */}
      <section className="mb-12">
        <h2 className="mb-6 text-center text-2xl font-bold">Where Your Money Goes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { category: 'AI Entity Extraction', percent: 45, desc: 'GPT-4o processes each page to identify people, organizations, locations, and relationships.' },
            { category: 'OCR & Text Processing', percent: 25, desc: 'Converting scanned documents into searchable, structured text.' },
            { category: 'Audio Transcription', percent: 15, desc: 'Whisper AI converts audio recordings into searchable transcripts.' },
            { category: 'Storage & Infrastructure', percent: 15, desc: 'Supabase database, vector embeddings, and file storage.' },
          ].map(({ category, percent, desc }) => (
            <div
              key={category}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="mb-2 text-2xl font-bold text-primary">{percent}%</div>
              <h3 className="mb-1 text-sm font-semibold">{category}</h3>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

### Step 7: Build stats components — Session 2

#### ProcessingProgress — `components/stats/ProcessingProgress.tsx`

```tsx
// components/stats/ProcessingProgress.tsx
'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// The 12 datasets from the DOJ release
const DATASETS = [
  { name: 'SDNY Court Documents', total_pages: 450000 },
  { name: 'FBI Investigation Files', total_pages: 380000 },
  { name: 'Grand Jury Materials', total_pages: 290000 },
  { name: 'Palm Beach Police Reports', total_pages: 125000 },
  { name: 'Flight Logs & Travel Records', total_pages: 85000 },
  { name: 'Financial Records', total_pages: 520000 },
  { name: 'Correspondence & Communications', total_pages: 340000 },
  { name: 'Deposition Transcripts', total_pages: 210000 },
  { name: 'Victim Impact Statements', total_pages: 95000 },
  { name: 'Property & Asset Records', total_pages: 180000 },
  { name: 'Media & Press Materials', total_pages: 145000 },
  { name: 'Miscellaneous DOJ Files', total_pages: 680000 },
]

interface ProcessingProgressProps {
  // Will receive real data from corpus_stats in Phase 4
  stats?: {
    total_pages_processed: number
    total_pages: number
    per_dataset: Array<{ name: string; processed: number; total: number }>
  }
}

export function ProcessingProgress({ stats }: ProcessingProgressProps) {
  const totalPages = stats?.total_pages ?? 3500000
  const processedPages = stats?.total_pages_processed ?? 0
  const overallPercent = totalPages > 0
    ? Math.round((processedPages / totalPages) * 100)
    : 0

  const datasets = stats?.per_dataset ?? DATASETS.map((d) => ({
    name: d.name,
    processed: 0,
    total: d.total_pages,
  }))

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Processing Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall progress */}
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-sm font-medium">Overall</span>
            <span className="text-2xl font-bold text-primary">
              {processedPages.toLocaleString()} <span className="text-sm text-muted-foreground">of {totalPages.toLocaleString()} pages</span>
            </span>
          </div>
          <Progress value={overallPercent} className="h-4" />
          <p className="mt-1 text-right text-xs text-muted-foreground">{overallPercent}% complete</p>
        </div>

        {/* Per-dataset progress */}
        <div className="space-y-4">
          {datasets.map((dataset) => {
            const pct = dataset.total > 0
              ? Math.round((dataset.processed / dataset.total) * 100)
              : 0
            const color = pct >= 100
              ? 'bg-green-500'
              : pct > 0
                ? 'bg-amber-500'
                : 'bg-muted'

            return (
              <div key={dataset.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{dataset.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {dataset.processed.toLocaleString()} / {dataset.total.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### CorpusStats — `components/stats/CorpusStats.tsx`

```tsx
// components/stats/CorpusStats.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CorpusStatsData {
  total_documents: number
  total_pages: number
  total_chunks: number
  total_images: number
  total_videos: number
  total_entities: number
  entities_by_type: {
    person: number
    organization: number
    location: number
    aircraft: number
    vessel: number
    property: number
    account: number
  }
  total_relationships: number
  total_redactions: number
  redactions_by_status: {
    solved: number
    proposed: number
    unsolved: number
  }
  total_contributors: number
  total_proposals: number
  accuracy_rate: number
}

interface CorpusStatsProps {
  stats?: CorpusStatsData
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0) {
      setDisplay(0)
      return
    }
    const duration = 1200
    const steps = 40
    const increment = value / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.round(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [value])

  return <span className="tabular-nums">{display.toLocaleString()}</span>
}

const STAT_CARDS = [
  { key: 'total_documents', label: 'Documents' },
  { key: 'total_pages', label: 'Pages' },
  { key: 'total_chunks', label: 'Text Chunks' },
  { key: 'total_images', label: 'Images' },
  { key: 'total_videos', label: 'Videos' },
  { key: 'total_entities', label: 'Entities' },
  { key: 'total_relationships', label: 'Relationships' },
  { key: 'total_redactions', label: 'Redactions' },
] as const

export function CorpusStats({ stats }: CorpusStatsProps) {
  const defaultStats: CorpusStatsData = {
    total_documents: 0,
    total_pages: 0,
    total_chunks: 0,
    total_images: 0,
    total_videos: 0,
    total_entities: 0,
    entities_by_type: { person: 0, organization: 0, location: 0, aircraft: 0, vessel: 0, property: 0, account: 0 },
    total_relationships: 0,
    total_redactions: 0,
    redactions_by_status: { solved: 0, proposed: 0, unsolved: 0 },
    total_contributors: 0,
    total_proposals: 0,
    accuracy_rate: 0,
  }

  const s = stats ?? defaultStats

  return (
    <div className="space-y-8">
      {/* Main stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label }) => (
          <Card key={key} className="border-border bg-surface">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                <AnimatedNumber value={s[key]} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Entity type breakdown */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-lg">Entities by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(s.entities_by_type).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-sm capitalize">{type}</span>
                <span className="text-sm font-bold">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Redaction status breakdown */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-lg">Redaction Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-green-600/30 bg-green-950/10 p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                <AnimatedNumber value={s.redactions_by_status.solved} />
              </div>
              <p className="text-sm text-muted-foreground">Solved</p>
            </div>
            <div className="rounded-lg border border-amber-600/30 bg-amber-950/10 p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                <AnimatedNumber value={s.redactions_by_status.proposed} />
              </div>
              <p className="text-sm text-muted-foreground">Proposed</p>
            </div>
            <div className="rounded-lg border border-red-600/30 bg-red-950/10 p-4 text-center">
              <div className="text-2xl font-bold text-red-400">
                <AnimatedNumber value={s.redactions_by_status.unsolved} />
              </div>
              <p className="text-sm text-muted-foreground">Unsolved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contributor stats */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-lg">Community Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                <AnimatedNumber value={s.total_contributors} />
              </div>
              <p className="text-sm text-muted-foreground">Contributors</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                <AnimatedNumber value={s.total_proposals} />
              </div>
              <p className="text-sm text-muted-foreground">Proposals Submitted</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {s.accuracy_rate}%
              </div>
              <p className="text-sm text-muted-foreground">Accuracy Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### FundingProgress — `components/stats/FundingProgress.tsx`

```tsx
// components/stats/FundingProgress.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useFundingStatus } from '@/lib/hooks/useFunding'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function FundingProgress() {
  const { data } = useFundingStatus()
  const raised = data?.raised ?? 0
  const goal = data?.goal ?? 16000
  const percentage = data?.percentage ?? 0

  // Convert dollars to pages using the cost model
  const pagesProcessed = Math.round(raised / (2.10 / 1000))

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Funding Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={percentage} className="h-3" />
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">${raised.toLocaleString()}</span>
          <span className="text-muted-foreground">of ${goal.toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          ${raised.toLocaleString()} raised = {pagesProcessed.toLocaleString()} pages processed
        </p>
        <Link href="/funding">
          <Button variant="outline" size="sm" className="w-full">
            View Full Funding Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
```

#### CoverageHeatmap — `components/stats/CoverageHeatmap.tsx`

```tsx
// components/stats/CoverageHeatmap.tsx
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const DATASETS = [
  'SDNY Court Documents',
  'FBI Investigation Files',
  'Grand Jury Materials',
  'Palm Beach Police Reports',
  'Flight Logs',
  'Financial Records',
  'Correspondence',
  'Deposition Transcripts',
  'Victim Statements',
  'Property Records',
  'Media Materials',
  'Misc. DOJ Files',
]

const DOC_TYPES = [
  'PDF Reports',
  'Scanned Images',
  'Audio Transcripts',
  'Video Files',
  'Spreadsheets',
  'Emails',
]

interface CoverageHeatmapProps {
  // Will receive real data from corpus_stats in Phase 4
  coverageData?: Record<string, Record<string, number>> // dataset -> doc_type -> percentage (0-100)
}

function getCellColor(percentage: number): string {
  if (percentage >= 80) return 'bg-green-600/80'
  if (percentage >= 60) return 'bg-green-600/50'
  if (percentage >= 40) return 'bg-amber-500/50'
  if (percentage >= 20) return 'bg-amber-500/30'
  if (percentage > 0) return 'bg-red-500/30'
  return 'bg-muted/30'
}

export function CoverageHeatmap({ coverageData }: CoverageHeatmapProps) {
  // Default to zeros (no processing yet)
  const data = useMemo(() => {
    if (coverageData) return coverageData
    const empty: Record<string, Record<string, number>> = {}
    DATASETS.forEach((ds) => {
      empty[ds] = {}
      DOC_TYPES.forEach((dt) => {
        empty[ds][dt] = 0
      })
    })
    return empty
  }, [coverageData])

  // Find the most under-researched areas
  const blindSpots = useMemo(() => {
    const spots: Array<{ dataset: string; docType: string; coverage: number }> = []
    DATASETS.forEach((ds) => {
      DOC_TYPES.forEach((dt) => {
        const pct = data[ds]?.[dt] ?? 0
        spots.push({ dataset: ds, docType: dt, coverage: pct })
      })
    })
    return spots.sort((a, b) => a.coverage - b.coverage).slice(0, 5)
  }, [data])

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Corpus Coverage Heatmap</CardTitle>
        <p className="text-sm text-muted-foreground">
          Shows which areas of the corpus have been reviewed by the community. Red/orange areas need attention.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-muted-foreground">Dataset</th>
                  {DOC_TYPES.map((dt) => (
                    <th key={dt} className="p-2 text-center text-muted-foreground">
                      {dt}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATASETS.map((ds) => (
                  <tr key={ds}>
                    <td className="whitespace-nowrap p-2 font-medium">{ds}</td>
                    {DOC_TYPES.map((dt) => {
                      const pct = data[ds]?.[dt] ?? 0
                      return (
                        <td key={dt} className="p-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/search?dataset=${encodeURIComponent(ds)}&type=${encodeURIComponent(dt)}`}
                                className={`flex h-8 items-center justify-center rounded ${getCellColor(pct)} transition-colors hover:ring-2 hover:ring-primary`}
                              >
                                <span className="text-xs font-medium">
                                  {pct > 0 ? `${pct}%` : ''}
                                </span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{ds}</p>
                              <p className="text-xs">{dt}: {pct}% reviewed</p>
                              <p className="text-xs text-muted-foreground">Click to browse</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Coverage:</span>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-muted/30" /> 0%
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-red-500/30" /> 1-19%
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-amber-500/30" /> 20-39%
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-amber-500/50" /> 40-59%
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-600/50" /> 60-79%
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-600/80" /> 80%+
          </div>
        </div>

        {/* Blind spots callout */}
        <div className="mt-6 rounded-lg border border-amber-600/30 bg-amber-950/10 p-4">
          <h4 className="mb-2 text-sm font-semibold text-amber-400">Most Under-Researched Areas</h4>
          {blindSpots.every((s) => s.coverage === 0) ? (
            <p className="text-xs text-muted-foreground">
              No documents have been community-reviewed yet. Start by claiming a document to review.
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {blindSpots.map((spot, i) => (
                <li key={i}>
                  <Link
                    href={`/search?dataset=${encodeURIComponent(spot.dataset)}&type=${encodeURIComponent(spot.docType)}`}
                    className="text-amber-400 hover:underline"
                  >
                    {spot.dataset} / {spot.docType}
                  </Link>
                  {' '}&mdash; {spot.coverage}% reviewed
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### ResearchActivityMap — `components/stats/ResearchActivityMap.tsx`

```tsx
// components/stats/ResearchActivityMap.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ActivityData {
  most_active_entities: Array<{ name: string; views: number; annotations: number }>
  most_active_datasets: Array<{ name: string; annotations: number }>
  under_explored: Array<{ name: string; reason: string }>
}

interface ResearchActivityMapProps {
  data?: ActivityData
}

export function ResearchActivityMap({ data }: ResearchActivityMapProps) {
  const [period, setPeriod] = useState<'7d' | '30d'>('7d')

  const defaultData: ActivityData = {
    most_active_entities: [],
    most_active_datasets: [],
    under_explored: [],
  }

  const activity = data ?? defaultData

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Research Activity</CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
            <TabsList>
              <TabsTrigger value="7d">7 days</TabsTrigger>
              <TabsTrigger value="30d">30 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-sm text-muted-foreground">
          Where researchers are focusing their attention.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Most active entities */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Most Researched Entities</h4>
          {activity.most_active_entities.length > 0 ? (
            <div className="space-y-2">
              {activity.most_active_entities.map((entity) => (
                <div key={entity.name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <span className="text-sm">{entity.name}</span>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{entity.views} views</span>
                    <span>{entity.annotations} annotations</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Entity research activity will appear once community members begin annotating documents.
            </p>
          )}
        </div>

        {/* Most active datasets */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Most Active Datasets</h4>
          {activity.most_active_datasets.length > 0 ? (
            <div className="space-y-2">
              {activity.most_active_datasets.map((dataset) => (
                <div key={dataset.name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <span className="text-sm">{dataset.name}</span>
                  <span className="text-xs text-muted-foreground">{dataset.annotations} annotations</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Dataset activity will appear once community research begins.
            </p>
          )}
        </div>

        {/* Under-explored callout */}
        <div className="rounded-lg border border-amber-600/30 bg-amber-950/10 p-4">
          <h4 className="mb-2 text-sm font-semibold text-amber-400">Under-Explored Sections</h4>
          {activity.under_explored.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {activity.under_explored.map((item, i) => (
                <li key={i}>
                  <span className="font-medium text-amber-400">{item.name}</span>
                  {' '}&mdash; {item.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Under-explored sections will be highlighted once enough research activity exists for comparison.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### CompletenessTracker — `components/stats/CompletenessTracker.tsx`

```tsx
// components/stats/CompletenessTracker.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface CompletenessData {
  ocr_verified: number
  entities_confirmed: number
  dates_validated: number
  redactions_attempted: number
  cross_references_checked: number
  total_documents: number
}

interface CompletenessTrackerProps {
  data?: CompletenessData
}

const REVIEW_CATEGORIES = [
  { key: 'ocr_verified', label: 'OCR Verified by Community', color: 'bg-blue-500' },
  { key: 'entities_confirmed', label: 'Entities Confirmed', color: 'bg-purple-500' },
  { key: 'dates_validated', label: 'Dates Validated', color: 'bg-green-500' },
  { key: 'redactions_attempted', label: 'Redactions Attempted', color: 'bg-amber-500' },
  { key: 'cross_references_checked', label: 'Cross-References Checked', color: 'bg-cyan-500' },
] as const

export function CompletenessTracker({ data }: CompletenessTrackerProps) {
  const defaults: CompletenessData = {
    ocr_verified: 0,
    entities_confirmed: 0,
    dates_validated: 0,
    redactions_attempted: 0,
    cross_references_checked: 0,
    total_documents: 0,
  }

  const d = data ?? defaults
  const total = d.total_documents || 1 // avoid division by zero

  // Average verification across all categories
  const avgVerification = Math.round(
    (d.ocr_verified + d.entities_confirmed + d.dates_validated + d.redactions_attempted + d.cross_references_checked) /
    (5 * total) * 100
  )

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Document Completeness</CardTitle>
        <p className="text-sm text-muted-foreground">
          How many documents have been verified by the community across five review categories.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall verification */}
        <div className="rounded-lg border border-border bg-background p-4 text-center">
          <div className="text-3xl font-bold text-primary">{avgVerification}%</div>
          <p className="text-sm text-muted-foreground">Overall Community Verification</p>
        </div>

        {/* Per-category progress */}
        <div className="space-y-4">
          {REVIEW_CATEGORIES.map(({ key, label, color }) => {
            const count = d[key]
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {count.toLocaleString()} / {total.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <Link href="/search?needs_review=true">
          <Button variant="outline" className="w-full">
            Claim a Document to Review
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
```

#### NeedsEyesFeed — `components/stats/NeedsEyesFeed.tsx`

```tsx
// components/stats/NeedsEyesFeed.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

interface NeedsEyesDocument {
  id: string
  filename: string
  dataset_name: string | null
  entity_count: number
  redaction_count: number
  review_count: number
  priority_score: number
  difficulty_estimate: 'easy' | 'medium' | 'hard'
}

export function NeedsEyesFeed() {
  const [datasetFilter, setDatasetFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')

  // Will fetch from API in Phase 4 — ranked by: entity_density * redaction_count * (1 / review_count)
  const { data } = useQuery<NeedsEyesDocument[]>({
    queryKey: ['stats', 'needs-eyes', datasetFilter, difficultyFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (datasetFilter !== 'all') params.set('dataset', datasetFilter)
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter)
      return fetch(`/api/stats/needs-eyes?${params.toString()}`).then((r) => r.json())
    },
    enabled: false, // Disabled until API route exists
  })

  const documents = data ?? []

  const difficultyColor = (d: string) => {
    switch (d) {
      case 'easy': return 'border-green-500/30 text-green-400'
      case 'medium': return 'border-amber-500/30 text-amber-400'
      case 'hard': return 'border-red-500/30 text-red-400'
      default: return ''
    }
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Needs Eyes</CardTitle>
        <p className="text-sm text-muted-foreground">
          High-priority documents ranked by entity density, redaction count, and low review count.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Select value={datasetFilter} onValueChange={setDatasetFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Dataset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Datasets</SelectItem>
              <SelectItem value="sdny">SDNY Court Docs</SelectItem>
              <SelectItem value="fbi">FBI Files</SelectItem>
              <SelectItem value="financial">Financial Records</SelectItem>
              <SelectItem value="flights">Flight Logs</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <Link
                        href={`/document/${doc.id}`}
                        className="text-sm font-medium text-blue-400 hover:underline"
                      >
                        {doc.filename}
                      </Link>
                      {doc.dataset_name && (
                        <p className="text-xs text-muted-foreground">{doc.dataset_name}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={difficultyColor(doc.difficulty_estimate)}>
                      {doc.difficulty_estimate}
                    </Badge>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    This document has {doc.redaction_count} redactions and {doc.entity_count} entity
                    mentions but has {doc.review_count === 0 ? 'not been reviewed yet' : `only ${doc.review_count} review(s)`}.
                  </p>
                  <Link href={`/document/${doc.id}?claim=true`}>
                    <Button variant="outline" size="sm">
                      Claim for Review
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Documents needing review will appear here once the corpus is processed and priority scores are calculated.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### Step 8: Build the Stats Page

File: `app/(public)/stats/page.tsx`

```tsx
// app/(public)/stats/page.tsx
import { ProcessingProgress } from '@/components/stats/ProcessingProgress'
import { CorpusStats } from '@/components/stats/CorpusStats'
import { FundingProgress } from '@/components/stats/FundingProgress'
import { CoverageHeatmap } from '@/components/stats/CoverageHeatmap'
import { ResearchActivityMap } from '@/components/stats/ResearchActivityMap'
import { CompletenessTracker } from '@/components/stats/CompletenessTracker'
import { NeedsEyesFeed } from '@/components/stats/NeedsEyesFeed'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Corpus Statistics — Epstein Files',
  description: 'Processing progress, corpus statistics, community contributions, and coverage analysis for the Epstein document archive.',
}

export default function StatsPage() {
  // Will fetch from corpus_stats materialized view in Phase 4
  // For now, all components render with defaults (zeros)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Corpus Statistics</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        Real-time progress on processing, community verification, and research coverage.
      </p>

      {/* Processing progress + Funding sidebar */}
      <section className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProcessingProgress />
        </div>
        <div>
          <FundingProgress />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Corpus stats (numbers) */}
      <section className="mb-8">
        <h2 className="mb-6 text-2xl font-bold">Corpus Overview</h2>
        <CorpusStats />
      </section>

      <Separator className="my-8" />

      {/* Coverage heatmap */}
      <section className="mb-8">
        <CoverageHeatmap />
      </section>

      <Separator className="my-8" />

      {/* Research activity + Document completeness side by side */}
      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <ResearchActivityMap />
        <CompletenessTracker />
      </section>

      <Separator className="my-8" />

      {/* Needs Eyes feed */}
      <section className="mb-8">
        <NeedsEyesFeed />
      </section>
    </div>
  )
}
```

### Step 9: Build the Prosecutor Dashboard

File: `app/(public)/prosecutors/page.tsx`

```tsx
// app/(public)/prosecutors/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const metadata = {
  title: 'For Prosecutors & Legal Professionals — Epstein Files',
  description: 'Prosecutor-ready evidence summaries, entity dossiers, and exportable evidence packages from the Epstein document archive.',
}

export default function ProsecutorsPage() {
  // Will fetch from Supabase in Phase 4
  // Mock structure for the page layout
  const topEntities: Array<{
    name: string
    entity_type: string
    citation_count: number
    document_count: number
    relationship_strength: number
  }> = []

  const flaggedDocuments: Array<{
    id: string
    filename: string
    criminal_indicator_score: number
    categories: string[]
  }> = []

  const criminalCategories: Array<{
    category: string
    document_count: number
    description: string
  }> = []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <section className="mb-8">
        <Badge variant="outline" className="mb-4">For Law Enforcement & Legal Professionals</Badge>
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          Prosecutor Dashboard
        </h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          AI-extracted evidence summaries from the Epstein document corpus. All findings are
          derived from publicly available DOJ documents and are cross-referenced for accuracy.
          This dashboard is designed to surface actionable intelligence for legal professionals.
        </p>
      </section>

      <Separator className="my-8" />

      {/* Per-entity evidence summaries */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Entity Evidence Summaries</h2>
        <p className="mb-6 text-muted-foreground">
          Entities ranked by number of document citations and relationship strength.
        </p>
        {topEntities.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Citations</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Relationship Strength</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEntities.map((entity) => (
                  <TableRow key={entity.name}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entity.entity_type}</Badge>
                    </TableCell>
                    <TableCell>{entity.citation_count}</TableCell>
                    <TableCell>{entity.document_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${entity.relationship_strength}%` }}
                          />
                        </div>
                        <span className="text-xs">{entity.relationship_strength}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">View Dossier</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card className="border-border bg-surface">
            <CardContent className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Entity evidence summaries will populate as documents are processed and entities are extracted.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      {/* Criminal activity indicators */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Criminal Activity Indicators</h2>
        <p className="mb-6 text-muted-foreground">
          Documents flagged by AI for potential criminal activity indicators, organized by category.
        </p>
        {criminalCategories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {criminalCategories.map((cat) => (
              <Card key={cat.category} className="border-border bg-surface">
                <CardContent className="pt-6">
                  <h3 className="mb-1 font-semibold">{cat.category}</h3>
                  <p className="mb-2 text-xs text-muted-foreground">{cat.description}</p>
                  <p className="text-2xl font-bold text-accent">{cat.document_count}</p>
                  <p className="text-xs text-muted-foreground">flagged documents</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border bg-surface">
            <CardContent className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Criminal activity categories will be populated as AI analysis progresses.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      {/* Most-flagged documents */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Most-Flagged Documents</h2>
        <p className="mb-6 text-muted-foreground">
          Documents with the highest criminal indicator scores, ranked by severity.
        </p>
        {flaggedDocuments.length > 0 ? (
          <div className="space-y-3">
            {flaggedDocuments.map((doc) => (
              <Card key={doc.id} className="border-border bg-surface">
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="font-medium">{doc.filename}</p>
                    <div className="mt-1 flex gap-2">
                      {doc.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-400">{doc.criminal_indicator_score}</div>
                    <p className="text-xs text-muted-foreground">indicator score</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border bg-surface">
            <CardContent className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Flagged documents will appear once criminal indicator scoring is complete.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      {/* Export + Verification */}
      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle>Export Full Evidence Package</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a comprehensive evidence package including entity dossiers, document citations,
              relationship maps, and timeline reconstructions. Formatted for legal proceedings.
            </p>
            <Button disabled>
              Export Evidence Package (PDF)
            </Button>
            <p className="text-xs text-muted-foreground">
              Export will be available once sufficient evidence has been processed and verified.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle>Verification & Chain of Custody</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              All documents in this archive are sourced from official U.S. Department of Justice releases.
              AI-extracted entities and relationships should be independently verified before use in legal proceedings.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#10003;</span>
                <span>Source documents are from official DOJ releases</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400">&#10003;</span>
                <span>OCR text is verified by community contributors</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-400">&#9888;</span>
                <span>AI-extracted entities require independent verification</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-400">&#9888;</span>
                <span>Crowdsourced redaction solutions are consensus-based</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Contact */}
      <section className="mb-8">
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 text-center">
            <h3 className="mb-2 text-lg font-semibold">Legal Inquiries</h3>
            <p className="text-sm text-muted-foreground">
              For law enforcement or legal professionals seeking to verify findings or request
              additional analysis, please contact us through the appropriate legal channels.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Email: <span className="text-foreground">legal@epsteinfiles.org</span> (placeholder)
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
```

### Step 10: Update existing pages with funding integration

#### Update Home Page — `app/page.tsx`

Add the compact funding bar below the hero section. Find the `{/* Stats Ticker */}` section and add this block before it:

```tsx
// Add this import at the top of app/page.tsx
import { DonationCTA } from '@/components/funding/DonationCTA'

// Add this section between the Hero and Stats Ticker sections:
{/* Compact Funding Bar */}
<section className="mx-auto max-w-4xl px-4">
  <DonationCTA variant="bar" />
</section>
```

The bar shows: "$X of $16K raised -- Your $5 processes 2,400 pages [Donate]"

#### Update SearchResults — `components/search/SearchResults.tsx`

Add a funding CTA in the empty/no-results state. Locate the empty state section and add:

```tsx
// Add this import at the top of SearchResults.tsx
import { DonationCTA } from '@/components/funding/DonationCTA'

// In the empty state / no results section, add after the EmptyState component:
<div className="mt-6">
  <DonationCTA variant="card" />
</div>

// The card variant shows the message:
// "This search would find results across 3.5M pages. We've processed X so far. [Fund the rest]"
```

#### Update Header — `components/layout/Header.tsx`

Add a dismissible funding banner at the top of the header:

```tsx
// Add this import at the top of Header.tsx
import { DonationCTA } from '@/components/funding/DonationCTA'

// Add as the first child of the header's outermost container:
<DonationCTA variant="banner" />

// The banner shows: "XX% of documents processed. Help unlock the rest. [Donate] [Dismiss]"
// Dismissing stores preference in localStorage (handled by the component)
```

#### Update DocumentViewer — `components/document/DocumentViewer.tsx`

Add a funding footer at the bottom of the document viewer:

```tsx
// Add this import at the top of DocumentViewer.tsx
import { DonationCTA } from '@/components/funding/DonationCTA'

// Add after the last chunk in the document viewer:
<div className="mt-8 border-t border-border pt-6">
  <p className="mb-4 text-center text-sm text-muted-foreground">
    This document was made searchable thanks to community funding.
  </p>
  <DonationCTA variant="bar" />
</div>
```

### Step 11: Verify build

```bash
pnpm build
```

Fix any TypeScript errors. The most common will be import path issues or missing shadcn/ui components.

---

## Gotchas

1. **GoFundMe widget embed:** Use a placeholder `<iframe>` with `src="about:blank"`. The comment in the code explains how to get the real widget URL from GoFundMe's share/embed feature. Do not hardcode a fake URL.

2. **Cost model consistency:** The $2.10 per 1,000 pages formula must be consistent across all components: the impact calculator, tier cards, spend log, and funding progress. The constant `COST_PER_PAGE = 2.10 / 1000` should be the single source of truth. If the cost model changes, update the constant in the API route — all components derive from it.

3. **Spend log entries come from Phase 6:** The spend transparency log only *displays* entries. The batch processing pipeline (Phase 6) *creates* them in the `processing_spend_log` table. This phase must handle the case where the table is empty gracefully.

4. **Processing live feed polling:** Use polling (every 10 seconds) for v1. The `enabled: false` flag keeps it from firing until the API route exists. In v2, replace with Server-Sent Events (SSE) for true real-time updates.

5. **Stats from materialized view:** The `corpus_stats` materialized view needs periodic refresh (Phase 6 batch scripts handle this). Stats may be slightly stale. Show the `last_updated` timestamp when available.

6. **Animated numbers on load:** The `AnimatedNumber` component uses `setInterval` for the counting animation. Make sure the cleanup function clears the interval to avoid memory leaks. The animation only runs once when the component mounts with data.

7. **DonationCTA banner localStorage:** The dismissible banner stores `funding-banner-dismissed` in localStorage. The initial state is `dismissed = true` (hidden) to prevent flash-of-content, then `useEffect` reads localStorage to determine the real state. This prevents hydration mismatches.

8. **Coverage heatmap click targets:** Each cell in the heatmap links to a filtered search. The URL format is `/search?dataset=X&type=Y`. Make sure the search page can parse these query params (Phase 4 search route must support dataset and type filters).

9. **Prosecutor dashboard is read-only:** The prosecutor page displays data but does not allow editing. The "Export Evidence Package" button is disabled until sufficient data exists. The verification section includes appropriate disclaimers about AI-extracted data.

10. **NeedsEyesFeed priority scoring:** Documents are ranked by `entity_density * redaction_count * (1 / (review_count + 1))`. The `+1` prevents division by zero. This ranking surfaces high-value, under-reviewed documents. The API route for this does not exist yet (`enabled: false`).

11. **Mobile responsiveness:** The coverage heatmap table is horizontally scrollable on mobile. The tier cards grid collapses from 5 columns to 2. The spend log and stats grids stack vertically. Test at 320px width.

---

## Files to Create

```
app/(public)/
├── funding/
│   └── page.tsx
├── stats/
│   └── page.tsx
└── prosecutors/
    └── page.tsx
components/funding/
├── FundingTracker.tsx
├── DonationImpactCalc.tsx
├── DonationImpactTiers.tsx
├── SpendTransparencyLog.tsx
├── ProcessingLiveFeed.tsx
└── DonationCTA.tsx
components/stats/
├── ProcessingProgress.tsx
├── CorpusStats.tsx
├── FundingProgress.tsx
├── CoverageHeatmap.tsx
├── ResearchActivityMap.tsx
├── CompletenessTracker.tsx
└── NeedsEyesFeed.tsx
app/api/funding/
├── status/
│   └── route.ts
├── impact/
│   └── route.ts
└── spend-log/
    └── route.ts
lib/hooks/
└── useFunding.ts
```

## Updates to Existing Files

```
app/page.tsx                              — Add compact funding bar (DonationCTA variant="bar")
components/search/SearchResults.tsx       — Add funding CTA in empty state (DonationCTA variant="card")
components/layout/Header.tsx              — Add dismissible funding banner (DonationCTA variant="banner")
components/document/DocumentViewer.tsx    — Add funding footer (DonationCTA variant="bar")
```

## Acceptance Criteria

1. Funding page renders with $0/$16,000 progress bar and animated number counter
2. Impact calculator slider is interactive ($1-$1,000) with logarithmic scale and live output
3. All 10 donation impact tier cards display correctly in responsive grid (2 cols mobile, 5 cols desktop)
4. Spend transparency log shows empty state ("No processing spend yet") with service filter dropdown
5. Processing live feed shows "Pipeline Idle" badge state
6. Funding status API returns `{ raised, goal, percentage, donor_count, last_updated }`
7. Impact API calculates correct pages for a given amount (using $2.10/1K pages formula)
8. Spend log API returns paginated results with service/date filters
9. Stats page shows all corpus stats (zeros initially) with animated number counters
10. Per-dataset progress bars display for all 12 datasets with color coding (green/amber/gray)
11. Funding CTA bar appears on home page below hero section
12. Funding CTA card appears in search results empty state
13. Dismissible funding banner in header works (dismissed state persists in localStorage)
14. Funding footer appears at bottom of document viewer
15. All components are mobile responsive (tested at 320px-768px)
16. Coverage heatmap shows dataset x doc type matrix with color legend and blind spot highlighting
17. Research activity map shows 7-day/30-day toggle with empty states for entities and datasets
18. Document completeness tracker shows verification progress across 5 categories
19. "Needs Eyes" feed surfaces high-priority unreviewed documents with difficulty badges
20. Prosecutor dashboard shows entity evidence table, criminal indicators, and flagged documents (all with empty states)
21. Prosecutor dashboard includes export button (disabled), verification notes, and contact info
22. GoFundMe iframe placeholder renders with instructions for getting the real widget URL
23. "Where Your Money Goes" section shows 4 spend category cards with percentages
24. `pnpm build` succeeds with zero errors

## Design Notes

- Funding progress bar: Use `bg-primary` fill with a `bg-primary/20 blur-md` glow effect behind it
- Animated numbers: Count up from 0 over 1.2-1.5 seconds on mount, use `tabular-nums` for stable width
- Impact tier cards: Highlight the $5 and $25 tiers slightly (most common donation amounts)
- Coverage heatmap: Green = well-reviewed, amber = in progress, red = barely touched, gray = not started
- Spend log entries: Each entry shows date, service, amount, and results (pages/entities/redactions)
- Prosecutor dashboard: Professional, serious tone — no playful copy. Legal brief formatting
- NeedsEyes difficulty badges: Easy = green, Medium = amber, Hard = red
