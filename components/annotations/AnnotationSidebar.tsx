// components/annotations/AnnotationSidebar.tsx
'use client'

import { useState } from 'react'
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AnnotationForm } from './AnnotationForm'
import { useAnnotations } from '@/lib/hooks/useAnnotations'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Annotation, AnnotationType } from '@/types/collaboration'

const TYPE_COLORS: Record<string, string> = {
  observation: 'bg-blue-500/20 text-blue-400',
  question: 'bg-amber-500/20 text-amber-400',
  correction: 'bg-red-500/20 text-red-400',
  connection: 'bg-green-500/20 text-green-400',
}

interface AnnotationSidebarProps {
  documentId: string
}

export function AnnotationSidebar({ documentId }: AnnotationSidebarProps) {
  const { user } = useAuth()
  const { annotations, isLoading, createAnnotation, voteAnnotation } = useAnnotations(documentId)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const handleCreate = (content: string, annotationType: AnnotationType) => {
    createAnnotation.mutate({ content, annotationType })
  }

  const handleReply = (content: string, _annotationType: AnnotationType, parentId: string) => {
    createAnnotation.mutate({ content, annotationType: 'observation', parentId })
    setReplyingTo(null)
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Annotations ({annotations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {user && (
          <AnnotationForm
            onSubmit={handleCreate}
            isPending={createAnnotation.isPending}
          />
        )}

        <ScrollArea className="max-h-[400px]">
          {annotations.length === 0 && !isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No annotations yet. {user ? 'Be the first to add one.' : 'Sign in to annotate.'}
            </p>
          ) : (
            <div className="space-y-3">
              {annotations.map((annotation) => (
                <AnnotationItem
                  key={annotation.id}
                  annotation={annotation}
                  replyingTo={replyingTo}
                  onReply={setReplyingTo}
                  onSubmitReply={(content, type) => handleReply(content, type, annotation.id)}
                  onVote={(voteType) => voteAnnotation.mutate({ annotationId: annotation.id, voteType })}
                  isReplyPending={createAnnotation.isPending}
                  isVotePending={voteAnnotation.isPending}
                  isAuthenticated={!!user}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function AnnotationItem({
  annotation,
  replyingTo,
  onReply,
  onSubmitReply,
  onVote,
  isReplyPending,
  isVotePending,
  isAuthenticated,
}: {
  annotation: Annotation
  replyingTo: string | null
  onReply: (id: string | null) => void
  onSubmitReply: (content: string, type: AnnotationType) => void
  onVote: (voteType: 'upvote' | 'downvote') => void
  isReplyPending: boolean
  isVotePending: boolean
  isAuthenticated: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-background p-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">
          {annotation.user_display_name ?? 'Anonymous'}
        </span>
        <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[annotation.annotation_type] ?? ''}`}>
          {annotation.annotation_type}
        </Badge>
      </div>
      <p className="text-sm text-foreground">{annotation.content}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-xs"
          disabled={isVotePending || !isAuthenticated}
          onClick={() => onVote('upvote')}
        >
          <ThumbsUp className="h-3 w-3" /> {annotation.upvotes}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-xs"
          disabled={isVotePending || !isAuthenticated}
          onClick={() => onVote('downvote')}
        >
          <ThumbsDown className="h-3 w-3" /> {annotation.downvotes}
        </Button>
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs ml-auto"
            onClick={() => onReply(replyingTo === annotation.id ? null : annotation.id)}
          >
            Reply
          </Button>
        )}
      </div>
      {replyingTo === annotation.id && (
        <AnnotationForm
          onSubmit={onSubmitReply}
          isPending={isReplyPending}
          parentId={annotation.id}
        />
      )}
      {annotation.replies && annotation.replies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2 border-l border-border pl-3">
          {annotation.replies.map((reply) => (
            <div key={reply.id} className="space-y-1">
              <span className="text-xs font-medium">{reply.user_display_name ?? 'Anonymous'}</span>
              <p className="text-xs text-foreground">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
