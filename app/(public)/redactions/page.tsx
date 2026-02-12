// app/(public)/redactions/page.tsx
'use client'

import { RedactionStats } from '@/components/redaction/RedactionStats'
import { SolvableRedactionCard } from '@/components/redaction/SolvableRedactionCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { useSolvableRedactions } from '@/lib/hooks/useRedaction'

export default function RedactionsPage() {
  const { data, isLoading } = useSolvableRedactions()
  const redactions = data?.items ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Redaction Solving</h1>
      <p className="mb-8 text-muted-foreground">
        Help uncover hidden text in the Epstein files. Solve one redaction and
        cascade matching can unlock dozens more.
      </p>

      <RedactionStats />

      <h2 className="mt-8 mb-4 text-xl font-semibold">Solvable Redactions</h2>

      {isLoading ? (
        <LoadingState variant="list" count={5} />
      ) : redactions.length > 0 ? (
        <div className="space-y-4">
          {redactions.map((r) => (
            <SolvableRedactionCard key={r.redaction_id} redaction={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="not-processed"
          title="No Solvable Redactions Yet"
          description="Solvable redactions will appear here once documents are processed and redactions are detected with surrounding context."
          showFundingCTA
        />
      )}
    </div>
  )
}
