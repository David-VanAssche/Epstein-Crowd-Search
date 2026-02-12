// components/redaction/ProposalVoting.tsx
'use client'

import { ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRedactionProposals, useVoteOnProposal } from '@/lib/hooks/useRedaction'

interface ProposalVotingProps {
  redactionId: string
}

export function ProposalVoting({ redactionId }: ProposalVotingProps) {
  const { data: proposals, isLoading } = useRedactionProposals(redactionId)
  const { mutate: vote, isPending } = useVoteOnProposal()

  if (isLoading || !proposals || proposals.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">Proposals</h4>
      {proposals.map((proposal) => (
        <Card key={proposal.id} className="border-border bg-background">
          <CardContent className="pt-3 space-y-2">
            <p className="text-sm font-medium">&ldquo;{proposal.proposed_text}&rdquo;</p>
            <p className="text-xs text-muted-foreground">{proposal.evidence_description}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={isPending}
                onClick={() =>
                  vote({ redactionId, proposalId: proposal.id, voteType: 'upvote' })
                }
              >
                <ThumbsUp className="h-3 w-3" /> {proposal.upvotes}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={isPending}
                onClick={() =>
                  vote({ redactionId, proposalId: proposal.id, voteType: 'downvote' })
                }
              >
                <ThumbsDown className="h-3 w-3" /> {proposal.downvotes}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-green-400"
                disabled={isPending}
                onClick={() =>
                  vote({ redactionId, proposalId: proposal.id, voteType: 'corroborate' })
                }
              >
                <CheckCircle className="h-3 w-3" /> {proposal.corroborations}
              </Button>
              {proposal.composite_confidence != null && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {(proposal.composite_confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
