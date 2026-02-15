// app/(public)/datasets/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchApi } from '@/lib/api/client'

interface Dataset {
  id: string
  dataset_number: number
  name: string
  description: string
  source_url: string | null
  page_count: number
  document_count: number
  image_count: number
  video_count: number
  processing_status: string
}

export default function DatasetsPage() {
  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => fetchApi<Dataset[]>('/api/datasets'),
    staleTime: 300_000,
  })

  const totalPages = datasets?.reduce((sum, ds) => sum + ds.page_count, 0) ?? 0
  const totalDocs = datasets?.reduce((sum, ds) => sum + ds.document_count, 0) ?? 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">DOJ Datasets</h1>
      <p className="mb-4 text-muted-foreground">
        The U.S. Department of Justice released the Epstein files across 12 datasets,
        totaling {totalPages.toLocaleString()} EFTA pages and {totalDocs.toLocaleString()} documents.
      </p>

      {isLoading ? (
        <LoadingState variant="list" count={6} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(datasets || []).map((ds) => {
            const statusColor = ds.processing_status === 'complete'
              ? 'default'
              : ds.processing_status === 'processing'
                ? 'secondary'
                : 'outline'

            return (
              <Card key={ds.id} className="border-border bg-surface">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{ds.name}</CardTitle>
                    <Badge variant={statusColor}>
                      {ds.processing_status === 'pending' ? 'Awaiting OCR' : ds.processing_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">{ds.description}</p>
                  <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>{ds.document_count.toLocaleString()} documents</span>
                    <span>{ds.page_count.toLocaleString()} pages</span>
                    {ds.image_count > 0 && <span>{ds.image_count.toLocaleString()} images</span>}
                    {ds.video_count > 0 && <span>{ds.video_count.toLocaleString()} videos</span>}
                  </div>
                  <Progress value={ds.processing_status === 'complete' ? 100 : ds.processing_status === 'processing' ? 50 : 0} className="h-2" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
