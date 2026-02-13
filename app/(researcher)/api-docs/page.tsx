// app/(researcher)/api-docs/page.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/search', description: 'Full-text and semantic search across the corpus' },
  { method: 'GET', path: '/api/entity/:id', description: 'Entity profile with relationships and mentions' },
  { method: 'GET', path: '/api/entity/:id/connections', description: 'Entity relationship graph data' },
  { method: 'GET', path: '/api/graph/path', description: 'Shortest path between two entities' },
  { method: 'GET', path: '/api/timeline', description: 'Timeline events with filtering' },
  { method: 'GET', path: '/api/document/:id', description: 'Document metadata, chunks, and redactions' },
  { method: 'GET', path: '/api/export/entities', description: 'Bulk entity export (CSV/JSON)' },
  { method: 'GET', path: '/api/export/graph', description: 'Full graph export (GraphML/JSON)' },
]

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <Badge variant="outline" className="text-amber-400 border-amber-400/30">Coming Soon</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Programmatic access to the Epstein Archive data for researchers, journalists, and developers.
        </p>
      </div>

      <Card className="mb-8 border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm text-amber-400">
            API access requires the Researcher tier ($9/month) with API key authentication.
          </p>
          <p className="text-sm text-muted-foreground">
            Rate limits: 100 requests/minute for search, 1000 requests/minute for entity lookups.
            Bulk export endpoints are limited to 10 requests/hour.
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-xl font-bold">Available Endpoints</h2>
      <div className="space-y-3">
        {API_ENDPOINTS.map(({ method, path, description }) => (
          <Card key={path} className="border-border bg-surface">
            <CardContent className="flex items-center gap-4 py-4">
              <Badge
                variant="outline"
                className={method === 'GET' ? 'text-green-400 border-green-400/30' : 'text-blue-400 border-blue-400/30'}
              >
                {method}
              </Badge>
              <code className="text-sm font-mono text-primary">{path}</code>
              <span className="flex-1 text-sm text-muted-foreground">{description}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
