import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface DataSource {
  name: string
  source_type: 'government' | 'court' | 'law_enforcement' | 'public_record' | 'media'
  url: string | null
  description: string
  data_type: 'documents' | 'court_filings' | 'records' | 'structured'
  status: 'pending' | 'ingested' | 'partial'
  expected_count: number
  ingested_count: number
  failed_count: number
  priority: number
  ingested_at: string | null
}

// These are the actual authoritative sources of the documents —
// NOT the GitHub repos or torrents where copies were downloaded from.
const sources: DataSource[] = [
  {
    name: 'DOJ FOIA Release (Datasets 1–12)',
    source_type: 'government',
    url: 'https://www.justice.gov/usao-sdfl/jeffrey-epstein-documents',
    description: 'DOJ EFTA production — 2,731,789 Bates-stamped pages across 12 sequential datasets released under FOIA. Includes FBI interviews, grand jury exhibits, financial records, correspondence, photographs, and multimedia files.',
    data_type: 'documents',
    status: 'ingested',
    expected_count: 2731789,
    ingested_count: 2731789,
    failed_count: 0,
    priority: 10,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'Giuffre v. Maxwell (Case 15-cv-07433)',
    source_type: 'court',
    url: 'https://www.courtlistener.com/docket/4355835/giuffre-v-maxwell/',
    description: 'Unsealed civil lawsuit documents from Virginia Giuffre v. Ghislaine Maxwell. Includes depositions, flight logs, address books, and exhibits released in January 2024.',
    data_type: 'court_filings',
    status: 'ingested',
    expected_count: 3,
    ingested_count: 3,
    failed_count: 0,
    priority: 9,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'USVI v. JPMorgan Chase',
    source_type: 'court',
    url: null,
    description: 'Exhibits from the US Virgin Islands lawsuit against JPMorgan Chase for facilitating Epstein\'s operations. Financial records and internal bank communications.',
    data_type: 'court_filings',
    status: 'ingested',
    expected_count: 199,
    ingested_count: 199,
    failed_count: 0,
    priority: 8,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'Florida v. Epstein (Palm Beach County)',
    source_type: 'court',
    url: null,
    description: 'State of Florida criminal case filings from Palm Beach County. Includes the controversial 2008 Non-Prosecution Agreement and related proceedings.',
    data_type: 'court_filings',
    status: 'ingested',
    expected_count: 99,
    ingested_count: 99,
    failed_count: 0,
    priority: 8,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'United States v. Maxwell (Case 20-cr-330)',
    source_type: 'court',
    url: 'https://www.courtlistener.com/docket/17318376/united-states-v-maxwell/',
    description: 'Criminal trial documents from the federal prosecution of Ghislaine Maxwell. Trial exhibits, motions, and sentencing materials.',
    data_type: 'court_filings',
    status: 'ingested',
    expected_count: 3,
    ingested_count: 3,
    failed_count: 0,
    priority: 8,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'DOJ Office of Inspector General Report',
    source_type: 'government',
    url: 'https://oig.justice.gov/',
    description: 'DOJ OIG investigation report on the circumstances surrounding Jeffrey Epstein\'s death at MCC New York (June 2023).',
    data_type: 'documents',
    status: 'ingested',
    expected_count: 1,
    ingested_count: 1,
    failed_count: 0,
    priority: 7,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'DOJ Office of Professional Responsibility Report',
    source_type: 'government',
    url: null,
    description: 'DOJ OPR investigation into the handling of the 2008 Non-Prosecution Agreement by then-US Attorney Alexander Acosta.',
    data_type: 'documents',
    status: 'ingested',
    expected_count: 1,
    ingested_count: 1,
    failed_count: 0,
    priority: 7,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'Palm Beach Police Department Records',
    source_type: 'law_enforcement',
    url: null,
    description: 'Palm Beach PD investigation files from the original 2005-2006 investigation into Epstein, obtained via public records requests.',
    data_type: 'records',
    status: 'ingested',
    expected_count: 1,
    ingested_count: 1,
    failed_count: 0,
    priority: 7,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'FAA Flight Records (Lolita Express)',
    source_type: 'public_record',
    url: null,
    description: 'Flight logs and manifests for aircraft registered to Jeffrey Epstein and associated entities, sourced from FAA records and court exhibits.',
    data_type: 'structured',
    status: 'ingested',
    expected_count: 1,
    ingested_count: 1,
    failed_count: 0,
    priority: 9,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'Epstein Address Book ("Black Book")',
    source_type: 'court',
    url: null,
    description: 'Jeffrey Epstein\'s personal address book entered as evidence in court proceedings. Contains names, phone numbers, and addresses of contacts.',
    data_type: 'structured',
    status: 'ingested',
    expected_count: 6,
    ingested_count: 6,
    failed_count: 0,
    priority: 9,
    ingested_at: new Date().toISOString(),
  },
  {
    name: 'DocumentCloud Public Collections',
    source_type: 'media',
    url: 'https://www.documentcloud.org',
    description: 'Public document collections hosted on DocumentCloud by journalists covering the Epstein case. Includes MCC records, NPA documents, and supplemental DOJ releases.',
    data_type: 'documents',
    status: 'ingested',
    expected_count: 12,
    ingested_count: 12,
    failed_count: 0,
    priority: 6,
    ingested_at: new Date().toISOString(),
  },
]

async function seedDataSources() {
  console.log('Seeding data_sources table with authoritative document sources...\n')

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

  // Also clean up any old community-source rows from previous seeds
  const oldNames = [
    's0fskr1p', 'benbaessler', 'erikveland', 'epstein-docs', 'markramm',
    'phelix-epstein-network', 'lmsband', 'maxandrews', 'rhowardstone',
    'yung-megafone', 'jazivxt', 'linogova', 'elderemo-index', 'muneeb-emails',
    'svetfm-fbi', 'svetfm-nov11', 'teyler-20k', 'zenodo', 'blackbook',
    'epstein-exposed', 'archive-flights', 'documentcloud', 'epsteininvestigation-org',
    'notesbymurk',
  ]
  await supabase.from('data_sources').delete().in('name', oldNames)

  console.log('Cleared existing rows\n')

  // Insert all sources
  const { data, error } = await supabase.from('data_sources').insert(sources).select()

  if (error) {
    console.error('Error inserting sources:', error)
    process.exit(1)
  }

  console.log(`Successfully seeded ${data?.length} authoritative data sources\n`)

  // Summary
  for (const s of sources) {
    const countStr = s.expected_count > 1000
      ? s.expected_count.toLocaleString() + ' pages'
      : s.expected_count + ' files'
    console.log(`  [${s.status.toUpperCase().padEnd(8)}] ${s.name} (${countStr})`)
  }

  const totalPages = sources.reduce((sum, s) => sum + s.expected_count, 0)
  console.log(`\nTotal: ${totalPages.toLocaleString()} items across ${sources.length} sources`)
}

seedDataSources().catch(console.error)
