'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { Brain, Search, Dices } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useRandomDocument } from '@/lib/hooks/useRandomDocument'
import { cn } from '@/lib/utils'

const ROTATING_PLACEHOLDERS = [
  'Who visited Little St. James in 2002?',
  'Find redacted names that appear elsewhere unredacted',
  'What do the financial records show?',
  'Search across documents, photos, and transcripts...',
  'Connections between flight logs and court testimony',
]

interface SearchBarProps {
  defaultValue?: string
}

export function SearchBar({ defaultValue = '' }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const { goToRandom, isLoading: randomLoading } = useRandomDocument()

  // Sync defaultValue when URL changes (e.g. clicking an example query)
  useEffect(() => {
    setQuery(defaultValue)
  }, [defaultValue])

  // Rotate placeholders when input is empty and not focused
  useEffect(() => {
    if (focused || query) return
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [focused, query])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      }
    },
    [query, router]
  )

  const showRotating = !focused && !query

  return (
    <div className="flex w-full items-center gap-2">
      <form onSubmit={handleSubmit} className="flex-1" role="search" aria-label="Search documents">
        <div
          className={cn(
            'flex items-center rounded-xl border border-border bg-surface transition-all duration-200',
            focused &&
              'border-accent/40 ring-2 ring-accent/20 shadow-[0_0_20px_rgba(239,68,68,0.08)]'
          )}
        >
          {/* Brain icon */}
          <div className="flex items-center pl-4">
            <Brain
              className={cn(
                'h-5 w-5 transition-colors duration-200',
                focused ? 'text-accent' : 'text-muted-foreground'
              )}
            />
          </div>

          {/* Input */}
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={showRotating ? '' : 'Ask anything...'}
              aria-label="Search documents"
              className="h-12 border-0 bg-transparent pl-3 pr-10 text-lg shadow-none ring-0 focus-visible:ring-0"
            />
            {/* Rotating placeholder overlay */}
            {showRotating && (
              <span
                key={placeholderIndex}
                aria-live="polite"
                aria-atomic="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground/60 animate-in fade-in duration-500"
              >
                {ROTATING_PLACEHOLDERS[placeholderIndex]}
              </span>
            )}
            {/* Cmd+K hint */}
            {!query && !focused && (
              <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Submit button inside the bar */}
          <Button
            type="submit"
            size="sm"
            className="mr-2 h-8 gap-1.5 rounded-lg px-4"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
        </div>
      </form>

      {/* Random document button (outside bar) */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={goToRandom}
              disabled={randomLoading}
            >
              <Dices className="h-5 w-5" />
              <span className="sr-only">Random Document</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Random document</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
