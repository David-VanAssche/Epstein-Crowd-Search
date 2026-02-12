// app/api/random-document/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, notFound, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const dataset = url.searchParams.get('dataset_id')
    const docType = url.searchParams.get('doc_type')

    const supabase = await createClient()

    // Count eligible documents
    let countQuery = supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('processing_status', 'complete')

    if (dataset) countQuery = countQuery.eq('dataset_id', dataset)
    if (docType) countQuery = countQuery.eq('classification', docType)

    const { count } = await countQuery

    if (!count || count === 0) {
      return notFound('No processed documents available')
    }

    // Pick a random offset
    const randomOffset = Math.floor(Math.random() * count)

    let docQuery = supabase
      .from('documents')
      .select('id, filename, classification, page_count')
      .eq('processing_status', 'complete')

    if (dataset) docQuery = docQuery.eq('dataset_id', dataset)
    if (docType) docQuery = docQuery.eq('classification', docType)

    const { data: documents, error } = await docQuery
      .range(randomOffset, randomOffset)
      .limit(1)

    if (error || !documents || documents.length === 0) {
      return notFound('No documents found')
    }

    return success(documents[0])
  } catch (err) {
    return handleApiError(err)
  }
}
