// components/search/SearchBar.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useRandomDocument } from '@/lib/hooks/useRandomDocument'

interface SearchBarProps {
  defaultValue?: string
}

export function SearchBar({ defaultValue = '' }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)
  const { goToRandom, isLoading: randomLoading } = useRandomDocument()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <div className="relative flex-1">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents, entities, images, audio..."
          className="h-12 border-border bg-surface pl-4 pr-10 text-lg focus:ring-2 focus:ring-accent/20"
        />
        <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </div>
      <Button type="submit" size="lg" className="h-12 px-6">
        Search
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12"
        onClick={goToRandom}
        disabled={randomLoading}
        title="Random Document"
      >
        🎲
      </Button>
    </form>
  )
}
