// app/page.tsx
import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CorpusStats } from '@/types/collaboration'

export const dynamic = 'force-dynamic'

const SAMPLE_SEARCHES = [
  'flight logs passenger list',
  'Palm Beach police report',
  'financial transactions 2003',
  'deposition testimony Maxwell',
  'Little St. James island',
  'FBI interview summary',
]

async function getStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${baseUrl}/api/stats`, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)
    const json = await res.json()
    if (json.data) return json.data as CorpusStats
  } catch {
    // Fall through to defaults
  }
  return null
}

export default async function HomePage() {
  const corpusStats = await getStats()
  const stats = {
    chunks: corpusStats?.total_chunks ?? 0,
    entities: corpusStats?.total_entities ?? 0,
    sources_ingested: corpusStats?.processed_documents ?? 0,
    sources_total: 24,
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-4 max-w-4xl text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
          3.5 Million Pages of Truth.{' '}
          <span className="text-accent">Now Searchable.</span>
        </h1>
        <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
          AI-powered search across the complete Epstein files released by the U.S. Department of Justice.
          Help uncover the truth through crowdsourced research.
        </p>
        <div className="w-full max-w-2xl">
          <SearchBar />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SAMPLE_SEARCHES.map((query) => (
            <Link key={query} href={`/search?q=${encodeURIComponent(query)}`}>
              <Badge variant="secondary" className="cursor-pointer hover:bg-surface-elevated">
                {query}
              </Badge>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: '🔍', title: 'Search', desc: 'AI-powered semantic search across documents, images, audio, and video transcripts with full citations.' },
            { icon: '🔗', title: 'Discover', desc: 'Entity relationship mapping, timelines, and geographic evidence reveal hidden connections across the corpus.' },
            { icon: '🔓', title: 'Unredact', desc: 'Crowdsourced redaction solving with cascade matching — one discovery can unlock dozens more.' },
          ].map(({ icon, title, desc }) => (
            <Card key={title} className="border-border bg-surface">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 text-4xl">{icon}</div>
                <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats Ticker */}
      <section className="border-y border-border bg-surface py-12">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 text-center md:grid-cols-3">
          {[
            { label: 'Searchable Passages', value: stats.chunks.toLocaleString() },
            { label: 'Entities Identified', value: stats.entities.toLocaleString() },
            { label: 'Data Sources', value: `${stats.sources_ingested}/${stats.sources_total}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-accent">{value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Funding CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">Help Process the Evidence</h2>
        <p className="mb-6 text-muted-foreground">
          Every dollar goes directly to processing. Your $5 makes 2,400 pages searchable.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/funding">
            <Button size="lg">See Your Impact</Button>
          </Link>
          <a href={process.env.NEXT_PUBLIC_GOFUNDME_URL || '#'} target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline">Donate Now</Button>
          </a>
        </div>
      </section>
    </div>
  )
}
