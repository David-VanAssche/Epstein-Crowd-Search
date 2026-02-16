// app/(public)/pipeline/page.tsx
import { PipelineFunnel } from '@/components/pipeline/PipelineFunnel'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Processing Pipeline — Epstein Files',
  description:
    'See every stage of document processing: OCR, classification, entity extraction, network analysis, and more. Fund specific stages to push documents through the pipeline.',
}

export default function PipelinePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Processing Pipeline</h1>
      <p className="mb-2 text-lg text-muted-foreground">
        Every document passes through 17 AI-powered stages — from raw scan to fully searchable,
        entity-linked, risk-scored intelligence.
      </p>
      <p className="mb-8 text-sm text-muted-foreground">
        Each stage costs money to run. See what each stage does, what it costs, and fund
        the stages that matter most to your research.
      </p>

      <Separator className="my-6" />

      <PipelineFunnel />
    </div>
  )
}
