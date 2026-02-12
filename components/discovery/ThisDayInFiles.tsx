// components/discovery/ThisDayInFiles.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTodayInHistory } from '@/lib/hooks/useDiscoveries'

export function ThisDayInFiles() {
  const { documents, isLoading } = useTodayInHistory()
  const today = new Date()
  const monthDay = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-lg">This Day in the Files</CardTitle>
        <p className="text-sm text-muted-foreground">{monthDay}</p>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc: { id: string; filename: string; date: string }) => (
              <div key={doc.id} className="text-sm">
                <p className="font-medium">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">{doc.date}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Documents dated {monthDay} will appear here once the corpus is processed.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
