// app/api/flights/route.ts
// Queries the flights table directly (community-imported + pipeline-extracted).
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

    let query = supabase
      .from('flights')
      .select(
        `
        id,
        flight_date,
        departure,
        arrival,
        aircraft,
        tail_number,
        pilot,
        passenger_names,
        source,
        document_id,
        page_number,
        created_at,
        documents ( filename )
      `,
        { count: 'exact' }
      )
      .order('flight_date', { ascending: false, nullsFirst: false })
      .range(offset, offset + pagination.per_page - 1)

    // Server-side date filters
    if (dateFrom) {
      query = query.gte('flight_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('flight_date', dateTo)
    }

    // Server-side aircraft filter
    if (aircraft) {
      query = query.ilike('aircraft', `%${aircraft}%`)
    }

    // Passenger filtering requires array contains — use overlaps or client-side
    // Since passenger_names is TEXT[], we filter client-side for substring matching
    const { data: flights, count, error } = await query

    if (error) {
      throw new Error(`Flights query failed: ${error.message}`)
    }

    let results = (flights || []).map((f: any) => ({
      id: f.id,
      date: f.flight_date,
      aircraft: f.aircraft,
      tail_number: f.tail_number,
      origin: f.departure,
      destination: f.arrival,
      pilot: f.pilot,
      passengers: f.passenger_names || [],
      source: f.source,
      document_id: f.document_id,
      document_filename: f.documents?.filename || null,
      page_number: f.page_number,
    }))

    // Client-side passenger substring filter
    if (passenger) {
      const lowerPassenger = passenger.toLowerCase()
      results = results.filter((f: any) =>
        f.passengers.some((p: string) => p.toLowerCase().includes(lowerPassenger))
      )
    }

    return paginated(results, pagination.page, pagination.per_page, count || 0)
  } catch (err) {
    return handleApiError(err)
  }
}
