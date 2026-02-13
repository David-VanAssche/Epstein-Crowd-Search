// scripts/batch/enrich-wikidata.ts
// Enrich entity records with Wikidata data (photos, birth/death dates, nationality, occupation).
// Uses SPARQL queries against Wikidata Query Service — rate limited to ~1 req/1.2s.
// Usage: npx tsx scripts/batch/enrich-wikidata.ts [--limit N] [--dry-run] [--min-mentions N]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql'
const RATE_LIMIT_MS = 1200
const USER_AGENT = 'EpsteinCrowdResearchBot/1.0 (research project; mailto:admin@epsteincrowdresearch.com)'

// --- Parse CLI args ---
const args = process.argv.slice(2)
const limitIdx = args.indexOf('--limit')
const minMentionsIdx = args.indexOf('--min-mentions')
const dryRun = args.includes('--dry-run')
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 100
const minMentions = minMentionsIdx !== -1 ? parseInt(args[minMentionsIdx + 1], 10) : 5

// --- Environment validation ---
const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

interface WikidataResult {
  wikidata_id: string
  photo_url: string | null
  birth_date: string | null
  death_date: string | null
  nationality: string[]
  occupation: string[]
}

async function searchWikidata(name: string, aliases: string[]): Promise<WikidataResult | null> {
  // First, search for the entity by name
  const searchNames = [name, ...aliases].slice(0, 3)

  for (const searchName of searchNames) {
    const result = await queryWikidataByName(searchName)
    if (result) return result
  }

  return null
}

async function queryWikidataByName(name: string): Promise<WikidataResult | null> {
  // Use Wikidata search API to find the entity ID first
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=3&format=json`

  const searchRes = await fetch(searchUrl, {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!searchRes.ok) return null
  const searchData = await searchRes.json()

  const candidates = searchData.search || []
  if (candidates.length === 0) return null

  // Filter to humans (instance of Q5)
  for (const candidate of candidates) {
    const qid = candidate.id
    const result = await fetchWikidataDetails(qid)
    if (result) return result
  }

  return null
}

async function fetchWikidataDetails(qid: string): Promise<WikidataResult | null> {
  const sparql = `
    SELECT ?item ?image ?birthDate ?deathDate
      (GROUP_CONCAT(DISTINCT ?nationalityLabel; SEPARATOR=", ") AS ?nationalities)
      (GROUP_CONCAT(DISTINCT ?occupationLabel; SEPARATOR=", ") AS ?occupations)
    WHERE {
      BIND(wd:${qid} AS ?item)
      ?item wdt:P31 wd:Q5 .  # Must be human
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P569 ?birthDate . }
      OPTIONAL { ?item wdt:P570 ?deathDate . }
      OPTIONAL {
        ?item wdt:P27 ?nationality .
        ?nationality rdfs:label ?nationalityLabel .
        FILTER(LANG(?nationalityLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P106 ?occupation .
        ?occupation rdfs:label ?occupationLabel .
        FILTER(LANG(?occupationLabel) = "en")
      }
    }
    GROUP BY ?item ?image ?birthDate ?deathDate
    LIMIT 1
  `

  const sparqlRes = await fetch(
    `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparql)}&format=json`,
    { headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' } }
  )

  if (!sparqlRes.ok) return null
  const sparqlData = await sparqlRes.json()
  const bindings = sparqlData.results?.bindings
  if (!bindings || bindings.length === 0) return null

  const row = bindings[0]

  const nationalities = row.nationalities?.value
    ? row.nationalities.value.split(', ').filter(Boolean)
    : []
  const occupations = row.occupations?.value
    ? row.occupations.value.split(', ').filter(Boolean)
    : []

  return {
    wikidata_id: qid,
    photo_url: row.image?.value || null,
    birth_date: row.birthDate?.value?.slice(0, 10) || null,
    death_date: row.deathDate?.value?.slice(0, 10) || null,
    nationality: nationalities,
    occupation: occupations,
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('[Wikidata] Starting entity enrichment')
  console.log(`[Wikidata] Limit: ${limit}, Min mentions: ${minMentions}`)
  if (dryRun) console.log('[Wikidata] DRY RUN — no database updates')

  // Fetch person entities without wikidata_id, ordered by mention count
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, aliases, mention_count')
    .eq('entity_type', 'person')
    .is('wikidata_id', null)
    .gte('mention_count', minMentions)
    .order('mention_count', { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`[Wikidata] Query failed: ${error.message}`)
    process.exit(1)
  }

  if (!entities || entities.length === 0) {
    console.log('[Wikidata] No entities to enrich. Done.')
    return
  }

  console.log(`[Wikidata] Processing ${entities.length} entities...`)

  let enriched = 0
  let notFound = 0
  let failed = 0

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i]
    console.log(`[Wikidata] (${i + 1}/${entities.length}) ${entity.name} (${entity.mention_count} mentions)`)

    try {
      const result = await searchWikidata(entity.name, entity.aliases || [])

      if (!result) {
        console.log(`  → Not found on Wikidata`)
        notFound++

        if (!dryRun) {
          // Mark as searched to avoid re-querying
          await supabase
            .from('entities')
            .update({ wikidata_id: 'NOT_FOUND' })
            .eq('id', entity.id)
        }
      } else {
        console.log(`  → ${result.wikidata_id}${result.photo_url ? ' (has photo)' : ''}${result.birth_date ? ` born ${result.birth_date}` : ''}`)

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('entities')
            .update({
              wikidata_id: result.wikidata_id,
              photo_url: result.photo_url,
              birth_date: result.birth_date,
              death_date: result.death_date,
              nationality: result.nationality,
              occupation: result.occupation,
            })
            .eq('id', entity.id)

          if (updateError) {
            console.error(`  → Update failed: ${updateError.message}`)
            failed++
          } else {
            enriched++
          }
        } else {
          enriched++
        }
      }
    } catch (err) {
      console.error(`  → Error: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }

    // Rate limit
    if (i < entities.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
    }
  }

  console.log(`\n[Wikidata] Complete: ${enriched} enriched, ${notFound} not found, ${failed} failed`)
}

main().catch((err) => {
  console.error('[Wikidata] Fatal error:', err)
  process.exit(1)
})
