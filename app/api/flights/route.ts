// app/api/flights/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paginationSchema, parseSearchParams } from '@/lib/api/schemas'
import { paginated, handleApiError } from '@/lib/api/responses'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = parseSearchParams(url)
    const pagination = paginationSchema.parse(queryParams)
    const passenger = url.searchParams.get('passenger')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const aircraft = url.searchParams.get('aircraft')

    const supabase = await createClient()
    const offset = (pagination.page - 1) * pagination.per_page

    // Flight data is stored as structured_data_extractions with type 'flight_manifest'
    let query = supabase
      .from('structured_data_extractions')
      .select(
        `
        id,
        document_id,
        chunk_id,
        extracted_data,
        confidence,
        created_at,
        documents ( filename )
      `,
        { count: 'exact' }
      )
      .eq('extraction_type', 'flight_manifest')
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.per_page - 1)

    const { data: extractions, count, error } = await query

    if (error) {
      throw new Error(`Flights query failed: ${error.message}`)
    }

    // Transform extractions into flight records and apply filters
    let flights = (extractions || []).map((ext: any) => ({
      id: ext.id,
      date: ext.extracted_data?.date || null,
      aircraft: ext.extracted_data?.aircraft || null,
      origin: ext.extracted_data?.origin || null,
      destination: ext.extracted_data?.destination || null,
      passengers: ext.extracted_data?.passengers || [],
      document_id: ext.document_id,
      document_filename: ext.documents?.filename || null,
      page_number: ext.extracted_data?.page_number || null,
      confidence: ext.confidence,
    }))

    // Apply client-side filters (since JSONB filtering is complex)
    if (passenger) {
      const lowerPassenger = passenger.toLowerCase()
      flights = flights.filter((f: any) =>
        f.passengers.some((p: string) => p.toLowerCase().includes(lowerPassenger))
      )
    }
    if (aircraft) {
      const lowerAircraft = aircraft.toLowerCase()
      flights = flights.filter(
        (f: any) => f.aircraft && f.aircraft.toLowerCase().includes(lowerAircraft)
      )
    }

    return paginated(flights, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
