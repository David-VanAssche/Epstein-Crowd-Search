// lib/pipeline/services/person-categorizer.ts
// Batch LLM classification of person entities into sub-categories.
// Uses Gemini Flash to classify ~20 persons per API call for efficiency.

import { SupabaseClient } from '@supabase/supabase-js'
import type { PersonCategory } from '@/types/structured-data'

const GEMINI_MODEL = 'gemini-2.0-flash'
const BATCH_SIZE = 20

const VALID_CATEGORIES: PersonCategory[] = [
  'associate', 'business_leader', 'celebrity', 'diplomat', 'educator',
  'intelligence', 'legal', 'media', 'medical', 'military',
  'politician', 'royalty', 'staff', 'victim', 'other',
]

interface CategorizationResult {
  entity_id: string
  category: PersonCategory
  confidence: number
}

const SYSTEM_PROMPT = `You are classifying people mentioned in the Epstein Crowd Research archive. For each person, assign ONE category from this list:

- associate: Close personal associate or friend of Jeffrey Epstein or Ghislaine Maxwell
- business_leader: CEO, executive, or prominent businessperson
- celebrity: Actor, musician, athlete, or other public figure from entertainment/sports
- diplomat: Ambassador, consul, or diplomatic official
- educator: Professor, teacher, university administrator
- intelligence: CIA, FBI, MI6, Mossad, or other intelligence agency personnel
- legal: Lawyer, judge, prosecutor, law enforcement officer
- media: Journalist, editor, news anchor, media executive
- medical: Doctor, nurse, psychiatrist, or medical professional
- military: Active or retired military personnel
- politician: Elected official, political appointee, or government official
- royalty: Royal family member, nobility, or aristocracy
- staff: Employee, housekeeper, pilot, driver, personal assistant
- victim: Known or alleged victim
- other: Does not fit any above category

Respond with a JSON array. Each element: { "name": "...", "category": "...", "confidence": 0.0-1.0 }
Only use categories from the list above. If uncertain, use "other" with low confidence.`

export class PersonCategorizerService {
  private apiKey: string
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient, apiKey?: string) {
    this.supabase = supabase
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || ''
    if (!this.apiKey) throw new Error('[PersonCategorizer] GEMINI_API_KEY required')
  }

  async categorizeAll(options: {
    limit?: number
    dryRun?: boolean
    overwrite?: boolean
  } = {}): Promise<{ categorized: number; failed: number; skipped: number }> {
    const { limit, dryRun = false, overwrite = false } = options

    // Fetch uncategorized person entities
    let query = this.supabase
      .from('entities')
      .select('id, name, aliases, description, metadata')
      .eq('entity_type', 'person')
      .order('mention_count', { ascending: false })

    if (!overwrite) {
      query = query.is('category', null)
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data: persons, error } = await query
    if (error) throw new Error(`[PersonCategorizer] Query failed: ${error.message}`)
    if (!persons || persons.length === 0) {
      console.log('[PersonCategorizer] No uncategorized persons found')
      return { categorized: 0, failed: 0, skipped: 0 }
    }

    console.log(`[PersonCategorizer] Processing ${persons.length} persons in batches of ${BATCH_SIZE}`)

    let categorized = 0
    let failed = 0
    let skipped = 0

    for (let i = 0; i < persons.length; i += BATCH_SIZE) {
      const batch = persons.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(persons.length / BATCH_SIZE)

      console.log(`[PersonCategorizer] Batch ${batchNum}/${totalBatches} (${batch.length} persons)`)

      try {
        const results = await this.categorizeBatch(batch)

        if (dryRun) {
          for (const r of results) {
            const person = batch.find((p: any) => p.id === r.entity_id)
            console.log(`  [DRY RUN] ${person?.name} → ${r.category} (${(r.confidence * 100).toFixed(0)}%)`)
          }
          skipped += results.length
          continue
        }

        // Update entities with categories
        for (const result of results) {
          const { error: updateError } = await this.supabase
            .from('entities')
            .update({
              category: result.category,
              metadata: {
                ...(batch.find((p: any) => p.id === result.entity_id) as any)?.metadata,
                category_confidence: result.confidence,
                categorized_at: new Date().toISOString(),
              },
            })
            .eq('id', result.entity_id)

          if (updateError) {
            console.error(`[PersonCategorizer] Failed to update ${result.entity_id}: ${updateError.message}`)
            failed++
          } else {
            categorized++
          }
        }
      } catch (err) {
        console.error(`[PersonCategorizer] Batch ${batchNum} failed:`, err)
        failed += batch.length
      }

      // Rate limit: ~1 req/s
      if (i + BATCH_SIZE < persons.length) {
        await new Promise((r) => setTimeout(r, 1200))
      }
    }

    console.log(`[PersonCategorizer] Done: ${categorized} categorized, ${failed} failed, ${skipped} skipped`)
    return { categorized, failed, skipped }
  }

  private async categorizeBatch(
    persons: Array<{ id: string; name: string; aliases: string[]; description: string | null }>
  ): Promise<CategorizationResult[]> {
    const personList = persons
      .map((p, i) => `${i + 1}. "${p.name}"${p.aliases?.length ? ` (aliases: ${p.aliases.join(', ')})` : ''}${p.description ? ` — ${p.description.slice(0, 100)}` : ''}`)
      .join('\n')

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nClassify these persons:\n${personList}` }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty Gemini response')

    const parsed: Array<{ name: string; category: string; confidence: number }> = JSON.parse(text)

    // Map results back to entity IDs
    const results: CategorizationResult[] = []
    for (const item of parsed) {
      const person = persons.find(
        (p) => p.name.toLowerCase() === item.name.toLowerCase()
      )
      if (!person) continue

      const category = VALID_CATEGORIES.includes(item.category as PersonCategory)
        ? (item.category as PersonCategory)
        : 'other'

      results.push({
        entity_id: person.id,
        category,
        confidence: Math.max(0, Math.min(1, item.confidence || 0.5)),
      })
    }

    return results
  }
}

/** Pipeline stage handler */
export async function handlePersonCategorize(
  documentId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  // Person categorization is a batch operation, not per-document.
  // This handler is a no-op when called per-document.
  // Use scripts/batch/categorize-persons.ts for batch categorization.
  return { success: true }
}
