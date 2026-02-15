// app/api/map/locations/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, handleApiError } from '@/lib/api/responses'
import { lookupAirport, EPSTEIN_PROPERTIES } from '@/lib/data/airport-codes'
import type { MapLocation } from '@/types/map'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Fetch all flights
    const { data: flights } = await supabase
      .from('flights')
      .select('departure, arrival, flight_date')

    const locations: MapLocation[] = []
    const locationMap = new Map<string, MapLocation>()

    // 1. Add known Epstein properties
    for (const prop of EPSTEIN_PROPERTIES) {
      const loc: MapLocation = {
        id: prop.id,
        name: prop.name,
        lat: prop.lat,
        lng: prop.lng,
        locationType: 'property',
        mentionCount: 0,
        flightConnections: [],
      }
      locations.push(loc)
      locationMap.set(prop.id, loc)
    }

    // 2. Aggregate flight departure/arrival into location pins
    const airportMentions = new Map<string, number>()
    const connectionCounts = new Map<string, number>()

    for (const flight of flights ?? []) {
      const dep = flight.departure?.trim().toUpperCase()
      const arr = flight.arrival?.trim().toUpperCase()

      if (dep) airportMentions.set(dep, (airportMentions.get(dep) || 0) + 1)
      if (arr) airportMentions.set(arr, (airportMentions.get(arr) || 0) + 1)

      if (dep && arr) {
        const key = [dep, arr].sort().join('|')
        connectionCounts.set(key, (connectionCounts.get(key) || 0) + 1)
      }
    }

    // Create airport location pins
    const airportIdMap = new Map<string, string>()
    for (const [code, count] of airportMentions) {
      const airport = lookupAirport(code)
      if (!airport) continue

      const id = `airport-${code.toUpperCase()}`
      airportIdMap.set(code, id)

      if (!locationMap.has(id)) {
        const loc: MapLocation = {
          id,
          name: `${airport.name} (${airport.code})`,
          lat: airport.lat,
          lng: airport.lng,
          locationType: 'city',
          mentionCount: count,
          flightConnections: [],
        }
        locations.push(loc)
        locationMap.set(id, loc)
      } else {
        locationMap.get(id)!.mentionCount += count
      }
    }

    // 3. Compute flight connections between location pairs
    for (const [key, count] of connectionCounts) {
      const [depCode, arrCode] = key.split('|')
      const depId = airportIdMap.get(depCode)
      const arrId = airportIdMap.get(arrCode)
      if (!depId || !arrId) continue

      const depLoc = locationMap.get(depId)
      const arrLoc = locationMap.get(arrId)
      if (!depLoc || !arrLoc) continue

      if (!depLoc.flightConnections) depLoc.flightConnections = []
      if (!arrLoc.flightConnections) arrLoc.flightConnections = []

      depLoc.flightConnections.push({ destinationId: arrId, flightCount: count })
      arrLoc.flightConnections.push({ destinationId: depId, flightCount: count })
    }

    return success(locations)
  } catch (err) {
    return handleApiError(err)
  }
}
