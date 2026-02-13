// types/emails.ts

export interface EmailListItem {
  id: string
  subject: string | null
  from_raw: string | null
  from_entity_name: string | null
  to_raw: string[]
  sent_date: string | null
  has_attachments: boolean
  thread_id: string | null
  document_id: string
  document_filename: string | null
  confidence: number | null
}

export interface EmailDetail {
  id: string
  document_id: string
  chunk_id: string | null
  message_id: string | null
  thread_id: string | null
  in_reply_to: string | null
  subject: string | null
  sent_date: string | null
  from_raw: string | null
  from_entity_id: string | null
  from_entity_name: string | null
  to_raw: string[]
  to_entity_ids: string[]
  cc_raw: string[]
  cc_entity_ids: string[]
  bcc_raw: string[]
  bcc_entity_ids: string[]
  body: string | null
  has_attachments: boolean
  attachment_filenames: string[]
  confidence: number | null
  document_filename: string | null
}

export interface EmailThread {
  thread_id: string
  subject: string | null
  email_count: number
  participant_count: number
  first_date: string | null
  last_date: string | null
  emails: EmailDetail[]
}

export interface EmailFiltersState {
  search: string
  entityId: string | null
  dateFrom: string | null
  dateTo: string | null
  hasAttachments: boolean | null
  threadId: string | null
}
