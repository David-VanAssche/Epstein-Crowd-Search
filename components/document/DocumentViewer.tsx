// components/document/DocumentViewer.tsx
'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { DonationCTA } from '@/components/funding/DonationCTA'

interface Chunk {
  id: string
  content: string
  page_number: number | null
  contextual_header: string | null
}

interface DocumentViewerProps {
  chunks: Chunk[]
}

export function DocumentViewer({ chunks }: DocumentViewerProps) {
  if (chunks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-[#1e1e2e] p-6 text-center text-muted-foreground">
        No content available yet.
      </div>
    )
  }

  return (
    <ScrollArea className="h-[70vh] rounded-lg border border-border bg-[#1e1e2e]">
      <div className="p-6">
        {chunks.map((chunk, i) => (
          <div key={chunk.id} id={`chunk-${i}`} className="mb-6">
            {chunk.page_number && (
              <div id={`page-${chunk.page_number}`} className="mb-2 text-xs text-muted-foreground">
                — Page {chunk.page_number} —
              </div>
            )}
            {chunk.contextual_header && (
              <div className="mb-1 text-xs italic text-muted-foreground">{chunk.contextual_header}</div>
            )}
            <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-primary">
              {chunk.content}
            </p>
          </div>
        ))}
        <div className="mt-8 border-t border-border pt-6">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            This document was made searchable thanks to community funding.
          </p>
          <DonationCTA variant="bar" />
        </div>
      </div>
    </ScrollArea>
  )
}
