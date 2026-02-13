// app/(public)/funding/page.tsx
import { FundingTracker } from '@/components/funding/FundingTracker'
import { DonationImpactCalc } from '@/components/funding/DonationImpactCalc'
import { DonationImpactTiers } from '@/components/funding/DonationImpactTiers'
import { SpendTransparencyLog } from '@/components/funding/SpendTransparencyLog'
import { ProcessingLiveFeed } from '@/components/funding/ProcessingLiveFeed'
import { Separator } from '@/components/ui/separator'

export const metadata = {
  title: 'Funding & Impact — Epstein Files',
  description: 'See exactly where your donations go. Every dollar funds AI processing of the Epstein document corpus.',
}

export default function FundingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero: Giant progress bar */}
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Fund the Truth
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Every dollar goes directly to AI processing. Every penny is accounted for.
        </p>
        <div className="mx-auto max-w-2xl">
          <FundingTracker />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Interactive calculator */}
      <section className="mb-12">
        <div className="mx-auto max-w-2xl">
          <DonationImpactCalc />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Impact tiers */}
      <section className="mb-12">
        <DonationImpactTiers />
      </section>

      <Separator className="my-8" />

      {/* Spend transparency + live feed side by side */}
      <section className="mb-12 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SpendTransparencyLog />
        </div>
        <div>
          <ProcessingLiveFeed />
        </div>
      </section>

      <Separator className="my-8" />

      {/* GoFundMe embed */}
      <section className="mb-12 text-center">
        <h2 className="mb-4 text-2xl font-bold">Every Penny Accounted For</h2>
        <p className="mb-6 text-muted-foreground">
          We process documents using Gemini for entity extraction, Whisper for audio
          transcription, and Supabase for storage. Cost: $2.10 per 1,000 pages.
        </p>
        <div className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-8">
          {/* GoFundMe widget embed placeholder.
              To get the real widget URL:
              1. Go to your GoFundMe campaign page
              2. Click "Share" then "Embed"
              3. Copy the iframe src URL
              4. Replace the src below with the real URL
          */}
          <iframe
            src="about:blank"
            title="GoFundMe Donation Widget"
            className="h-64 w-full rounded"
          />
          <p className="mt-4 text-xs text-muted-foreground">
            GoFundMe widget will load here. Replace the iframe src with your campaign widget URL.
          </p>
        </div>
      </section>

      {/* Spend category breakdown */}
      <section className="mb-12">
        <h2 className="mb-6 text-center text-2xl font-bold">Where Your Money Goes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { category: 'AI Entity Extraction', percent: 45, desc: 'Gemini processes each page to identify people, organizations, locations, and relationships.' },
            { category: 'OCR & Text Processing', percent: 25, desc: 'Converting scanned documents into searchable, structured text.' },
            { category: 'Audio Transcription', percent: 15, desc: 'Whisper AI converts audio recordings into searchable transcripts.' },
            { category: 'Storage & Infrastructure', percent: 15, desc: 'Supabase database, vector embeddings, and file storage.' },
          ].map(({ category, percent, desc }) => (
            <div
              key={category}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="mb-2 text-2xl font-bold text-primary">{percent}%</div>
              <h3 className="mb-1 text-sm font-semibold">{category}</h3>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
