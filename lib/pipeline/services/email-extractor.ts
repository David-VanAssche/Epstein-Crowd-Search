// lib/pipeline/services/email-extractor.ts
// Stage 13: Email Extraction — Extract structured email data from correspondence documents.
// Uses Gemini Flash for extraction, resolves entity names via fuzzy matching.

import { SupabaseClient } from '@supabase/supabase-js'

const GEMINI_MODEL = 'gemini-2.0-flash'

const RELEVANT_CLASSIFICATIONS = [
  'correspondence', 'email', 'memo', 'letter', 'fax',
] as const

interface ExtractedEmail {
  message_id: string | null
  in_reply_to: string | null
  thread_id: string | null
  subject: string | null
  sent_date: string | null
  from_raw: string | null
  to_raw: string[]
  cc_raw: string[]
  bcc_raw: string[]
  body: string | null
  has_attachments: boolean
  attachment_filenames: string[]
  confidence: number
}

const EXTRACTION_PROMPT = `Extract all email messages from this document. This may be a single email, an email thread, or a collection of correspondence.

For each email found, extract:
1. **Headers** (if present):
   - message_id: RFC 2822 Message-ID header
   - in_reply_to: Message-ID this is replying to
   - thread_id: Thread identifier (Message-ID of first message in thread)
   - subject: Email subject line
   - sent_date: ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ)

2. **Participants**:
   - from_raw: Sender name and/or email
   - to_raw: Array of recipients
   - cc_raw: Array of CC recipients
   - bcc_raw: Array of BCC recipients

3. **Content**:
   - body: Full email body text
   - has_attachments: true if attachments are mentioned
   - attachment_filenames: Array of attachment filenames

4. **Metadata**:
   - confidence: 0.0-1.0 extraction quality score

Return JSON: { "emails": [...] }
If this is NOT email correspondence, return { "emails": [] }.
Use null for missing fields, [] for missing arrays.`

async function callGemini(text: string, apiKey: string): Promise<ExtractedEmail[]> {
  const textSample = text.length > 50000 ? text.slice(0, 50000) : text

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: `${EXTRACTION_PROMPT}\n\nDocument text:\n---\n${textSample}\n---` }] },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)

  const data = await response.json()
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"emails":[]}'

  try {
    const parsed = JSON.parse(responseText)
    return (parsed.emails || []).map((e: any) => ({
      message_id: e.message_id || null,
      in_reply_to: e.in_reply_to || null,
      thread_id: e.thread_id || null,
      subject: e.subject || null,
      sent_date: e.sent_date || null,
      from_raw: e.from_raw || null,
      to_raw: Array.isArray(e.to_raw) ? e.to_raw : [],
      cc_raw: Array.isArray(e.cc_raw) ? e.cc_raw : [],
      bcc_raw: Array.isArray(e.bcc_raw) ? e.bcc_raw : [],
      body: e.body || null,
      has_attachments: !!e.has_attachments,
      attachment_filenames: Array.isArray(e.attachment_filenames) ? e.attachment_filenames : [],
      confidence: typeof e.confidence === 'number' ? e.confidence : 0.5,
    }))
  } catch {
    console.warn('[EmailExtractor] Failed to parse Gemini response')
    return []
  }
}

async function resolveEntityByName(
  rawName: string | null,
  supabase: SupabaseClient
): Promise<string | null> {
  if (!rawName || rawName.trim().length < 2) return null

  // Extract name part (remove email address if present)
  const namePart = rawName.includes('<')
    ? rawName.split('<')[0].trim()
    : rawName.trim()

  const normalized = namePart
    .toLowerCase()
    .replace(/\b(mr|ms|mrs|dr|prof|hon)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length < 2) return null

  // Exact match on name_normalized
  const { data: exact } = await supabase
    .from('entities')
    .select('id')
    .eq('name_normalized', normalized)
    .eq('entity_type', 'person')
    .limit(1)
    .single()

  if (exact) return (exact as any).id

  // Fuzzy: ILIKE on last name
  const lastName = normalized.split(' ').pop()
  if (!lastName || lastName.length < 3) return null

  const { data: fuzzy } = await supabase
    .from('entities')
    .select('id, name, aliases')
    .eq('entity_type', 'person')
    .ilike('name', `%${lastName}%`)
    .limit(10)

  if (!fuzzy) return null

  for (const entity of fuzzy) {
    const entityNorm = (entity as any).name.toLowerCase()
    if (entityNorm.includes(normalized) || normalized.includes(entityNorm)) {
      return (entity as any).id
    }
    for (const alias of ((entity as any).aliases || []) as string[]) {
      if (alias.toLowerCase() === normalized) return (entity as any).id
    }
  }

  return null
}

async function resolveParticipants(
  participants: string[],
  supabase: SupabaseClient
): Promise<string[]> {
  const resolved: string[] = []
  for (const name of participants) {
    const id = await resolveEntityByName(name, supabase)
    if (id) resolved.push(id)
  }
  return resolved
}

// --- Stage handler ---

export async function handleEmailExtract(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[EmailExtractor] Processing document ${documentId}`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Check document classification
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, classification')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    throw new Error(`Document not found: ${docError?.message}`)
  }

  const classification = ((doc as any).classification || '').toLowerCase()
  if (!RELEVANT_CLASSIFICATIONS.includes(classification as any)) {
    console.log(`[EmailExtractor] Skipping ${documentId} — classification "${classification}" not relevant`)
    return
  }

  // Idempotency check
  const { count } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)

  if (count && count > 0) {
    console.log(`[EmailExtractor] Skipping ${documentId} — ${count} emails already exist`)
    return
  }

  // Fetch chunks
  const { data: chunks, error: chunksError } = await supabase
    .from('chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (chunksError || !chunks || chunks.length === 0) {
    throw new Error(`No chunks found: ${chunksError?.message}`)
  }

  // Extract emails
  const combinedText = chunks.map((c: any) => c.content).join('\n\n---\n\n')
  const extracted = await callGemini(combinedText, apiKey)

  if (extracted.length === 0) {
    console.log(`[EmailExtractor] ${documentId}: no emails found`)
    return
  }

  // Create extraction record
  const avgConfidence = extracted.reduce((s, e) => s + e.confidence, 0) / extracted.length
  const { data: extraction } = await supabase
    .from('structured_data_extractions')
    .insert({
      document_id: documentId,
      extraction_type: 'email',
      extracted_data: { emails: extracted },
      confidence: avgConfidence,
    })
    .select('id')
    .single()

  const extractionId = extraction ? (extraction as any).id : null

  // Insert each email
  let inserted = 0
  for (let i = 0; i < extracted.length; i++) {
    const email = extracted[i]

    const fromEntityId = await resolveEntityByName(email.from_raw, supabase)
    const toEntityIds = await resolveParticipants(email.to_raw, supabase)
    const ccEntityIds = await resolveParticipants(email.cc_raw, supabase)
    const bccEntityIds = await resolveParticipants(email.bcc_raw, supabase)

    const { error: insertError } = await supabase.from('emails').insert({
      document_id: documentId,
      chunk_id: i < chunks.length ? (chunks[i] as any).id : (chunks[0] as any).id,
      extraction_id: extractionId,
      message_id: email.message_id,
      thread_id: email.thread_id,
      in_reply_to: email.in_reply_to,
      subject: email.subject,
      sent_date: email.sent_date,
      from_raw: email.from_raw,
      from_entity_id: fromEntityId,
      to_raw: email.to_raw,
      to_entity_ids: toEntityIds,
      cc_raw: email.cc_raw,
      cc_entity_ids: ccEntityIds,
      bcc_raw: email.bcc_raw,
      bcc_entity_ids: bccEntityIds,
      body: email.body,
      has_attachments: email.has_attachments,
      attachment_filenames: email.attachment_filenames,
      confidence: email.confidence,
    })

    if (insertError) {
      console.warn(`[EmailExtractor] Insert failed for email ${i + 1}: ${insertError.message}`)
    } else {
      inserted++
    }
  }

  console.log(`[EmailExtractor] ${documentId}: inserted ${inserted}/${extracted.length} emails`)
}

// --- Batch service class ---

export class EmailExtractorService {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async extractFromDocument(documentId: string): Promise<{
    success: boolean
    error?: string
    emailCount?: number
  }> {
    try {
      await handleEmailExtract(documentId, this.supabase)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }

    const { count } = await this.supabase
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)

    return { success: true, emailCount: count || 0 }
  }
}
