// app/(public)/contradictions/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/shared/LoadingState'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
import Link from 'next/link'
import { CheckCircle, ThumbsUp, ThumbsDown, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
}

const SAMPLE_CONTRADICTIONS = [
  {
    id: 'sample-1',
    severity: 'critical',
    is_verified: true,
    tags: ['testimony'],
    claim_a: 'Virginia Giuffre stated she was recruited by Ghislaine Maxwell at Mar-a-Lago in 1999 when she was 16 years old.',
    claim_b: 'Employment records from Mar-a-Lago indicate Giuffre was not employed at the resort until 2000.',
    source_a: 'Giuffre v. Maxwell, Deposition Transcript p.32',
    source_b: 'Mar-a-Lago Employment Records, Exhibit 14',
    verify_count: 12,
    dispute_count: 3,
  },
  {
    id: 'sample-2',
    severity: 'high',
    is_verified: false,
    tags: ['flight-logs', 'dates'],
    claim_a: 'Flight logs show a trip from Teterboro to St. Thomas on March 11, 2002 with 6 passengers listed.',
    claim_b: 'A separate manifest for the same date and route lists only 3 passengers with different names.',
    source_a: 'FAA Flight Logs, Exhibit 9A',
    source_b: 'Pilot Logbook, Exhibit 22',
    verify_count: 7,
    dispute_count: 1,
  },
  {
    id: 'sample-3',
    severity: 'medium',
    is_verified: false,
    tags: ['financial'],
    claim_a: 'Bank records show a wire transfer of $500,000 from an offshore account in June 2004.',
    claim_b: 'The same transaction appears in another filing as $350,000 received in July 2004.',
    source_a: 'Deutsche Bank Subpoena Response, p.114',
    source_b: 'USVI AG Filing, Exhibit B-7',
    verify_count: 4,
    dispute_count: 2,
  },
] as const

interface ContradictionItem {
  id: string
  claim_a: string
  claim_b: string
  severity: string
  description: string | null
  verify_count: number
  dispute_count: number
  is_verified: boolean
  entity_ids: string[]
  tags: string[]
  created_at: string
  claim_a_document_filename: string | null
  claim_b_document_filename: string | null
}

export default function ContradictionsPage() {
  const [contradictions, setContradictions] = useState<ContradictionItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [severity, setSeverity] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const perPage = 20

  const fetchContradictions = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
      if (severity) params.set('severity', severity)

      const res = await fetch(`/api/contradictions?${params}`)
      const json = await res.json()
      setContradictions(json.data || [])
      setTotal(json.meta?.total || 0)
    } catch (err) {
      console.error('[Contradictions] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, severity])

  useEffect(() => {
    fetchContradictions()
  }, [fetchContradictions])

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="container max-w-content py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contradiction Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track conflicting claims across documents to identify inconsistencies in testimony and records.
          </p>
        </div>
        <Link href="/contribute">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Report Contradiction
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <Select value={severity || 'all'} onValueChange={(v) => { setSeverity(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {total} contradiction{total !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <LoadingState variant="page" />
      ) : contradictions.length === 0 ? (
        <div className="space-y-6">
          <ProcessingFundingCard slug="contradictions" />
          <div className="rounded-lg border border-dashed border-border bg-surface/50 p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Below is a preview of what this page will look like once processing is complete.
            </p>
          </div>
          <div className="space-y-4 opacity-60 pointer-events-none select-none" aria-hidden="true">
            {SAMPLE_CONTRADICTIONS.map((c) => (
              <Card key={c.id} className="border-border bg-surface">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={SEVERITY_COLORS[c.severity] || ''}>
                          {c.severity}
                        </Badge>
                        {c.is_verified && (
                          <Badge variant="outline" className="gap-1 text-green-400 border-green-400/30">
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                        {c.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Claim A</p>
                          <p className="text-sm text-foreground line-clamp-3">{c.claim_a}</p>
                          {c.source_a && (
                            <p className="mt-1 text-xs text-blue-400">{c.source_a}</p>
                          )}
                        </div>
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Claim B</p>
                          <p className="text-sm text-foreground line-clamp-3">{c.claim_b}</p>
                          {c.source_b && (
                            <p className="mt-1 text-xs text-blue-400">{c.source_b}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-xs">
                      <div className="flex items-center gap-1 text-green-400">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {c.verify_count}
                      </div>
                      <div className="flex items-center gap-1 text-red-400">
                        <ThumbsDown className="h-3.5 w-3.5" />
                        {c.dispute_count}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-center">
            <Link href="/contribute">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Report the First Contradiction
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {contradictions.map((c) => (
            <Card
              key={c.id}
              role="button"
              tabIndex={0}
              className="border-border bg-surface cursor-pointer transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expandedId === c.id ? null : c.id) } }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={SEVERITY_COLORS[c.severity] || ''}>
                        {c.severity}
                      </Badge>
                      {c.is_verified && (
                        <Badge variant="outline" className="gap-1 text-green-400 border-green-400/30">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                      {c.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>

                    {/* Side-by-side claims */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Claim A</p>
                        <p className="text-sm text-foreground line-clamp-3">{c.claim_a}</p>
                        {c.claim_a_document_filename && (
                          <p className="mt-1 text-xs text-blue-400">{c.claim_a_document_filename}</p>
                        )}
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Claim B</p>
                        <p className="text-sm text-foreground line-clamp-3">{c.claim_b}</p>
                        {c.claim_b_document_filename && (
                          <p className="mt-1 text-xs text-blue-400">{c.claim_b_document_filename}</p>
                        )}
                      </div>
                    </div>

                    {expandedId === c.id && c.description && (
                      <p className="text-sm text-muted-foreground">{c.description}</p>
                    )}
                  </div>

                  {/* Vote counts */}
                  <div className="flex flex-col items-center gap-1 text-xs">
                    <div className="flex items-center gap-1 text-green-400">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {c.verify_count}
                    </div>
                    <div className="flex items-center gap-1 text-red-400">
                      <ThumbsDown className="h-3.5 w-3.5" />
                      {c.dispute_count}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
