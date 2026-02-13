// components/map/EvidenceMap.tsx
'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapLocation, MapFilters } from '@/types/map'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const LOCATION_TYPE_COLORS: Record<string, string> = {
  property: '#f87171',
  city: '#60a5fa',
  country: '#4ade80',
  venue: '#c084fc',
}

const KNOWN_PROPERTIES = [
  { name: 'NYC Townhouse', lat: 40.7688, lng: -73.9650 },
  { name: 'Palm Beach Estate', lat: 26.6957, lng: -80.0353 },
  { name: 'Zorro Ranch (NM)', lat: 32.8000, lng: -105.4800 },
  { name: 'Little St. James', lat: 18.3000, lng: -64.8256 },
  { name: 'Paris Apartment', lat: 48.8656, lng: 2.3212 },
]

interface EvidenceMapProps {
  locations: MapLocation[]
  filters: MapFilters
  onLocationClick: (location: MapLocation) => void
}

export function EvidenceMap({ locations, filters, onLocationClick }: EvidenceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    const map = L.map(mapRef.current, {
      center: [30, -40],
      zoom: 3,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map)

    leafletMapRef.current = map

    return () => {
      map.remove()
      leafletMapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer)
      }
    })

    const filtered = locations.filter((loc) => {
      if (!filters.locationTypes.includes(loc.locationType)) return false
      if (filters.dateFrom && loc.lastMentionDate && loc.lastMentionDate < filters.dateFrom) return false
      if (filters.dateTo && loc.firstMentionDate && loc.firstMentionDate > filters.dateTo) return false
      return true
    })

    filtered.forEach((loc) => {
      const color = LOCATION_TYPE_COLORS[loc.locationType] || '#94a3b8'
      const radius = Math.max(5, Math.min(20, 5 + Math.log2(loc.mentionCount + 1) * 2))

      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius,
        fillColor: color,
        color: 'rgba(255,255,255,0.3)',
        weight: 1,
        fillOpacity: 0.8,
      })

      marker.bindPopup(`
        <div style="color: #e2e8f0; min-width: 150px;">
          <strong>${escapeHtml(loc.name)}</strong><br/>
          <span style="color: #94a3b8;">Type: ${escapeHtml(loc.locationType)}</span><br/>
          <span style="color: #94a3b8;">Mentions: ${loc.mentionCount}</span><br/>
          <span style="color: #94a3b8;">Entities: ${loc.topEntities?.slice(0, 3).map(escapeHtml).join(', ') || 'N/A'}</span>
        </div>
      `)

      marker.on('click', () => onLocationClick(loc))
      marker.addTo(map)
    })

    if (filters.showFlightRoutes) {
      const flightLocations = filtered.filter((loc) => loc.flightConnections && loc.flightConnections.length > 0)
      flightLocations.forEach((origin) => {
        origin.flightConnections?.forEach((dest) => {
          const destLoc = filtered.find((l) => l.id === dest.destinationId)
          if (destLoc) {
            const line = L.polyline(
              [[origin.lat, origin.lng], [destLoc.lat, destLoc.lng]],
              {
                color: '#fbbf24',
                weight: 1.5,
                opacity: 0.5,
                dashArray: '5, 10',
              }
            )
            line.bindPopup(`
              <div style="color: #e2e8f0;">
                <strong>${escapeHtml(origin.name)} -&gt; ${escapeHtml(destLoc.name)}</strong><br/>
                <span style="color: #94a3b8;">Flights: ${dest.flightCount}</span>
              </div>
            `)
            line.addTo(map)
          }
        })
      })
    }

    if (filters.showProperties) {
      KNOWN_PROPERTIES.forEach((prop) => {
        L.circleMarker([prop.lat, prop.lng], {
          radius: 12,
          fillColor: '#f87171',
          color: '#fbbf24',
          weight: 2,
          fillOpacity: 0.9,
        })
          .bindPopup(`<strong style="color: #e2e8f0;">${escapeHtml(prop.name)}</strong><br/><span style="color: #f87171;">Known Epstein Property</span>`)
          .addTo(map)
      })
    }
  }, [locations, filters, onLocationClick])

  return (
    <div ref={mapRef} className="h-full w-full" />
  )
}
