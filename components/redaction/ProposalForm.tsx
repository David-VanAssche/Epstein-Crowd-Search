// components/redaction/ProposalForm.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useSubmitProposal } from '@/lib/hooks/useRedaction'
import type { EvidenceType } from '@/types/redaction'

const EVIDENCE_TYPES: { value: EvidenceType; label: string }[] = [
  { value: 'cross_reference', label: 'Cross Reference' },
  { value: 'context_deduction', label: 'Context Deduction' },
  { value: 'document_comparison', label: 'Document Comparison' },
  { value: 'public_statement', label: 'Public Statement' },
  { value: 'official_release', label: 'Official Release' },
  { value: 'media_report', label: 'Media Report' },
  { value: 'other', label: 'Other' },
]

interface ProposalFormProps {
  redactionId: string
  onSuccess: () => void
}

export function ProposalForm({ redactionId, onSuccess }: ProposalFormProps) {
  const [proposedText, setProposedText] = useState('')
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('cross_reference')
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [evidenceSources, setEvidenceSources] = useState('')

  const { mutate: submit, isPending, error } = useSubmitProposal()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(
      {
        redactionId,
        proposedText,
        evidenceType,
        evidenceDescription,
        evidenceSources: evidenceSources.split('\n').filter(Boolean),
      },
      {
        onSuccess: () => {
          toast.success('Proposal submitted')
          onSuccess()
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border bg-background p-3">
      <div>
        <Label className="text-xs">Proposed Text</Label>
        <Input
          value={proposedText}
          onChange={(e) => setProposedText(e.target.value)}
          placeholder="What you think the redacted text says..."
          required
        />
      </div>

      <div>
        <Label className="text-xs">Evidence Type</Label>
        <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVIDENCE_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Evidence Description</Label>
        <Textarea
          value={evidenceDescription}
          onChange={(e) => setEvidenceDescription(e.target.value)}
          placeholder="Explain your reasoning and evidence..."
          rows={3}
          required
        />
      </div>

      <div>
        <Label className="text-xs">Sources (one per line)</Label>
        <Textarea
          value={evidenceSources}
          onChange={(e) => setEvidenceSources(e.target.value)}
          placeholder="URLs or document references..."
          rows={2}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive">
          {error instanceof Error ? error.message : 'Submission failed'}
        </p>
      )}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit Proposal'}
      </Button>
    </form>
  )
}
