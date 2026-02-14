// components/entity/RiskScoreBadge.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ShieldAlert } from 'lucide-react'
import type { RiskFactors } from '@/types/entities'

interface RiskScoreBadgeProps {
  score: number
  factors?: RiskFactors | null
  size?: 'sm' | 'md'
}

function getRiskTier(score: number) {
  if (score >= 4.0) return { label: 'Critical', className: 'bg-red-500/20 text-red-400 hover:bg-red-500/30' }
  if (score >= 3.0) return { label: 'High', className: 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' }
  if (score >= 2.0) return { label: 'Significant', className: 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' }
  if (score >= 1.0) return { label: 'Noteworthy', className: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' }
  if (score > 0) return { label: 'Peripheral', className: 'bg-muted text-muted-foreground' }
  return null
}

export function RiskScoreBadge({ score, factors, size = 'sm' }: RiskScoreBadgeProps) {
  const tier = getRiskTier(score)
  if (!tier) return null

  const badge = (
    <Badge
      variant="destructive"
      className={`gap-1 ${tier.className} ${size === 'sm' ? 'text-xs' : ''}`}
    >
      <ShieldAlert className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {tier.label} ({score.toFixed(1)})
    </Badge>
  )

  if (!factors) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-sm space-y-2 p-3" side="bottom">
          <p className="text-xs font-semibold">Risk Score Breakdown</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Evidence score</span>
              <span className="font-mono">{factors.evidence_score?.toFixed(2) ?? '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span>Relationship score</span>
              <span className="font-mono">{factors.relationship_score?.toFixed(2) ?? '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span>Indicator score</span>
              <span className="font-mono">{factors.indicator_score?.toFixed(2) ?? '0.00'}</span>
            </div>
          </div>
          {factors.top_documents && factors.top_documents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Top documents:</p>
              {factors.top_documents.slice(0, 3).map((doc) => (
                <p key={doc.id} className="truncate text-xs text-muted-foreground">
                  {doc.filename} ({doc.weight.toFixed(2)})
                </p>
              ))}
            </div>
          )}
          {factors.contributing_relationships && factors.contributing_relationships.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Relationships:</p>
              {factors.contributing_relationships.slice(0, 3).map((rel) => (
                <p key={`${rel.entity_name}-${rel.type}`} className="truncate text-xs text-muted-foreground">
                  {rel.type}: {rel.entity_name} ({rel.weight.toFixed(1)})
                </p>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
