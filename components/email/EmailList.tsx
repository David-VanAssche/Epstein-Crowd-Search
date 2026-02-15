// components/email/EmailList.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Mail, Paperclip, Users } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface EmailItem {
  id: string
  subject: string | null
  from_raw: string | null
  from_entity_name: string | null
  to_raw: string[]
  sent_date: string | null
  has_attachments: boolean
  thread_id: string | null
  document_id: string | null
  document_filename: string | null
}

interface EmailListProps {
  emails: EmailItem[]
}

function formatDate(d: string | null) {
  if (!d) return 'Unknown date'
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))
}

function formatRecipients(recipients: string[]) {
  if (recipients.length === 0) return 'Undisclosed'
  if (recipients.length <= 2) return recipients.join(', ')
  return `${recipients[0]}, ${recipients[1]} +${recipients.length - 2}`
}

export function EmailList({ emails }: EmailListProps) {
  return (
    <div className="space-y-2">
      {emails.map((email) => {
        const Wrapper = email.document_id ? Link : 'div'
        const wrapperProps = email.document_id
          ? { href: `/document/${email.document_id}` }
          : {}
        return (
          <Wrapper
            key={email.id}
            {...wrapperProps as any}
            className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-surface"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-surface-elevated p-2 shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className={cn('font-medium text-sm truncate', !email.subject && 'text-muted-foreground italic')}>
                    {email.subject || '(no subject)'}
                  </h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(email.sent_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="font-medium">{email.from_entity_name || email.from_raw || 'Unknown'}</span>
                  <span>&rarr;</span>
                  <span className="truncate">{formatRecipients(email.to_raw)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {email.has_attachments && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Paperclip className="h-3 w-3" /> Attachments
                    </Badge>
                  )}
                  {email.thread_id && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Users className="h-3 w-3" /> Thread
                    </Badge>
                  )}
                  {email.document_filename && (
                    <span className="text-xs text-muted-foreground truncate">{email.document_filename}</span>
                  )}
                </div>
              </div>
            </div>
          </Wrapper>
        )
      })}
    </div>
  )
}
