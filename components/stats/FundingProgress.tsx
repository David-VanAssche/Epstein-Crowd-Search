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
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/funding">
            View Full Funding Details
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
