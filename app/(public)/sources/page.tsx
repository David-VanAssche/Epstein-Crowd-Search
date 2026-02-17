// app/(public)/sources/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchApi } from '@/lib/api/client'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  government: 'Government',
  court: 'Court Filing',
  law_enforcement: 'Law Enforcement',
  public_record: 'Public Record',
  media: 'Media',
}

interface DataSource {
  id: string
  name: string
  source_type: string
  url: string | null
  description: string | null
  data_type: string
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
      <h1 className="mb-2 text-3xl font-bold">Document Sources</h1>
      <p className="mb-8 text-muted-foreground">
        Authoritative sources of documents in the archive. All materials originate from
        government releases, court filings, law enforcement records, and public record requests.
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
                  <TableHead className="text-right">Pages / Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceList.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div className="font-medium">
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                            {source.name}
                          </a>
                        ) : (
                          source.name
                        )}
                      </div>
                      {source.description && (
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {source.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {SOURCE_TYPE_LABELS[source.source_type] || source.source_type}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {source.expected_count
                        ? source.expected_count.toLocaleString()
                        : source.ingested_count.toLocaleString()}
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
          title="Document Sources Loading"
          description="Source information will appear here once the data ingestion pipeline begins."
        />
      )}
    </div>
  )
}
