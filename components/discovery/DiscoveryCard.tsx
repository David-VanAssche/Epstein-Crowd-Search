// components/discovery/DiscoveryCard.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Discovery {
  id: string
  type: 'redaction_solved' | 'entity_connection' | 'pattern_found'
  title: string
  description: string
  user_display_name: string | null
  cascade_count: number
  created_at: string
}

interface DiscoveryCardProps {
  discovery: Discovery
}

const TYPE_LABELS = {
  redaction_solved: 'Redaction Solved',
  entity_connection: 'Connection Found',
  pattern_found: 'Pattern Detected',
}

export function DiscoveryCard({ discovery }: DiscoveryCardProps) {
  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline">{TYPE_LABELS[discovery.type]}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(discovery.created_at).toLocaleDateString()}
          </span>
        </div>
        <h3 className="mb-1 font-semibold">{discovery.title}</h3>
        <p className="text-sm text-muted-foreground">{discovery.description}</p>
        {discovery.user_display_name && (
          <p className="mt-2 text-xs text-muted-foreground">
            Discovered by @{discovery.user_display_name}
            {discovery.cascade_count > 0 && ` — Cascaded to ${discovery.cascade_count} matches`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
