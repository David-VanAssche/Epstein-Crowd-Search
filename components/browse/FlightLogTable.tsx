// components/browse/FlightLogTable.tsx
'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

interface Flight {
  id: string
  date: string | null
  aircraft: string | null
  origin: string | null
  destination: string | null
  passengers: string[]
  pilot: string | null
  tail_number: string | null
  source: string | null
  document_id: string | null
  page_number: number | null
}

interface FlightLogTableProps {
  flights: Flight[]
}

export function FlightLogTable({ flights }: FlightLogTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Aircraft</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Passengers</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flights.map((flight) => (
            <TableRow key={flight.id}>
              <TableCell className="whitespace-nowrap">{flight.date || '—'}</TableCell>
              <TableCell>
                <div>{flight.aircraft || '—'}</div>
                {flight.tail_number && (
                  <div className="text-xs text-muted-foreground">{flight.tail_number}</div>
                )}
              </TableCell>
              <TableCell>
                {flight.origin || flight.destination
                  ? `${flight.origin || '?'} → ${flight.destination || '?'}`
                  : '—'}
              </TableCell>
              <TableCell className="max-w-xs">
                <div className="line-clamp-2 text-sm">
                  {flight.passengers.length > 0 ? flight.passengers.join(', ') : '—'}
                </div>
              </TableCell>
              <TableCell>
                {flight.document_id ? (
                  <Link
                    href={`/document/${flight.document_id}${flight.page_number ? `#page-${flight.page_number}` : ''}`}
                    className="text-blue-400 hover:underline"
                  >
                    View doc
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">{flight.source || 'imported'}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
