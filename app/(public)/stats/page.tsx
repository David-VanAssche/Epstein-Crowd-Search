// app/(public)/stats/page.tsx
import { ProcessingProgress } from '@/components/stats/ProcessingProgress'
import { CorpusStats } from '@/components/stats/CorpusStats'
import { FundingProgress } from '@/components/stats/FundingProgress'
import { CoverageHeatmap } from '@/components/stats/CoverageHeatmap'
import { ResearchActivityMap } from '@/components/stats/ResearchActivityMap'
import { CompletenessTracker } from '@/components/stats/CompletenessTracker'
import { NeedsEyesFeed } from '@/components/stats/NeedsEyesFeed'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Corpus Statistics — Epstein Files',
  description: 'Processing progress, corpus statistics, community contributions, and coverage analysis for the Epstein document archive.',
}

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Corpus Statistics</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        Real-time progress on processing, community verification, and research coverage.
      </p>

      {/* Processing progress + Funding sidebar */}
      <section className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProcessingProgress />
        </div>
        <div>
          <FundingProgress />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Corpus stats (numbers) */}
      <section className="mb-8">
        <h2 className="mb-6 text-2xl font-bold">Corpus Overview</h2>
        <CorpusStats />
      </section>

      <Separator className="my-8" />

      {/* Coverage heatmap */}
      <section className="mb-8">
        <CoverageHeatmap />
      </section>

      <Separator className="my-8" />

      {/* Research activity + Document completeness side by side */}
      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <ResearchActivityMap />
        <CompletenessTracker />
      </section>

      <Separator className="my-8" />

      {/* Needs Eyes feed */}
      <section className="mb-8">
        <NeedsEyesFeed />
      </section>
    </div>
  )
}
