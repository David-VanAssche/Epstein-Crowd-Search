// lib/pipeline/services/financial-extractor.ts
// Stage 14: Financial Transaction Extraction — Extract financial data from documents.
// Uses Gemini Flash, flags suspicious patterns, resolves entities.

import { SupabaseClient } from '@supabase/supabase-js'

const GEMINI_MODEL = 'gemini-2.0-flash'

const RELEVANT_CLASSIFICATIONS = [
  'financial_record', 'tax_filing', 'trust_document',
  'bank_record', 'check', 'invoice', 'receipt',
] as const

interface ExtractedTransaction {
  from_name: string | null
  to_name: string | null
  amount: number | null
  currency: string
  transaction_date: string | null
  transaction_type: string
  description: string | null
  suspicious_indicators: string[]
  confidence: number
}

const EXTRACTION_PROMPT = `Extract ALL financial transactions from this document.

For each transaction, extract:
- from_name: Who paid/sent money (person or entity name)
- to_name: Who received money (person or entity name)
- amount: Numeric amount (e.g., 50000.00)
- currency: Currency code (default "USD")
- transaction_date: ISO 8601 date if found (e.g., "2003-07-15"), null otherwise
- transaction_type: One of: wire_transfer, check, cash, property_purchase, donation, legal_fee, salary, investment, loan, gift, other
- description: Brief description of the transaction
- suspicious_indicators: Array of reasons why this may be suspicious:
  1. Cash transactions over $10,000 (structuring threshold)
  2. Round amounts over $100,000
  3. Offshore entities (Cayman Islands, BVI, Luxembourg, Switzerland)
  4. Shell company indicators (LLC/Ltd/Inc with no clear business)
  5. Transactions involving minors or youth organizations
  6. Frequent transfers just below $10,000 (structuring)
  7. Unusual recipients with unclear purposes
- confidence: 0.0-1.0 confidence score

Return JSON: { "transactions": [...] }
If no transactions found, return { "transactions": [] }.`

async function callGemini(text: string, classification: string, apiKey: string): Promise<ExtractedTransaction[]> {
  const textSample = text.length > 50000
    ? text.slice(0, 35000) + '\n...\n' + text.slice(-15000)
    : text

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: `${EXTRACTION_PROMPT}\n\nDocument type: ${classification}\n\nDocument text:\n---\n${textSample}\n---` }] },
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
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"transactions":[]}'

  try {
    const parsed = JSON.parse(responseText)
    return (parsed.transactions || []).map((t: any) => ({
      from_name: t.from_name || null,
      to_name: t.to_name || null,
      amount: typeof t.amount === 'number' ? t.amount : null,
      currency: t.currency || 'USD',
      transaction_date: t.transaction_date || null,
      transaction_type: t.transaction_type || 'other',
      description: t.description || null,
      suspicious_indicators: Array.isArray(t.suspicious_indicators) ? t.suspicious_indicators : [],
      confidence: typeof t.confidence === 'number' ? t.confidence : 0.5,
    }))
  } catch {
    console.warn('[FinancialExtractor] Failed to parse Gemini response')
    return []
  }
}

async function resolveEntityId(
  name: string | null,
  supabase: SupabaseClient
): Promise<string | null> {
  if (!name || name.trim().length < 2) return null

  const normalized = name.trim().toLowerCase()

  // Exact name match (case-insensitive)
  const { data: exact } = await supabase
    .from('entities')
    .select('id')
    .ilike('name', normalized)
    .limit(1)
    .single()

  if (exact) return (exact as any).id

  // Alias match
  const { data: aliasMatch } = await supabase
    .from('entities')
    .select('id')
    .contains('aliases', [name.trim()])
    .limit(1)
    .single()

  if (aliasMatch) return (aliasMatch as any).id

  // Fuzzy: last word match
  const lastName = normalized.split(' ').pop()
  if (!lastName || lastName.length < 3) return null

  const { data: fuzzy } = await supabase
    .from('entities')
    .select('id, name')
    .ilike('name', `%${lastName}%`)
    .limit(10)

  if (fuzzy) {
    for (const entity of fuzzy) {
      const entityNorm = (entity as any).name.toLowerCase()
      if (entityNorm.includes(normalized) || normalized.includes(entityNorm)) {
        return (entity as any).id
      }
    }
  }

  return null
}

const VALID_TRANSACTION_TYPES = new Set([
  'wire_transfer', 'check', 'cash', 'property_purchase', 'donation',
  'legal_fee', 'salary', 'investment', 'loan', 'gift', 'other',
])

// --- Stage handler ---

export async function handleFinancialExtract(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[FinancialExtractor] Processing document ${documentId}`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Check classification
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, classification, ocr_text')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    throw new Error(`Document not found: ${docError?.message}`)
  }

  const classification = (doc as any).classification || 'unknown'
  if (!RELEVANT_CLASSIFICATIONS.includes(classification as any)) {
    console.log(`[FinancialExtractor] Skipping ${documentId} — classification "${classification}" not relevant`)
    return
  }

  // Idempotency check
  const { count } = await supabase
    .from('financial_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)

  if (count && count > 0) {
    console.log(`[FinancialExtractor] Skipping ${documentId} — ${count} transactions exist`)
    return
  }

  // Get text content
  let documentText = (doc as any).ocr_text || ''
  if (!documentText) {
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })

    if (chunks && chunks.length > 0) {
      documentText = chunks.map((c: any) => c.content).join('\n\n')
    }
  }

  if (!documentText.trim()) {
    console.log(`[FinancialExtractor] Skipping ${documentId} — no text content`)
    return
  }

  // Get first chunk for FK reference
  const { data: firstChunk } = await supabase
    .from('chunks')
    .select('id')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
    .limit(1)
    .single()

  const chunkId = firstChunk ? (firstChunk as any).id : null

  // Extract transactions
  const transactions = await callGemini(documentText, classification, apiKey)

  if (transactions.length === 0) {
    console.log(`[FinancialExtractor] ${documentId}: no transactions found`)
    return
  }

  // Create extraction record
  const { data: extraction } = await supabase
    .from('structured_data_extractions')
    .insert({
      document_id: documentId,
      extraction_type: 'financial_transaction',
      extracted_data: { transactions },
      confidence: transactions.reduce((s, t) => s + t.confidence, 0) / transactions.length,
    })
    .select('id')
    .single()

  const extractionId = extraction ? (extraction as any).id : null

  // Insert transactions
  let inserted = 0
  for (const tx of transactions) {
    const fromEntityId = await resolveEntityId(tx.from_name, supabase)
    const toEntityId = await resolveEntityId(tx.to_name, supabase)

    const isSuspicious = tx.suspicious_indicators.length > 0
    const shellCompanyInvolved = !!(
      (tx.from_name && /\b(LLC|Ltd|Inc|Corp|Limited|Holdings|Trust)\b/i.test(tx.from_name)) ||
      (tx.to_name && /\b(LLC|Ltd|Inc|Corp|Limited|Holdings|Trust)\b/i.test(tx.to_name))
    )

    const txType = VALID_TRANSACTION_TYPES.has(tx.transaction_type)
      ? tx.transaction_type
      : 'other'

    const { error: insertError } = await supabase
      .from('financial_transactions')
      .insert({
        document_id: documentId,
        chunk_id: chunkId,
        extraction_id: extractionId,
        from_entity_id: fromEntityId,
        from_raw: tx.from_name,
        to_entity_id: toEntityId,
        to_raw: tx.to_name,
        amount: tx.amount,
        currency: tx.currency,
        transaction_date: tx.transaction_date,
        transaction_type: txType,
        description: tx.description,
        is_suspicious: isSuspicious,
        suspicious_reasons: tx.suspicious_indicators,
        shell_company_involved: shellCompanyInvolved,
        confidence: tx.confidence,
      })

    if (insertError) {
      console.warn(`[FinancialExtractor] Insert failed: ${insertError.message}`)
    } else {
      inserted++
    }
  }

  console.log(`[FinancialExtractor] ${documentId}: inserted ${inserted}/${transactions.length} transactions`)
}

// --- Batch service class ---

export class FinancialExtractorService {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async extractFromDocument(documentId: string): Promise<{
    success: boolean
    error?: string
    transactionCount?: number
  }> {
    try {
      await handleFinancialExtract(documentId, this.supabase)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }

    const { count } = await this.supabase
      .from('financial_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)

    return { success: true, transactionCount: count || 0 }
  }
}
