// components/entity/EntityCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RiskScoreBadge } from './RiskScoreBadge'
import type { EntityType } from '@/types/entities'
import { ENTITY_TYPE_META } from '@/lib/constants/entity-types'

interface EntityCardProps {
  entity: {
    id: string
    name: string
    entity_type: EntityType
    mention_count: number
    document_count: number
    risk_score?: number
  }
}

export function EntityCard({ entity }: EntityCardProps) {
  return (
    <Link href={`/entity/${entity.id}`}>
      <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{entity.name}</h3>
            <div className="flex items-center gap-1.5">
              {entity.risk_score != null && entity.risk_score > 0 && (
                <RiskScoreBadge score={entity.risk_score} />
              )}
              <Badge variant="outline" className={ENTITY_TYPE_META[entity.entity_type]?.cssClass ?? ''}>
                {entity.entity_type}
              </Badge>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{entity.mention_count} mentions</span>
            <span>{entity.document_count} documents</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
