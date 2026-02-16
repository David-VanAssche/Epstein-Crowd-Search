// lib/pipeline/services/subpoena-extractor.ts
// Stage: Subpoena Rider Extraction — Extract structured data from Grand Jury subpoena documents.
// Inspired by rhowardstone/extract_subpoena_riders.py.
// Uses regex-based extraction (no LLM) for deterministic, fast parsing.

import { SupabaseClient } from '@supabase/supabase-js'

export interface SubpoenaRider {
  targetEntity: string
  targetCategory: 'financial_institution' | 'tech_company' | 'individual' | 'government' | 'other'
  subpoenaDate: string | null
  citedStatutes: string[]
  requestedDocTypes: string[]
  pageRange: { start: number; end: number }
}

// --- Regex patterns ---

const RIDER_HEADER = /RIDER\s*\(Grand\s+Jury\s+Subpoena\s+to\s+(.+?),\s*dated\s+(.+?)\)/gi
const STATUTE_PATTERN = /(?:18|21|26|28|31)\s+U\.S\.C\.\s*§\s*(\d+(?:\([a-z]\))?)/g
const NUMBERED_ITEM = /^\s*\d+\.\s+(.+)/gm
const DATE_PATTERN = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi
const ALT_DATE_PATTERN = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g

// Financial institution indicators
const FINANCIAL_INDICATORS = /\b(bank|credit\s+union|savings|trust\s+company|securities|brokerage|investment|citibank|chase|wells\s+fargo|goldman|morgan\s+stanley|deutsche\s+bank|barclays|hsbc|ubs)\b/i

// Tech company indicators
const TECH_INDICATORS = /\b(google|apple|microsoft|facebook|meta|amazon|twitter|at&t|verizon|t-mobile|sprint|comcast)\b/i

// Government indicators
const GOV_INDICATORS = /\b(department|agency|bureau|office|commission|irs|faa|sec|fbi|dea|ice|customs|immigration)\b/i

function classifyTarget(name: string): SubpoenaRider['targetCategory'] {
  if (FINANCIAL_INDICATORS.test(name)) return 'financial_institution'
  if (TECH_INDICATORS.test(name)) return 'tech_company'
  if (GOV_INDICATORS.test(name)) return 'government'
  // If name looks like a person (no corporate suffixes)
  if (!/\b(inc|llc|ltd|corp|company|co\.|group|holdings|associates)\b/i.test(name)) {
    return 'individual'
  }
  return 'other'
}

function extractStatutes(text: string): string[] {
  const statutes: string[] = []
  let match: RegExpExecArray | null
  const pattern = new RegExp(STATUTE_PATTERN.source, 'g')
  while ((match = pattern.exec(text)) !== null) {
    const section = match[1]
    const fullMatch = match[0]
    if (!statutes.includes(fullMatch)) {
      statutes.push(fullMatch)
    }
  }
  return statutes
}

function extractNumberedItems(text: string): string[] {
  const items: string[] = []
  let match: RegExpExecArray | null
  const pattern = new RegExp(NUMBERED_ITEM.source, 'gm')
  while ((match = pattern.exec(text)) !== null) {
    const item = match[1].trim()
    if (item.length > 5 && item.length < 500) {
      items.push(item)
    }
  }
  return items
}

/**
 * Extract subpoena riders from document text.
 * Returns an array of structured rider records.
 */
export function extractSubpoenaRiders(
  ocrText: string,
  totalPages: number
): SubpoenaRider[] {
  const riders: SubpoenaRider[] = []
  const headerPattern = new RegExp(RIDER_HEADER.source, 'gi')

  let match: RegExpExecArray | null
  while ((match = headerPattern.exec(ocrText)) !== null) {
    const targetEntity = match[1].trim()
    const dateStr = match[2].trim()
    const matchPos = match.index

    // Extract the text section following this rider header (until next rider or end)
    const nextMatch = headerPattern.exec(ocrText)
    const sectionEnd = nextMatch ? nextMatch.index : ocrText.length
    const sectionText = ocrText.slice(matchPos, sectionEnd)

    // Reset lastIndex to continue from where we were
    if (nextMatch) {
      headerPattern.lastIndex = nextMatch.index
    }

    const citedStatutes = extractStatutes(sectionText)
    const requestedDocTypes = extractNumberedItems(sectionText)

    // Estimate page range based on character position
    const charsPerPage = ocrText.length / Math.max(1, totalPages)
    const startPage = Math.floor(matchPos / charsPerPage) + 1
    const endPage = Math.min(totalPages, Math.floor(sectionEnd / charsPerPage) + 1)

    riders.push({
      targetEntity,
      targetCategory: classifyTarget(targetEntity),
      subpoenaDate: dateStr || null,
      citedStatutes,
      requestedDocTypes,
      pageRange: { start: startPage, end: endPage },
    })
  }

  // Fallback: if no RIDER header found but document IS a subpoena,
  // try to extract basic structured data
  if (riders.length === 0) {
    const statutes = extractStatutes(ocrText)
    const items = extractNumberedItems(ocrText)
    const dates = ocrText.match(DATE_PATTERN) || ocrText.match(ALT_DATE_PATTERN) || []

    if (statutes.length > 0 || items.length > 0) {
      riders.push({
        targetEntity: 'Unknown — no RIDER header found',
        targetCategory: 'other',
        subpoenaDate: dates[0] ?? null,
        citedStatutes: statutes,
        requestedDocTypes: items.slice(0, 20), // Cap at 20 items
        pageRange: { start: 1, end: totalPages },
      })
    }
  }

  return riders
}

// --- Stage handler ---

export async function handleSubpoenaExtract(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[SubpoenaExtract] Processing document ${documentId}`)

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, classification, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  const ocrText = (doc as any).ocr_text || ''
  if (!ocrText) {
    console.log(`[SubpoenaExtract] Document ${documentId}: no text, skipping`)
    return
  }

  // Estimate total pages from chunk count
  const { count: chunkCount } = await supabase
    .from('chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)

  // Rough estimate: ~2 chunks per page
  const estimatedPages = Math.max(1, Math.ceil((chunkCount ?? 1) / 2))

  const riders = extractSubpoenaRiders(ocrText, estimatedPages)

  if (riders.length === 0) {
    console.log(`[SubpoenaExtract] Document ${documentId}: no riders found`)
    return
  }

  // Delete existing riders for idempotency
  await supabase.from('subpoena_riders').delete().eq('document_id', documentId)

  // Insert riders
  for (const rider of riders) {
    await supabase.from('subpoena_riders').insert({
      document_id: documentId,
      target_entity: rider.targetEntity,
      target_category: rider.targetCategory,
      subpoena_date: rider.subpoenaDate,
      cited_statutes: rider.citedStatutes,
      requested_doc_types: rider.requestedDocTypes,
      page_start: rider.pageRange.start,
      page_end: rider.pageRange.end,
    })
  }

  // Update document metadata
  const existingMetadata = ((doc as any).metadata as Record<string, unknown>) || {}
  await supabase
    .from('documents')
    .update({
      metadata: {
        ...existingMetadata,
        subpoena_rider_count: riders.length,
        subpoena_extraction_timestamp: new Date().toISOString(),
      },
    })
    .eq('id', documentId)

  console.log(
    `[SubpoenaExtract] Document ${documentId}: extracted ${riders.length} riders`
  )
}
