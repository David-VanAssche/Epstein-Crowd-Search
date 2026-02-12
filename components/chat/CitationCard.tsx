// components/chat/CitationCard.tsx
'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { Citation } from '@/types/chat'

interface CitationCardProps {
  citation: Citation
  index: number
}

export function CitationCard({ citation, index }: CitationCardProps) {
  return (
    <Link
      href={`/document/${citation.document_id}${citation.page_number ? `#page-${citation.page_number}` : ''}`}
      className="flex items-start gap-2 rounded-md border border-border bg-surface p-2 text-xs hover:bg-surface-elevated transition-colors"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/20 text-primary text-[10px] font-bold">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          <FileText className="mr-1 inline h-3 w-3" />
          {citation.document_filename}
          {citation.page_number ? `, p.${citation.page_number}` : ''}
        </p>
        <p className="mt-0.5 line-clamp-2 text-muted-foreground">{citation.snippet}</p>
      </div>
    </Link>
  )
}
