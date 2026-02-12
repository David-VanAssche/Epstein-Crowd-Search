// app/(public)/sources/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchApi } from '@/lib/api/client'

const STATUS_COLORS: Record<string, string> = {
  ingested: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  pending: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  unavailable: 'bg-zinc-700/20 text-zinc-500 border-zinc-700/30',
}

interface DataSource {
  id: string
  name: string
  source_type: string
  url: string | null
  data_type: string
  status: string
  expected_count: number | null
  ingested_count: number
}

export default function SourcesPage() {
  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: () => fetchApi<DataSource[]>('/api/sources'),
    staleTime: 60_000,
  })

  const sourceList = sources ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Data Sources</h1>
      <p className="mb-8 text-muted-foreground">
        Status of all 24 community and official data sources. Community-processed data
        (OCR text, embeddings, entities) is ingested for free before spending on AI processing.
      </p>

      {isLoading ? (
        <LoadingState variant="list" count={8} />
      ) : sourceList.length > 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ingested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceList.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                          {source.name}
                        </a>
                      ) : (
                        source.name
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{source.source_type}</TableCell>
                    <TableCell className="text-muted-foreground">{source.data_type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[source.status] || ''}>
                        {source.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {source.ingested_count.toLocaleString()}
                      {source.expected_count ? ` / ${source.expected_count.toLocaleString()}` : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          variant="community-data"
          title="Data Sources Loading"
          description="Source status will appear here once the data ingestion pipeline begins. 24 community and official sources have been identified."
        />
      )}
    </div>
  )
}
