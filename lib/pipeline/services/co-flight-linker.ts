// lib/pipeline/services/co-flight-linker.ts
// Stage 15: Generate traveled_with relationships from shared flights
// and communicated_with from email co-occurrence.

import { SupabaseClient } from '@supabase/supabase-js'

interface EntityPair {
  entity_a_id: string
  entity_b_id: string
  co_occurrence_count: number
  evidence_document_ids: string[]
}

export class CoFlightLinkerService {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async generateAllLinks(options: {
    dryRun?: boolean
  } = {}): Promise<{
    traveledWith: number
    communicatedWith: number
    failed: number
  }> {
    const { dryRun = false } = options

    console.log('[CoFlightLinker] Starting link generation')
    if (dryRun) console.log('[CoFlightLinker] DRY RUN')

    let traveledWith = 0
    let communicatedWith = 0
    let failed = 0

    // --- Phase 1: Flight co-occurrence ---
    try {
      const flightPairs = await this.findFlightCoOccurrences()
      console.log(`[CoFlightLinker] Found ${flightPairs.length} flight co-occurrence pairs`)

      if (!dryRun) {
        for (const pair of flightPairs) {
          try {
            await this.upsertRelationship(pair, 'traveled_with')
            traveledWith++
          } catch (err) {
            console.warn(`[CoFlightLinker] Failed to upsert traveled_with: ${err}`)
            failed++
          }
        }
      } else {
        traveledWith = flightPairs.length
      }
    } catch (err) {
      console.error('[CoFlightLinker] Flight co-occurrence error:', err)
    }

    // --- Phase 2: Email co-occurrence ---
    try {
      const emailPairs = await this.findEmailCoOccurrences()
      console.log(`[CoFlightLinker] Found ${emailPairs.length} email co-occurrence pairs`)

      if (!dryRun) {
        for (const pair of emailPairs) {
          try {
            await this.upsertRelationship(pair, 'communicated_with')
            communicatedWith++
          } catch (err) {
            console.warn(`[CoFlightLinker] Failed to upsert communicated_with: ${err}`)
            failed++
          }
        }
      } else {
        communicatedWith = emailPairs.length
      }
    } catch (err) {
      console.error('[CoFlightLinker] Email co-occurrence error:', err)
    }

    console.log(`[CoFlightLinker] Done: ${traveledWith} traveled_with, ${communicatedWith} communicated_with, ${failed} failed`)
    return { traveledWith, communicatedWith, failed }
  }

  private async findFlightCoOccurrences(): Promise<EntityPair[]> {
    // Find pairs of entities that appear in the same flight manifest documents
    const { data, error } = await this.supabase.rpc('find_flight_co_occurrences')

    if (error) {
      // Fallback: do it in application code
      console.log('[CoFlightLinker] RPC not available, computing in app...')
      return this.computeFlightCoOccurrencesInApp()
    }

    return (data || []).map((row: any) => ({
      entity_a_id: row.entity_a_id,
      entity_b_id: row.entity_b_id,
      co_occurrence_count: row.co_occurrence_count,
      evidence_document_ids: row.evidence_document_ids,
    }))
  }

  private async computeFlightCoOccurrencesInApp(): Promise<EntityPair[]> {
    // Get all flight manifest documents and their entity mentions
    const { data: flights } = await this.supabase
      .from('structured_data_extractions')
      .select('id, document_id')
      .eq('extraction_type', 'flight_manifest')

    if (!flights || flights.length === 0) return []

    const docIds = flights.map((f: any) => f.document_id)

    // Get entity mentions for these documents
    const { data: mentions } = await this.supabase
      .from('entity_mentions')
      .select('entity_id, document_id')
      .in('document_id', docIds)

    if (!mentions || mentions.length === 0) return []

    // Group by document
    const docEntities = new Map<string, Set<string>>()
    for (const m of mentions) {
      const docId = (m as any).document_id
      if (!docEntities.has(docId)) docEntities.set(docId, new Set())
      docEntities.get(docId)!.add((m as any).entity_id)
    }

    // Generate pairs
    const pairMap = new Map<string, EntityPair>()
    for (const [docId, entities] of docEntities) {
      const entityList = Array.from(entities)
      for (let i = 0; i < entityList.length; i++) {
        for (let j = i + 1; j < entityList.length; j++) {
          const [a, b] = [entityList[i], entityList[j]].sort()
          const key = `${a}:${b}`
          if (!pairMap.has(key)) {
            pairMap.set(key, {
              entity_a_id: a,
              entity_b_id: b,
              co_occurrence_count: 0,
              evidence_document_ids: [],
            })
          }
          const pair = pairMap.get(key)!
          pair.co_occurrence_count++
          if (!pair.evidence_document_ids.includes(docId)) {
            pair.evidence_document_ids.push(docId)
          }
        }
      }
    }

    return Array.from(pairMap.values())
  }

  private async findEmailCoOccurrences(): Promise<EntityPair[]> {
    // Find pairs of entities that exchange emails
    const { data: emails } = await this.supabase
      .from('emails')
      .select('from_entity_id, to_entity_ids, cc_entity_ids, document_id')
      .not('from_entity_id', 'is', null)

    if (!emails || emails.length === 0) return []

    const pairMap = new Map<string, EntityPair>()

    for (const email of emails) {
      const fromId = (email as any).from_entity_id
      if (!fromId) continue

      const toIds: string[] = [
        ...((email as any).to_entity_ids || []),
        ...((email as any).cc_entity_ids || []),
      ].filter((id: string) => id && id !== fromId)

      for (const toId of toIds) {
        const [a, b] = [fromId, toId].sort()
        const key = `${a}:${b}`
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            entity_a_id: a,
            entity_b_id: b,
            co_occurrence_count: 0,
            evidence_document_ids: [],
          })
        }
        const pair = pairMap.get(key)!
        pair.co_occurrence_count++
        const docId = (email as any).document_id
        if (docId && !pair.evidence_document_ids.includes(docId)) {
          pair.evidence_document_ids.push(docId)
        }
      }
    }

    return Array.from(pairMap.values())
  }

  private async upsertRelationship(pair: EntityPair, type: string): Promise<void> {
    // Normalize strength: max co-occurrence across all pairs would be 1.0
    // Use log scale: strength = min(10, 1 + ln(count))
    const strength = Math.min(10, 1 + Math.log(pair.co_occurrence_count))

    const { error } = await this.supabase
      .from('entity_relationships')
      .upsert(
        {
          entity_a_id: pair.entity_a_id,
          entity_b_id: pair.entity_b_id,
          relationship_type: type,
          strength,
          evidence_document_ids: pair.evidence_document_ids.slice(0, 50),
          description: `Co-occurred in ${pair.co_occurrence_count} ${type === 'traveled_with' ? 'flights' : 'email exchanges'}`,
          metadata: { co_occurrence_count: pair.co_occurrence_count },
        },
        { onConflict: 'entity_a_id,entity_b_id,relationship_type' }
      )

    if (error) throw error
  }
}

/** Pipeline stage handler (no-op per-document — use CoFlightLinkerService.generateAllLinks() for batch) */
export async function handleCoFlightLinks(
  _documentId: string,
  _supabase: SupabaseClient
): Promise<void> {
  // Co-flight links are a batch operation across all flights, not per-document
}
