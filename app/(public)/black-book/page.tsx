// app/(public)/black-book/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, BookUser, Loader2 } from 'lucide-react'
import { AlphabetNav } from '@/components/black-book/AlphabetNav'
import { useBlackBook } from '@/lib/hooks/useBlackBook'
import { Button } from '@/components/ui/button'

export default function BlackBookPage() {
  const [search, setSearch] = useState('')
  const [letter, setLetter] = useState('')
  const [page, setPage] = useState(1)

  const { entries, total, hasMore, isLoading, error } = useBlackBook({ search, letter }, page)

  const handleLetterSelect = (l: string) => {
    setLetter(l)
    setPage(1)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <BookUser className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Black Book</h1>
            <p className="text-muted-foreground">
              Browse Epstein&apos;s address book contacts. {total > 0 && `${total.toLocaleString()} entries.`}
            </p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={handleSearchChange}
          className="pl-10"
          aria-label="Search by name"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load entries. Please try again later.
        </div>
      )}

      {/* Mobile alphabet nav */}
      <div className="mb-4 lg:hidden">
        <AlphabetNav activeLetter={letter} onSelect={handleLetterSelect} />
      </div>

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Desktop alphabet sidebar */}
        <div className="hidden w-10 shrink-0 lg:block">
          <AlphabetNav activeLetter={letter} onSelect={handleLetterSelect} />
        </div>

        {/* Data table */}
        <div className="min-w-0 flex-1">
          {isLoading && entries.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              {search || letter
                ? 'No entries found matching your filters.'
                : 'No address book entries have been extracted yet. They will appear once document processing completes.'}
            </div>
          ) : (
            <>
              <Card className="border-border bg-surface">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone(s)</TableHead>
                        <TableHead className="hidden md:table-cell">Address</TableHead>
                        <TableHead className="hidden lg:table-cell">Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => {
                        const row = (
                          <TableRow key={entry.id} className={entry.linked_entity ? 'cursor-pointer hover:bg-surface-elevated' : ''}>
                            <TableCell className="font-medium">
                              {entry.linked_entity ? (
                                <Link href={`/entity/${entry.linked_entity.id}`} className="text-info hover:underline">
                                  {entry.name}
                                </Link>
                              ) : (
                                entry.name
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.phones.length > 0
                                ? entry.phones.join(', ')
                                : <span className="text-muted-foreground/50">&mdash;</span>}
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                              {entry.addresses.length > 0
                                ? (
                                  <span>
                                    {entry.addresses[0]}
                                    {entry.addresses.length > 1 && (
                                      <span className="text-muted-foreground/60"> +{entry.addresses.length - 1} more</span>
                                    )}
                                  </span>
                                )
                                : <span className="text-muted-foreground/50">&mdash;</span>}
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                              {entry.emails && entry.emails.length > 0
                                ? entry.emails.join(', ')
                                : <span className="text-muted-foreground/50">&mdash;</span>}
                            </TableCell>
                          </TableRow>
                        )
                        return row
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Pagination */}
              {(hasMore || page > 1) && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
