// components/entity/EntityCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EntityType } from '@/types/entities'

const TYPE_COLORS: Record<EntityType, string> = {
  person: 'text-blue-400 border-blue-400/30',
  organization: 'text-purple-400 border-purple-400/30',
  location: 'text-green-400 border-green-400/30',
  aircraft: 'text-amber-400 border-amber-400/30',
  vessel: 'text-cyan-400 border-cyan-400/30',
  property: 'text-orange-400 border-orange-400/30',
  account: 'text-pink-400 border-pink-400/30',
}

interface EntityCardProps {
  entity: {
    id: string
    name: string
    entity_type: EntityType
    mention_count: number
    document_count: number
  }
}

export function EntityCard({ entity }: EntityCardProps) {
  return (
    <Link href={`/entity/${entity.id}`}>
      <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{entity.name}</h3>
            <Badge variant="outline" className={TYPE_COLORS[entity.entity_type]}>
              {entity.entity_type}
            </Badge>
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
