// components/redaction/SolvableRedactionCard.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProposalForm } from './ProposalForm'
import type { SolvableRedaction } from '@/types/redaction'

interface SolvableRedactionCardProps {
  redaction: SolvableRedaction
}

export function SolvableRedactionCard({ redaction }: SolvableRedactionCardProps) {
  const [showPropose, setShowPropose] = useState(false)

  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/document/${redaction.document_id}${redaction.page_number ? `#page-${redaction.page_number}` : ''}`}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            {redaction.document_filename}
            {redaction.page_number ? `, p.${redaction.page_number}` : ''}
          </Link>
          <div className="flex gap-1.5">
            {redaction.redaction_type && (
              <Badge variant="outline" className="text-xs">{redaction.redaction_type}</Badge>
            )}
            {redaction.potential_cascade_count > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Zap className="h-3 w-3" />
                {redaction.potential_cascade_count} cascade{redaction.potential_cascade_count !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Context */}
        <div className="rounded-md bg-background p-3 font-mono text-sm">
          {redaction.sentence_template ? (
            <p>
              {redaction.sentence_template.replace(
                /\[REDACTED\]/g,
                `[████${redaction.char_length_estimate ? ` ~${redaction.char_length_estimate} chars` : ''}████]`
              )}
            </p>
          ) : (
            <p className="text-muted-foreground">
              &ldquo;...{redaction.surrounding_text}...&rdquo;
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {redaction.proposal_count} proposal{redaction.proposal_count !== 1 ? 's' : ''}
            {redaction.top_proposal_confidence != null && (
              <> &middot; Top confidence: {(redaction.top_proposal_confidence * 100).toFixed(0)}%</>
            )}
          </span>
          <Button size="sm" variant="outline" onClick={() => setShowPropose(!showPropose)}>
            {showPropose ? 'Cancel' : 'Propose Solution'}
          </Button>
        </div>

        {showPropose && (
          <ProposalForm
            redactionId={redaction.redaction_id}
            onSuccess={() => setShowPropose(false)}
          />
        )}
      </CardContent>
    </Card>
  )
}
