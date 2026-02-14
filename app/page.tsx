import { CommandCenter } from '@/components/command-center/CommandCenter'
import type { CorpusStats } from '@/types/collaboration'

export const dynamic = 'force-dynamic'

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
    redactions_solved: 0,
  }

  return <CommandCenter initialStats={stats} />
}
