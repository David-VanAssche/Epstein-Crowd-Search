import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

async function check() {
  // Datasets
  const { data: ds } = await sb.from('datasets').select('dataset_number, name, page_count, file_count').order('dataset_number')
  console.log('=== DATASETS ===')
  for (const d of (ds || []) as any[]) {
    console.log(`  DS${d.dataset_number}: ${d.page_count?.toLocaleString()} pages, ${d.file_count?.toLocaleString()} files`)
  }

  // Documents
  const { count: docCount } = await sb.from('documents').select('id', { count: 'exact', head: true })
  console.log(`\nDOCUMENTS: ${(docCount || 0).toLocaleString()} rows`)

  // Data sources
  const { count: srcCount } = await sb.from('data_sources').select('id', { count: 'exact', head: true })
  console.log(`DATA SOURCES: ${(srcCount || 0).toLocaleString()} rows`)

  // Entities
  const { count: entCount } = await sb.from('entities').select('id', { count: 'exact', head: true })
  console.log(`ENTITIES: ${(entCount || 0).toLocaleString()} rows`)

  // Chunks
  const { count: chunkCount } = await sb.from('chunks').select('id', { count: 'exact', head: true })
  console.log(`CHUNKS: ${(chunkCount || 0).toLocaleString()} rows`)

  // Entity mentions
  const { count: mentionCount } = await sb.from('entity_mentions').select('id', { count: 'exact', head: true })
  console.log(`ENTITY_MENTIONS: ${(mentionCount || 0).toLocaleString()} rows`)

  // Relationships
  const { count: relCount } = await sb.from('entity_relationships').select('id', { count: 'exact', head: true })
  console.log(`ENTITY_RELATIONSHIPS: ${(relCount || 0).toLocaleString()} rows`)

  // Flights
  const { count: flightCount } = await sb.from('flights').select('id', { count: 'exact', head: true })
  console.log(`FLIGHTS: ${(flightCount || 0).toLocaleString()} rows`)

  // Emails
  const { count: emailCount } = await sb.from('emails').select('id', { count: 'exact', head: true })
  console.log(`EMAILS: ${(emailCount || 0).toLocaleString()} rows`)

  // Financial transactions
  const { count: finCount } = await sb.from('financial_transactions').select('id', { count: 'exact', head: true })
  console.log(`FINANCIAL_TRANSACTIONS: ${(finCount || 0).toLocaleString()} rows`)

  // Corpus totals (RPC)
  const { data: totals, error: totalsErr } = await sb.rpc('corpus_totals')
  if (totalsErr) {
    console.log(`\nCORPUS TOTALS RPC: ${totalsErr.message}`)
  } else if (totals && (totals as any[])[0]) {
    const t = (totals as any[])[0]
    console.log(`\n=== CORPUS TOTALS (from RPC) ===`)
    console.log(`  Documents: ${t.total_documents}`)
    console.log(`  Pages: ${t.total_pages}`)
    console.log(`  Images: ${t.total_images}`)
    console.log(`  Videos: ${t.total_videos}`)
    console.log(`  Audio: ${t.total_audio}`)
  }

  // Pipeline stage counts (RPC)
  const { data: stages, error: stagesErr } = await sb.rpc('pipeline_stage_counts')
  if (stagesErr) {
    console.log(`\nPIPELINE STAGES RPC: ${stagesErr.message}`)
  } else {
    console.log(`\n=== PIPELINE STAGE COUNTS ===`)
    for (const s of (stages as any[]) || []) {
      console.log(`  ${s.stage}: ${s.completed_count}/${s.total_count}`)
    }
  }
}

check().catch(console.error)
