// lib/pipeline/services/classifier.ts
// Stage 2: Classification — Classify documents with multi-label support.
// Returns a primary class + optional secondary tags for routing downstream stages.
// Uses Gemini Flash with structured JSON output.

import { SupabaseClient } from '@supabase/supabase-js'

// Expanded from 16 to 30 types, organized by probative tier
export const DOCUMENT_TYPES = [
  // Tier 1: Sworn testimony (weight 1.0)
  'deposition',
  'grand_jury_testimony',
  'witness_statement',
  'plea_agreement',
  // Tier 2: Official / law enforcement (weight 0.7)
  'court_filing',
  'indictment',
  'subpoena',
  'search_warrant',
  'police_report',
  'fbi_report',
  'government_report',
  // Tier 3: Records (weight 0.4)
  'flight_log',
  'financial_record',
  'tax_filing',
  'trust_document',
  'phone_record',
  'medical_record',
  'corporate_filing',
  'property_record',
  // Tier 4: Correspondence (weight 0.2)
  'email',
  'letter',
  'memo',
  'fax',
  'correspondence', // legacy catch-all for ambiguous correspondence
  // Tier 5: Peripheral (weight 0.1)
  'address_book',
  'photograph',
  'news_clipping',
  'calendar_schedule',
  'receipt_invoice',
  'other',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

const DOCUMENT_TYPE_SET = new Set<string>(DOCUMENT_TYPES)

// Type descriptions for the classifier prompt
const TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  // Tier 1
  deposition: 'Sworn Q&A testimony transcript',
  grand_jury_testimony: 'Grand jury proceeding transcript',
  witness_statement: 'Signed witness declaration or affidavit',
  plea_agreement: 'Guilty plea, cooperation agreement, proffer',
  // Tier 2
  court_filing: 'Motions, orders, judicial opinions, legal briefs',
  indictment: 'Formal criminal charges, information',
  subpoena: 'Subpoena, summons, court order to produce records',
  search_warrant: 'Search warrant, affidavit for probable cause',
  police_report: 'Local/state law enforcement report',
  fbi_report: 'FBI 302 interview memo, FD-1057, case summary',
  government_report: 'DOJ memo, Inspector General report, diplomatic cable',
  // Tier 3
  flight_log: 'Flight manifest, pilot logbook, FAA record',
  financial_record: 'Bank statement, wire transfer record, check image',
  tax_filing: 'Tax return, IRS form, W-2, 1099',
  trust_document: 'Trust agreement, foundation charter, estate plan',
  phone_record: 'Call log, phone bill, cell tower record',
  medical_record: 'Medical exam, psychiatric evaluation, treatment record',
  corporate_filing: 'Incorporation docs, annual report, SEC filing',
  property_record: 'Deed, mortgage, lease, property title',
  // Tier 4
  email: 'Electronic email with headers (From/To/Subject/Date)',
  letter: 'Physical letter, handwritten note, typed letter',
  memo: 'Internal memo, office communication, routing slip',
  fax: 'Fax transmission with fax header',
  correspondence: 'General correspondence that cannot be classified as email/letter/memo/fax',
  // Tier 5
  address_book: 'Contact list, rolodex entry, phone directory',
  photograph: 'Photo, image without significant text',
  news_clipping: 'Newspaper or magazine article',
  calendar_schedule: 'Appointment calendar, itinerary, daily schedule',
  receipt_invoice: 'Receipt, invoice, purchase order',
  other: 'Does not fit any category above',
}

interface ClassificationResult {
  type: DocumentType
  confidence: number
  reasoning: string
  tags: DocumentType[]
  raw: Record<string, unknown>
}

function buildClassifierPrompt(): string {
  const typeList = DOCUMENT_TYPES.map((t) => `- ${t}: ${TYPE_DESCRIPTIONS[t]}`).join('\n')

  return `You are classifying documents from a DOJ FOIA release related to the Jeffrey Epstein investigation. Documents are OCR'd scans that may contain multiple document types (e.g., a court filing with email exhibits attached).

Assign a PRIMARY classification (the dominant document type) and any SECONDARY tags for embedded or attached content.

Document types (use these exact values):

${typeList}

Return JSON:
{
  "primary": {"type": "<type>", "confidence": 0.0-1.0},
  "secondary": [{"type": "<type>", "confidence": 0.0-1.0, "reason": "why"}],
  "reasoning": "1 sentence overall explanation"
}

Rules:
- secondary array can be empty if the document is purely one type
- Only include secondary types with confidence >= 0.3
- A deposition WITH financial exhibits = primary:deposition, secondary:financial_record
- Do NOT confuse the document container with its contents — a court filing ABOUT flight logs is still court_filing, not flight_log, unless actual log pages are attached
- For OCR'd scans with poor text quality, prefer broader types (court_filing over indictment) and lower confidence`
}

const CLASSIFIER_SYSTEM_PROMPT = buildClassifierPrompt()

async function classifyDocument(
  ocrText: string,
  filename: string,
  apiKey: string
): Promise<ClassificationResult> {
  // Use first 3000 + last 1000 chars (saves tokens on long documents)
  const textSample =
    ocrText.length > 4000
      ? ocrText.slice(0, 3000) + '\n...\n' + ocrText.slice(-1000)
      : ocrText

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: CLASSIFIER_SYSTEM_PROMPT }],
        },
        contents: [
          {
            parts: [
              {
                text: `Filename: ${filename}\n\nDocument text (excerpt):\n---\n${textSample}\n---`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Classification API failed: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    const parsed = JSON.parse(text)
    const rawPrimary = (parsed.primary?.type || parsed.type || 'other').toLowerCase().trim()
    const primaryConf = parsed.primary?.confidence ?? parsed.confidence ?? 0.5
    const reasoning = parsed.reasoning || parsed.primary?.reasoning || ''

    const validPrimary = DOCUMENT_TYPE_SET.has(rawPrimary) ? rawPrimary : 'other'

    // Parse secondary tags, normalizing case and filtering to valid types with confidence >= 0.3
    const secondaryRaw: Array<{ type: string; confidence: number; reason?: string }> =
      Array.isArray(parsed.secondary) ? parsed.secondary : []
    const tags = secondaryRaw
      .map((s) => ({ ...s, type: (s.type || '').toLowerCase().trim() }))
      .filter((s) => DOCUMENT_TYPE_SET.has(s.type) && s.confidence >= 0.3 && s.type !== validPrimary)
      .map((s) => s.type as DocumentType)

    return {
      type: validPrimary as DocumentType,
      confidence: Math.min(1.0, Math.max(0.0, primaryConf)),
      reasoning,
      tags,
      raw: parsed,
    }
  } catch {
    return {
      type: 'other',
      confidence: 0.3,
      reasoning: 'Failed to parse classification response',
      tags: [],
      raw: {},
    }
  }
}

// --- Stage handler ---

export async function handleClassify(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[Classify] Processing document ${documentId}`)

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, filename, ocr_text, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  if (!doc.ocr_text) throw new Error(`Document ${documentId} has no OCR text — run OCR first`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const result = await classifyDocument(doc.ocr_text, doc.filename, apiKey)

  const { error: updateError } = await supabase
    .from('documents')
    .update({
      classification: result.type,
      classification_confidence: result.confidence,
      classification_tags: result.tags,
      classification_raw: result.raw,
      metadata: {
        ...((doc as any).metadata || {}),
        classification_reasoning: result.reasoning,
        classification_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update classification: ${updateError.message}`)
  }

  const tagStr = result.tags.length > 0 ? ` [tags: ${result.tags.join(', ')}]` : ''
  console.log(
    `[Classify] Document ${documentId}: ${result.type} (confidence: ${result.confidence.toFixed(2)})${tagStr}`
  )
}
