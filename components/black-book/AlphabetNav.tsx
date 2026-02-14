// components/black-book/AlphabetNav.tsx
'use client'

import { cn } from '@/lib/utils'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface AlphabetNavProps {
  activeLetter: string
  onSelect: (letter: string) => void
}

export function AlphabetNav({ activeLetter, onSelect }: AlphabetNavProps) {
  return (
    <>
      {/* Desktop: vertical sticky sidebar */}
      <nav className="sticky top-20 hidden flex-col gap-0.5 lg:flex" aria-label="Alphabet filter">
        <button
          onClick={() => onSelect('')}
          aria-current={activeLetter === '' ? 'true' : undefined}
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium transition-colors',
            activeLetter === '' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          All
        </button>
        {LETTERS.map((letter) => (
          <button
            key={letter}
            onClick={() => onSelect(letter)}
            aria-current={activeLetter === letter ? 'true' : undefined}
            className={cn(
              'rounded px-2 py-0.5 text-xs font-medium transition-colors',
              activeLetter === letter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {letter}
          </button>
        ))}
      </nav>

      {/* Mobile: horizontal scrollable row */}
      <nav className="flex gap-1 overflow-x-auto pb-2 lg:hidden" aria-label="Alphabet filter">
        <button
          onClick={() => onSelect('')}
          aria-current={activeLetter === '' ? 'true' : undefined}
          className={cn(
            'shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors',
            activeLetter === '' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          All
        </button>
        {LETTERS.map((letter) => (
          <button
            key={letter}
            onClick={() => onSelect(letter)}
            aria-current={activeLetter === letter ? 'true' : undefined}
            className={cn(
              'shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              activeLetter === letter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {letter}
          </button>
        ))}
      </nav>
    </>
  )
}
