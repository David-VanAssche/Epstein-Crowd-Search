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
  document_id: string
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
            <TableHead>Origin</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Passengers</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flights.map((flight) => (
            <TableRow key={flight.id}>
              <TableCell className="whitespace-nowrap">{flight.date || '—'}</TableCell>
              <TableCell>{flight.aircraft || '—'}</TableCell>
              <TableCell>{flight.origin || '—'}</TableCell>
              <TableCell>{flight.destination || '—'}</TableCell>
              <TableCell>{flight.passengers.join(', ') || '—'}</TableCell>
              <TableCell>
                <Link
                  href={`/document/${flight.document_id}${flight.page_number ? `#page-${flight.page_number}` : ''}`}
                  className="text-blue-400 hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
