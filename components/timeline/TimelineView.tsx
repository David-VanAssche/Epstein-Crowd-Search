// components/timeline/TimelineView.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { TimelineEventCard } from '@/components/timeline/TimelineEventCard'
import type { TimelineEvent } from '@/types/timeline'

interface TimelineViewProps {
  events: TimelineEvent[]
}

export function TimelineView({ events }: TimelineViewProps) {
  const [visibleCount, setVisibleCount] = useState(50)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Group events by year
  const eventsByYear = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const year = event.date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(event)
    return acc
  }, {})

  const sortedYears = Object.keys(eventsByYear).sort()

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < events.length) {
          setVisibleCount((prev) => Math.min(prev + 50, events.length))
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, events.length])

  const scrollToYear = useCallback((year: string) => {
    const element = document.getElementById(`timeline-year-${year}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  let eventIndex = 0

  return (
    <div className="relative">
      {/* Year quick-jump nav (sticky) */}
      <div className="sticky top-16 z-10 mb-6 flex flex-wrap gap-2 bg-background/95 py-2 backdrop-blur-sm">
        {sortedYears.map((year) => (
          <button
            key={year}
            onClick={() => scrollToYear(year)}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-primary"
          >
            {year}
          </button>
        ))}
      </div>

      {/* Timeline spine */}
      <div className="relative">
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border md:block" />
        <div className="absolute left-4 top-0 h-full w-px bg-border md:hidden" />

        {sortedYears.map((year) => {
          const yearEvents = eventsByYear[year]
          return (
            <div key={year} id={`timeline-year-${year}`}>
              <div className="relative mb-6 flex items-center justify-center">
                <div className="z-10 rounded-full border border-accent bg-background px-4 py-1 text-sm font-bold text-accent">
                  {year}
                </div>
              </div>
              {yearEvents.map((event) => {
                const idx = eventIndex++
                if (idx >= visibleCount) return null
                const isLeft = idx % 2 === 0
                return (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    side={isLeft ? 'left' : 'right'}
                  />
                )
              })}
            </div>
          )
        })}

        {visibleCount < events.length && (
          <div ref={sentinelRef} className="flex justify-center py-8">
            <span className="text-sm text-muted-foreground">Loading more events...</span>
          </div>
        )}
      </div>
    </div>
  )
}
