import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const datasets = [
  {
    dataset_number: 1,
    name: 'Dataset 1',
    description: 'EFTA00000001 – EFTA00003158. FBI interviews, Palm Beach PD.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 3163,
    page_count: 3158,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 2,
    name: 'Dataset 2',
    description: 'EFTA00003159 – EFTA00003857. Includes .avi video files.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 577,
    page_count: 699,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 3,
    name: 'Dataset 3',
    description: 'EFTA00003858 – EFTA00005704.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 68,
    page_count: 1847,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 4,
    name: 'Dataset 4',
    description: 'EFTA00005705 – EFTA00008408.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 154,
    page_count: 2704,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 5,
    name: 'Dataset 5',
    description: 'EFTA00008409 – EFTA00008528.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 122,
    page_count: 120,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 6,
    name: 'Dataset 6',
    description: 'EFTA00008529 – EFTA00009015.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 15,
    page_count: 487,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 7,
    name: 'Dataset 7',
    description: 'EFTA00009016 – EFTA00009675.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 19,
    page_count: 660,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 8,
    name: 'Dataset 8',
    description: 'EFTA00009676 – EFTA00039024. Includes .mp4 video files.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 11035,
    page_count: 29349,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 9,
    name: 'Dataset 9',
    description: 'EFTA00039025 – EFTA01262781. Missing OPT/DAT load file.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 531256,
    page_count: 1223757,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
  {
    dataset_number: 10,
    name: 'Dataset 10',
    description: 'EFTA01262782 – EFTA02212882. 180K images, 874 native video/audio files.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 504030,
    page_count: 950101,
    image_count: 180000,
    video_count: 874,
    processing_status: 'pending',
  },
  {
    dataset_number: 11,
    name: 'Dataset 11',
    description: 'EFTA02212883 – EFTA02730264. 4 .m4v native files.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 331662,
    page_count: 517382,
    image_count: 0,
    video_count: 4,
    processing_status: 'pending',
  },
  {
    dataset_number: 12,
    name: 'Dataset 12',
    description: 'EFTA02730265 – EFTA02731789.',
    source_url: 'https://www.justice.gov/epstein/doj-disclosures',
    zip_size_gb: null,
    document_count: 154,
    page_count: 1525,
    image_count: 0,
    video_count: 0,
    processing_status: 'pending',
  },
]

async function seedDatasets() {
  console.log('Seeding datasets table...')

  const { data, error } = await supabase
    .from('datasets')
    .upsert(datasets, { onConflict: 'dataset_number' })
    .select()

  if (error) {
    console.error('Error seeding datasets:', error)
    process.exit(1)
  }

  console.log(`Successfully seeded ${data?.length || 0} datasets`)

  // Log summary
  const totalPages = datasets.reduce((sum, ds) => sum + ds.page_count, 0)
  const totalDocs = datasets.reduce((sum, ds) => sum + ds.document_count, 0)
  const totalImages = datasets.reduce((sum, ds) => sum + ds.image_count, 0)
  const totalVideos = datasets.reduce((sum, ds) => sum + ds.video_count, 0)

  console.log('\nDataset Summary:')
  console.log(`  Total datasets: ${datasets.length}`)
  console.log(`  Total EFTA pages: ${totalPages.toLocaleString()}`)
  console.log(`  Total PDF files: ${totalDocs.toLocaleString()}`)
  console.log(`  Total images: ${totalImages.toLocaleString()}`)
  console.log(`  Total videos: ${totalVideos.toLocaleString()}`)
}

seedDatasets()
