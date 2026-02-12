// components/annotations/AnnotationForm.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AnnotationType } from '@/types/collaboration'

const ANNOTATION_TYPES: { value: AnnotationType; label: string }[] = [
  { value: 'observation', label: 'Observation' },
  { value: 'question', label: 'Question' },
  { value: 'correction', label: 'Correction' },
  { value: 'connection', label: 'Connection' },
]

interface AnnotationFormProps {
  onSubmit: (content: string, annotationType: AnnotationType) => void
  isPending: boolean
  parentId?: string
}

export function AnnotationForm({ onSubmit, isPending, parentId }: AnnotationFormProps) {
  const [content, setContent] = useState('')
  const [annotationType, setAnnotationType] = useState<AnnotationType>('observation')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit(content.trim(), annotationType)
    setContent('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {!parentId && (
        <Select value={annotationType} onValueChange={(v) => setAnnotationType(v as AnnotationType)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANNOTATION_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentId ? 'Write a reply...' : 'Add an annotation...'}
        rows={2}
        className="text-sm"
      />
      <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
        {isPending ? 'Posting...' : parentId ? 'Reply' : 'Add Annotation'}
      </Button>
    </form>
  )
}
