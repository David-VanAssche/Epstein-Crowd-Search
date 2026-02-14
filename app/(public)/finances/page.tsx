// app/(public)/finances/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransactionFilters } from '@/components/finance/TransactionFilters'
import { TransactionList } from '@/components/finance/TransactionList'
import { FinancialSummary } from '@/components/finance/FinancialSummary'
import { FinancialFlowDiagram } from '@/components/finance/FinancialFlowDiagram'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProcessingFundingCard } from '@/components/funding/ProcessingFundingCard'
import { useFinancialTransactions, type FinancialFiltersState } from '@/lib/hooks/useFinancialTransactions'
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'

export default function FinancesPage() {
  const [filters, setFilters] = useState<FinancialFiltersState>({
    minAmount: null,
    maxAmount: null,
    transactionType: '',
    isSuspicious: null,
    dateFrom: null,
    dateTo: null,
  })
  const [page, setPage] = useState(1)

  const { transactions, total, isLoading } = useFinancialTransactions(filters, page)
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="container max-w-content py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Financial Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track financial flows extracted from documents. Filter by type, amount, date, or suspicious activity flags.
        </p>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">Transactions</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="flows">Flow Diagram</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <TransactionFilters filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1) }} />

          {isLoading ? (
            <LoadingState variant="list" count={8} />
          ) : transactions.length === 0 ? (
            filters.transactionType || filters.minAmount !== null || filters.isSuspicious !== null ? (
              <EmptyState
                variant="no-results"
                icon={DollarSign}
                title="No Transactions Found"
                description="No transactions match your current filters."
              />
            ) : (
              <ProcessingFundingCard slug="finances" />
            )
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1}&ndash;{Math.min(page * 20, total)} of {total} transactions
              </p>
              <TransactionList transactions={transactions} />
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview">
          <FinancialSummary />
        </TabsContent>

        <TabsContent value="flows">
          <FinancialFlowDiagram />
        </TabsContent>
      </Tabs>
    </div>
  )
}
