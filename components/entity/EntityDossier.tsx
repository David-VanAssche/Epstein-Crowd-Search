// components/entity/EntityDossier.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Entity } from '@/types/entities'

interface EntityDossierProps {
  entity: Entity
}

export function EntityDossier({ entity }: EntityDossierProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Evidence Dossier: {entity.name}</h3>
        <Button variant="outline" size="sm" disabled>
          Export Dossier (PDF)
        </Button>
      </div>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Involvement Summary</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Auto-generated prosecutor-ready summary will appear once sufficient evidence is processed.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Key Documents</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Documents with strongest evidence connections.</p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Relationship Evidence</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Documented relationships and connections.</p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader><CardTitle className="text-sm">Timeline of Activities</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chronological record of documented activities.</p>
        </CardContent>
      </Card>
    </div>
  )
}
