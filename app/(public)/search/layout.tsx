import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Search',
  description:
    'AI-powered semantic search across 3.5 million pages of DOJ documents, images, audio, and video transcripts.',
}

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
