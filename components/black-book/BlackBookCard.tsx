// components/black-book/BlackBookCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, MapPin, Users } from 'lucide-react'
import { RiskScoreBadge } from '@/components/entity/RiskScoreBadge'
import type { BlackBookEntry } from '@/types/black-book'

interface BlackBookCardProps {
  entry: BlackBookEntry
}

export function BlackBookCard({ entry }: BlackBookCardProps) {
  const content = (
    <Card className="border-border bg-surface transition-colors hover:bg-surface-elevated">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{entry.name}</h3>
          <div className="flex shrink-0 items-center gap-1">
            {entry.linked_entity && entry.linked_entity.risk_score > 0 && (
              <RiskScoreBadge score={entry.linked_entity.risk_score} />
            )}
            {entry.linked_entity && (
              <Badge variant="outline" className="text-xs">
                Linked
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {entry.phones.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Phone className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="break-all">{entry.phones.join(', ')}</span>
            </div>
          )}
          {entry.addresses.length > 0 && (
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{entry.addresses[0]}{entry.addresses.length > 1 && ` +${entry.addresses.length - 1} more`}</span>
            </div>
          )}
          {entry.relationships.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{entry.relationships.join(', ')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (entry.linked_entity) {
    return <Link href={`/entity/${entry.linked_entity.id}`}>{content}</Link>
  }

  return content
}
