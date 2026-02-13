// components/funding/SpendTransparencyLog.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSpendLog } from '@/lib/hooks/useFunding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const SERVICE_TYPES = [
  { value: 'all', label: 'All Services' },
  { value: 'openai', label: 'OpenAI (GPT-4o)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'ocr', label: 'OCR Processing' },
  { value: 'embedding', label: 'Embeddings' },
  { value: 'whisper', label: 'Audio Transcription' },
  { value: 'supabase', label: 'Supabase Storage' },
]

export function SpendTransparencyLog() {
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  // Reset page when filter changes
  useEffect(() => { setPage(1) }, [serviceFilter])

  const { data } = useSpendLog({
    page,
    limit: 20,
    service: serviceFilter === 'all' ? undefined : serviceFilter,
  })

  const entries = data?.entries ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Every Dollar Accounted For</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete transparency log of all processing spend.
            </p>
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by service" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()} &middot;{' '}
                        {entry.service}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-accent">
                      ${(entry.amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{(entry.pages_processed ?? 0).toLocaleString()} pages</span>
                    <span>{(entry.entities_extracted ?? 0).toLocaleString()} entities</span>
                    <span>{(entry.redactions_detected ?? 0).toLocaleString()} redactions</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No processing spend yet. Spend entries will appear here as documents are processed.
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
