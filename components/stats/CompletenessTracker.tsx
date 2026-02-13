// components/stats/CompletenessTracker.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const total = d.total_documents

  const avgVerification = total > 0
    ? Math.round(
        (d.ocr_verified + d.entities_confirmed + d.dates_validated + d.redactions_attempted + d.cross_references_checked) /
        (5 * total) * 100
      )
    : 0

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Document Completeness</CardTitle>
        <p className="text-sm text-muted-foreground">
          How many documents have been verified by the community across five review categories.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-border bg-background p-4 text-center">
          <div className="text-3xl font-bold text-primary">{avgVerification}%</div>
          <p className="text-sm text-muted-foreground">Overall Community Verification</p>
        </div>

        <div className="space-y-4">
          {REVIEW_CATEGORIES.map(({ key, label, color }) => {
            const count = d[key]
            const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {count.toLocaleString()} / {(total || 0).toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={label}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <Button variant="outline" className="w-full" asChild>
          <Link href="/search?needs_review=true">
            Claim a Document to Review
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
