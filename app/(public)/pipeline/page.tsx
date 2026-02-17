// app/(public)/pipeline/page.tsx
import { PipelineWaterfall } from '@/components/pipeline/PipelineWaterfall'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Processing Pipeline — Epstein Files',
  description:
    'See how documents flow through OCR, classification, entity extraction, and network analysis. Track progress at every stage.',
}

export default function PipelinePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Processing Pipeline</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        Every document flows through OCR, classification, and enrichment stages — each
        showing accurate counts based on what actually feeds into it.
      </p>

      <Separator className="my-6" />

      <PipelineWaterfall />
    </div>
  )
}
