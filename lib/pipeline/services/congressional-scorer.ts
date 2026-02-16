// lib/pipeline/services/congressional-scorer.ts
// Stage: Congressional Priority Scoring — Rank documents by investigation priority.
// Inspired by rhowardstone/congressional_scorer.py (3-layer scoring) and search_gov_officials.py.
// Uses rule-based scoring (no LLM) to identify documents most likely to reveal
// redacted perpetrator names or contain high-severity evidence.
//
// ETHICAL NOTE: This scores DOCUMENTS for investigative priority, not people.
// It helps researchers focus on the most significant unreleased evidence.

import { SupabaseClient } from '@supabase/supabase-js'
import { OFFICIAL_NAMES_SET, isGovernmentOfficial } from '@/lib/data/government-officials'

// --- Severity-weighted keyword scoring ---

interface WeightedKeyword {
  pattern: RegExp
  weight: number
  category: string
}

const SEVERITY_KEYWORDS: WeightedKeyword[] = [
  // Severe (weight 3) — trafficking and exploitation
  { pattern: /\btrafficking\b/gi, weight: 3, category: 'trafficking' },
  { pattern: /\brape[sd]?\b/gi, weight: 3, category: 'trafficking' },
  { pattern: /\bminor[s]?\b/gi, weight: 3, category: 'trafficking' },
  { pattern: /\bunderage\b/gi, weight: 3, category: 'trafficking' },
  { pattern: /\bchild\s+abuse\b/gi, weight: 3, category: 'trafficking' },
  { pattern: /\bsexual\s+abuse\b/gi, weight: 3, category: 'trafficking' },
  { pattern: /\bmolestation\b/gi, weight: 3, category: 'trafficking' },
  { pattern: /\bsex\s+slave\b/gi, weight: 3, category: 'trafficking' },
  // Moderate (weight 2) — assault and recruitment
  { pattern: /\bassault(ed|s)?\b/gi, weight: 2, category: 'assault' },
  { pattern: /\babuse[sd]?\b/gi, weight: 2, category: 'assault' },
  { pattern: /\brecruitment\b/gi, weight: 2, category: 'recruitment' },
  { pattern: /\brecruited?\b/gi, weight: 2, category: 'recruitment' },
  { pattern: /\bgrooming\b/gi, weight: 2, category: 'recruitment' },
  { pattern: /\bcoercion\b/gi, weight: 2, category: 'assault' },
  { pattern: /\bforce[sd]?\b/gi, weight: 2, category: 'assault' },
  // Financial (weight 1) — money laundering and obstruction
  { pattern: /\bmoney\s+laundering\b/gi, weight: 1, category: 'financial' },
  { pattern: /\bwire\s+transfer\b/gi, weight: 1, category: 'financial' },
  { pattern: /\bobstruction\b/gi, weight: 1, category: 'obstruction' },
  { pattern: /\btampering\b/gi, weight: 1, category: 'obstruction' },
  { pattern: /\bconspiracy\b/gi, weight: 1, category: 'conspiracy' },
  { pattern: /\bcover[\s-]?up\b/gi, weight: 1, category: 'obstruction' },
  { pattern: /\bbribery\b/gi, weight: 1, category: 'financial' },
]

// Name proximity patterns — suggest redacted perpetrator names
const NAME_PROXIMITY_PATTERNS = [
  /(?:raped|assaulted|trafficked|recruited|abused|molested)\s+by\s+\[REDACTED\]/gi,
  /\bMr\.\s*\[REDACTED\]/g,
  /\bMs\.\s*\[REDACTED\]/g,
  /\[REDACTED\]\s+(?:raped|assaulted|trafficked|recruited|abused|molested)/gi,
  /(?:directed|instructed|told)\s+(?:by|to)\s+\[REDACTED\]/gi,
  /\[REDACTED\]\s+(?:paid|gave|provided|offered)/gi,
  /(?:with|and)\s+\[REDACTED\]\s+(?:at|in|on|to)/gi,
]

function computeKeywordScore(text: string): { score: number; matches: Record<string, number> } {
  const matches: Record<string, number> = {}
  let totalScore = 0

  for (const kw of SEVERITY_KEYWORDS) {
    const kwMatches = text.match(kw.pattern)
    if (kwMatches) {
      const count = kwMatches.length
      matches[kw.category] = (matches[kw.category] || 0) + count
      totalScore += count * kw.weight
    }
  }

  // Normalize to 0-1 range (cap at 50 weighted matches)
  return { score: Math.min(1.0, totalScore / 50), matches }
}

function computeNameProximityScore(text: string): { score: number; matchCount: number } {
  let matchCount = 0
  for (const pattern of NAME_PROXIMITY_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) matchCount += matches.length
  }
  // Normalize: each proximity match is highly significant
  return { score: Math.min(1.0, matchCount / 5), matchCount }
}

// --- Stage handler ---

export async function handleCongressionalScore(
  documentId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`[CongressionalScore] Processing document ${documentId}`)

  // Fetch document text
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, ocr_text, metadata')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error(`Document not found: ${documentId}`)
  const ocrText = (doc as any).ocr_text || ''
  if (!ocrText) {
    console.log(`[CongressionalScore] Document ${documentId}: no text, skipping`)
    return
  }

  // Layer 1: Keyword scoring
  const { score: keywordScore, matches: keywordMatches } = computeKeywordScore(ocrText)

  // Layer 2: Redaction density
  const { count: redactionCount } = await supabase
    .from('redactions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)

  // Person-name redactions score higher
  const { count: personRedactionCount } = await supabase
    .from('redactions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .eq('redaction_type', 'person_name')

  const totalRedactions = redactionCount ?? 0
  const personRedactions = personRedactionCount ?? 0
  // Weight person redactions 2x
  const redactionDensity = Math.min(1.0, (totalRedactions + personRedactions) / 20)

  // Layer 3: Name proximity (redacted names near crime verbs)
  const { score: nameProximityScore, matchCount: proximityMatches } =
    computeNameProximityScore(ocrText)

  // Layer 4: Government official cross-reference
  const { data: entityMentions } = await supabase
    .from('entity_mentions')
    .select('entities(name)')
    .eq('document_id', documentId)

  const mentionedOfficials: string[] = []
  for (const mention of entityMentions || []) {
    const name = (mention as any).entities?.name
    if (name && OFFICIAL_NAMES_SET.has(name.toLowerCase())) {
      mentionedOfficials.push(name)
    }
  }
  const officialBonus = Math.min(0.2, mentionedOfficials.length * 0.05)

  // Composite formula
  const revealScore =
    keywordScore * 0.3 +
    redactionDensity * 0.4 +
    nameProximityScore * 0.3 +
    officialBonus

  const clampedScore = Math.min(1.0, Math.max(0.0, revealScore))

  // Store score
  const existingMetadata = ((doc as any).metadata as Record<string, unknown>) || {}
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      congressional_priority_score: clampedScore,
      metadata: {
        ...existingMetadata,
        congressional_scoring: {
          keyword_score: keywordScore,
          keyword_matches: keywordMatches,
          redaction_density: redactionDensity,
          total_redactions: totalRedactions,
          person_redactions: personRedactions,
          name_proximity_score: nameProximityScore,
          proximity_matches: proximityMatches,
          mentioned_officials: mentionedOfficials,
          official_bonus: officialBonus,
          composite_score: clampedScore,
          scored_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update congressional score: ${updateError.message}`)
  }

  console.log(
    `[CongressionalScore] Document ${documentId}: score=${clampedScore.toFixed(3)} ` +
    `(kw=${keywordScore.toFixed(2)}, redact=${redactionDensity.toFixed(2)}, ` +
    `prox=${nameProximityScore.toFixed(2)}, officials=${mentionedOfficials.length})`
  )
}
