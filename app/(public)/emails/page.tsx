// app/(public)/emails/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmailFilters } from '@/components/email/EmailFilters'
import { EmailList } from '@/components/email/EmailList'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
import { useEmails, type EmailFiltersState } from '@/lib/hooks/useEmails'
import { ChevronLeft, ChevronRight, Mail } from 'lucide-react'

export default function EmailsPage() {
  const [filters, setFilters] = useState<EmailFiltersState>({
    search: '',
    entityId: null,
    dateFrom: null,
    dateTo: null,
    hasAttachments: null,
    threadId: null,
  })
  const [page, setPage] = useState(1)

  const { emails, total, isLoading, hasMore } = useEmails(filters, page)
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="container max-w-content py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Email Browser</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore extracted email communications across the Epstein archive. Search by sender, subject, date range, or filter by attachments.
        </p>
      </div>

      <EmailFilters filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1) }} />

      <div className="mt-6">
        {isLoading ? (
          <LoadingState variant="list" count={8} />
        ) : emails.length === 0 ? (
          filters.search || filters.entityId || filters.dateFrom ? (
            <EmptyState
              variant="no-results"
              icon={Mail}
              title="No Emails Found"
              description="No emails match your current filters. Try adjusting your search criteria."
            />
          ) : (
            <ProcessingFundingCard slug="emails" />
          )
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * 20 + 1}&ndash;{Math.min(page * 20, total)} of {total} emails
            </p>

            <EmailList emails={emails} />

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
                  disabled={!hasMore}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
