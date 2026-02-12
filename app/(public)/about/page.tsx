// app/(public)/about/page.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-4 text-3xl font-bold">About The Epstein Archive</h1>

      <section className="mb-12">
        <p className="mb-4 text-lg text-muted-foreground">
          The Epstein Archive is an open-source platform for searching, analyzing,
          and connecting the 3.5 million pages of documents released by the U.S. Department
          of Justice related to Jeffrey Epstein. Our mission is to make this evidence
          accessible, searchable, and actionable.
        </p>
      </section>

      <Separator className="my-8" />

      {/* For Prosecutors */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold text-accent">For Prosecutors</h2>
        <p className="mb-4 text-muted-foreground">
          This platform is designed to do the heavy lifting of evidence discovery so that
          prosecutors can focus on legal strategy. Every feature moves toward one goal:
          identifying crimes, identifying perpetrators, and preparing the evidence for action.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: 'Entity Dossiers', desc: 'Auto-compiled evidence summaries for every person, with full document citations.' },
            { title: 'Criminal Indicators', desc: 'AI-scored patterns suggesting trafficking, obstruction, conspiracy, and financial crimes.' },
            { title: 'Evidence Chains', desc: 'Full source provenance for every data point — built for admissibility.' },
            { title: 'Exportable Packages', desc: 'Download evidence packages in legal-ready formats (PDF, BibTeX, JSON).' },
          ].map(({ title, desc }) => (
            <Card key={title} className="border-border bg-surface">
              <CardContent className="pt-6">
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Methodology */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">Methodology</h2>
        <div className="space-y-4 text-muted-foreground">
          <p><strong className="text-primary">OCR:</strong> Google Cloud Document AI extracts text with structure preservation.</p>
          <p><strong className="text-primary">Embeddings:</strong> Amazon Nova Multimodal Embeddings generates unified 1024-dimensional vectors for text, images, video, and audio — enabling cross-modal semantic search in a single vector space.</p>
          <p><strong className="text-primary">Search:</strong> Hybrid search combining vector similarity (semantic) with BM25 keyword search via Reciprocal Rank Fusion.</p>
          <p><strong className="text-primary">Entities:</strong> AI-powered extraction of people, organizations, locations, and relationships with cross-document deduplication.</p>
          <p><strong className="text-primary">Redactions:</strong> Automated detection and cataloging of redacted regions with context analysis for crowdsourced solving.</p>
        </div>
      </section>

      <Separator className="my-8" />

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">FAQ</h2>
        <Accordion type="single" collapsible>
          <AccordionItem value="source">
            <AccordionTrigger>Where do these documents come from?</AccordionTrigger>
            <AccordionContent>All documents come directly from the U.S. Department of Justice public release related to Jeffrey Epstein. No documents are modified — only analyzed and indexed.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="accuracy">
            <AccordionTrigger>How accurate is the AI analysis?</AccordionTrigger>
            <AccordionContent>All AI-generated content (summaries, entity extraction, classifications) is labeled as such. Every data point links back to its source document and page number. Community verification adds an additional layer of accuracy.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="contribute">
            <AccordionTrigger>How can I contribute?</AccordionTrigger>
            <AccordionContent>You can submit redaction proposals, match images, provide intelligence hints, correct OCR errors, annotate documents, and participate in investigation threads. Sign in to get started.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="funding">
            <AccordionTrigger>Where does the money go?</AccordionTrigger>
            <AccordionContent>100% of donations go to document processing costs (OCR, AI analysis, hosting). Every dollar spent is logged publicly on the funding page with full transparency.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="opensource">
            <AccordionTrigger>Is this open source?</AccordionTrigger>
            <AccordionContent>Yes. The entire platform is MIT licensed and available on GitHub. We welcome contributions from developers, researchers, and journalists.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Media Kit */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Media & Citations</h2>
        <p className="text-muted-foreground">
          When citing findings from this platform, please reference the original DOJ document
          (dataset number, filename, page number) as well as The Epstein Archive as the discovery tool.
          For press inquiries, contact us via our GitHub repository.
        </p>
      </section>
    </div>
  )
}
