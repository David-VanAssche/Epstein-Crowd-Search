import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface DataSource {
  name: string
  source_type: 'github' | 'huggingface' | 'kaggle' | 'web' | 'archive' | 'torrent'
  url: string | null
  data_type: 'ocr' | 'embeddings' | 'entities' | 'chunks' | 'structured' | 'raw'
  status: 'pending' | 'ingested' | 'partial'
  expected_count: number
  ingested_count: number
  failed_count: number
  priority: number
  ingested_at: string | null
}

const sources: DataSource[] = [
  { name: 's0fskr1p', source_type: 'github', url: 'https://github.com/s0fskr1p/Epstein-Files-OCR', data_type: 'ocr', status: 'partial', expected_count: 1644, ingested_count: 1643, failed_count: 1, priority: 8, ingested_at: new Date().toISOString() },
  { name: 'benbaessler', source_type: 'github', url: 'https://github.com/benbaessler/epstein-files', data_type: 'chunks', status: 'partial', expected_count: 23225, ingested_count: 23224, failed_count: 1, priority: 6, ingested_at: new Date().toISOString() },
  { name: 'erikveland', source_type: 'github', url: 'https://github.com/erikveland/Epstein-Files', data_type: 'entities', status: 'partial', expected_count: 29341, ingested_count: 25235, failed_count: 4106, priority: 10, ingested_at: new Date().toISOString() },
  { name: 'epstein-docs', source_type: 'github', url: 'https://github.com/epstein-docs/epstein-files', data_type: 'entities', status: 'partial', expected_count: 29525, ingested_count: 29522, failed_count: 3, priority: 10, ingested_at: new Date().toISOString() },
  { name: 'markramm', source_type: 'github', url: 'https://github.com/markramm/Epstein-files', data_type: 'raw', status: 'ingested', expected_count: 2915, ingested_count: 2915, failed_count: 0, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'phelix-epstein-network', source_type: 'github', url: 'https://github.com/phelix/epstein-network', data_type: 'structured', status: 'ingested', expected_count: 100, ingested_count: 100, failed_count: 0, priority: 5, ingested_at: new Date().toISOString() },
  { name: 'lmsband', source_type: 'github', url: 'https://github.com/lmsband/EpsteinFiles', data_type: 'entities', status: 'ingested', expected_count: 21, ingested_count: 21, failed_count: 0, priority: 10, ingested_at: new Date().toISOString() },
  { name: 'maxandrews', source_type: 'github', url: 'https://github.com/maxandrews/epstein-data', data_type: 'raw', status: 'partial', expected_count: 29823, ingested_count: 29821, failed_count: 2, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'rhowardstone', source_type: 'github', url: 'https://github.com/rhowardstone/Epstein-research', data_type: 'raw', status: 'ingested', expected_count: 3000, ingested_count: 3000, failed_count: 0, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'yung-megafone', source_type: 'github', url: 'https://github.com/yung-megafone/Jeffrey-Epstein-Files', data_type: 'raw', status: 'ingested', expected_count: 37, ingested_count: 37, failed_count: 0, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'jazivxt', source_type: 'kaggle', url: 'https://www.kaggle.com/datasets/jazivxt/epstein-files', data_type: 'raw', status: 'partial', expected_count: 26066, ingested_count: 26063, failed_count: 3, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'linogova', source_type: 'kaggle', url: 'https://www.kaggle.com/datasets/linogova/jeffrey-epstein-files', data_type: 'raw', status: 'ingested', expected_count: 28, ingested_count: 28, failed_count: 0, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'elderemo-index', source_type: 'huggingface', url: 'https://huggingface.co/datasets/elderemo/epstein-index', data_type: 'structured', status: 'ingested', expected_count: 7, ingested_count: 7, failed_count: 0, priority: 5, ingested_at: new Date().toISOString() },
  { name: 'muneeb-emails', source_type: 'huggingface', url: 'https://huggingface.co/datasets/muneeb/epstein-emails', data_type: 'structured', status: 'ingested', expected_count: 100, ingested_count: 100, failed_count: 0, priority: 5, ingested_at: new Date().toISOString() },
  { name: 'svetfm-fbi', source_type: 'huggingface', url: 'https://huggingface.co/datasets/svetfm/epstein-fbi', data_type: 'chunks', status: 'partial', expected_count: 133, ingested_count: 131, failed_count: 2, priority: 6, ingested_at: new Date().toISOString() },
  { name: 'svetfm-nov11', source_type: 'huggingface', url: 'https://huggingface.co/datasets/svetfm/epstein-nov11', data_type: 'chunks', status: 'ingested', expected_count: 7, ingested_count: 7, failed_count: 0, priority: 6, ingested_at: new Date().toISOString() },
  { name: 'teyler-20k', source_type: 'huggingface', url: 'https://huggingface.co/datasets/teyler/epstein-20k', data_type: 'chunks', status: 'pending', expected_count: 12, ingested_count: 0, failed_count: 0, priority: 6, ingested_at: null },
  { name: 'zenodo', source_type: 'archive', url: 'https://zenodo.org/records/18512562', data_type: 'raw', status: 'partial', expected_count: 3957, ingested_count: 3956, failed_count: 1, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'blackbook', source_type: 'web', url: null, data_type: 'structured', status: 'ingested', expected_count: 6, ingested_count: 6, failed_count: 0, priority: 5, ingested_at: new Date().toISOString() },
  { name: 'epstein-exposed', source_type: 'web', url: 'https://epstein-exposed.com', data_type: 'structured', status: 'ingested', expected_count: 1426, ingested_count: 1426, failed_count: 0, priority: 5, ingested_at: new Date().toISOString() },
  { name: 'archive-flights', source_type: 'web', url: 'https://archive.org', data_type: 'structured', status: 'ingested', expected_count: 1, ingested_count: 1, failed_count: 0, priority: 5, ingested_at: new Date().toISOString() },
  { name: 'documentcloud', source_type: 'web', url: 'https://www.documentcloud.org', data_type: 'raw', status: 'ingested', expected_count: 12, ingested_count: 12, failed_count: 0, priority: 1, ingested_at: new Date().toISOString() },
  { name: 'epsteininvestigation-org', source_type: 'web', url: 'https://epsteininvestigation.org', data_type: 'entities', status: 'ingested', expected_count: 22000, ingested_count: 22000, failed_count: 0, priority: 10, ingested_at: new Date().toISOString() },
  { name: 'notesbymurk', source_type: 'github', url: null, data_type: 'raw', status: 'ingested', expected_count: 7, ingested_count: 7, failed_count: 0, priority: 1, ingested_at: new Date().toISOString() },
]

async function seedDataSources() {
  console.log('Seeding data_sources table...\n')

  // Delete only the sources we're about to re-seed (safe: won't touch manually-added rows)
  const sourceNames = sources.map(s => s.name)
  const { error: deleteError } = await supabase
    .from('data_sources')
    .delete()
    .in('name', sourceNames)

  if (deleteError) {
    console.error('Error deleting existing rows:', deleteError)
    process.exit(1)
  }

  console.log('Cleared existing rows\n')

  // Insert all sources
  const { data, error } = await supabase.from('data_sources').insert(sources).select()

  if (error) {
    console.error('Error inserting sources:', error)
    process.exit(1)
  }

  console.log(`Successfully seeded ${data?.length} data sources\n`)

  // Summary
  const byStatus = sources.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc }, {} as Record<string, number>)
  const byType = sources.reduce((acc, s) => { acc[s.data_type] = (acc[s.data_type] || 0) + 1; return acc }, {} as Record<string, number>)
  const totalExpected = sources.reduce((sum, s) => sum + s.expected_count, 0)
  const totalIngested = sources.reduce((sum, s) => sum + s.ingested_count, 0)
  const totalFailed = sources.reduce((sum, s) => sum + s.failed_count, 0)

  console.log('By status:', byStatus)
  console.log('By type:', byType)
  console.log(`\nTotals: ${totalExpected.toLocaleString()} expected, ${totalIngested.toLocaleString()} ingested, ${totalFailed.toLocaleString()} failed`)
  console.log(`Success rate: ${((totalIngested / totalExpected) * 100).toFixed(2)}%`)
}

seedDataSources().catch(console.error)
