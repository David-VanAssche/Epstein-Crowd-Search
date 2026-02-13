// components/email/EmailMessage.tsx
'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Paperclip, ExternalLink, Calendar, User, Users } from 'lucide-react'
import Link from 'next/link'

interface EmailDetail {
  id: string
  subject: string | null
  from_raw: string | null
  from_entity_id: string | null
  from_entity_name: string | null
  to_raw: string[]
  cc_raw: string[]
  sent_date: string | null
  body: string | null
  has_attachments: boolean
  attachment_filenames: string[]
  document_id: string
  document_filename: string | null
}

interface EmailMessageProps {
  email: EmailDetail
}

function formatDate(d: string | null) {
  if (!d) return 'Unknown date'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))
}

export function EmailMessage({ email }: EmailMessageProps) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <h2 className="text-xl font-bold mb-2">{email.subject || '(no subject)'}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {formatDate(email.sent_date)}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <span className="font-medium">From: </span>
              {email.from_entity_id ? (
                <Link href={`/entity/${email.from_entity_id}`} className="text-accent hover:underline">
                  {email.from_entity_name}
                </Link>
              ) : (
                <span className="text-muted-foreground">{email.from_raw || 'Unknown'}</span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <span className="font-medium">To: </span>
              <span className="text-muted-foreground">{email.to_raw.join(', ') || 'None'}</span>
            </div>
          </div>
          {email.cc_raw.length > 0 && (
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="text-sm">
                <span className="font-medium">CC: </span>
                <span className="text-muted-foreground">{email.cc_raw.join(', ')}</span>
              </div>
            </div>
          )}
        </div>
        {email.has_attachments && email.attachment_filenames.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Paperclip className="h-4 w-4" /> Attachments ({email.attachment_filenames.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {email.attachment_filenames.map((f, i) => (
                <Badge key={i} variant="secondary">{f}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        {email.body ? (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{email.body}</pre>
        ) : (
          <p className="text-sm text-muted-foreground italic">No email body available</p>
        )}
      </CardContent>
      <Separator />
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          {email.document_filename && (
            <span className="text-xs text-muted-foreground">Source: {email.document_filename}</span>
          )}
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/document/${email.document_id}`}>
              View Document <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
