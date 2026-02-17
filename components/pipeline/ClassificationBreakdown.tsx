'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CLASSIFICATION_TIERS } from '@/lib/pipeline/flow-config'

interface ClassificationBreakdownProps {
  breakdown: Record<string, number>
  totalClassified: number
}

export function ClassificationBreakdown({ breakdown, totalClassified }: ClassificationBreakdownProps) {
  return (
    <Accordion type="multiple" className="w-full">
      {CLASSIFICATION_TIERS.map((tier, i) => {
        const tierTotal = tier.types.reduce((sum, t) => sum + (breakdown[t] ?? 0), 0)
        const pct = totalClassified > 0 ? Math.round((tierTotal / totalClassified) * 100) : 0

        return (
          <AccordionItem key={tier.label} value={tier.label} className="border-border/50">
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              <div className="flex flex-1 items-center justify-between pr-2">
                <span>
                  Tier {i + 1}: {tier.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {tierTotal.toLocaleString()} <span className="text-xs">({pct}%)</span>
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2 pt-0">
              <div className="space-y-1 pl-4">
                {tier.types.map((type) => {
                  const count = breakdown[type] ?? 0
                  if (count === 0) return null
                  return (
                    <div key={type} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  )
                })}
                {tier.types.every((t) => (breakdown[t] ?? 0) === 0) && (
                  <span className="text-xs text-muted-foreground/60">No documents yet</span>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
