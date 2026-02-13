// components/graph/TemporalGraph.tsx
'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface KeyEvent {
  date: string
  label: string
  type: 'arrest' | 'raid' | 'legal' | 'death' | 'other'
}

const KEY_EVENTS: KeyEvent[] = [
  { date: '2005-03-01', label: 'Palm Beach PD investigation begins', type: 'legal' },
  { date: '2006-05-01', label: 'FBI investigation launched', type: 'legal' },
  { date: '2008-06-30', label: 'Plea deal signed', type: 'legal' },
  { date: '2019-07-06', label: 'Arrested at Teterboro Airport', type: 'arrest' },
  { date: '2019-07-08', label: 'Federal indictment (SDNY)', type: 'legal' },
  { date: '2019-08-10', label: 'Death in MCC Manhattan', type: 'death' },
  { date: '2020-07-02', label: 'Ghislaine Maxwell arrested', type: 'arrest' },
  { date: '2021-12-29', label: 'Maxwell convicted', type: 'legal' },
]

interface TemporalGraphProps {
  minDate: string
  maxDate: string
  onDateChange: (date: string) => void
}

export function TemporalGraph({ minDate, maxDate, onDateChange }: TemporalGraphProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<'1x' | '2x' | '5x'>('1x')
  const [currentDateIndex, setCurrentDateIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dateRange = useMemo(() => {
    const range: string[] = []
    const start = new Date(minDate)
    const end = new Date(maxDate)
    const cursor = new Date(start)
    while (cursor <= end) {
      range.push(cursor.toISOString().slice(0, 10))
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return range
  }, [minDate, maxDate])

  const currentDate = dateRange[currentDateIndex] || minDate
  const speedMs: Record<string, number> = useMemo(() => ({ '1x': 500, '2x': 250, '5x': 100 }), [])

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentDateIndex((prev) => {
          if (prev >= dateRange.length - 1) { setIsPlaying(false); return prev }
          return prev + 1
        })
      }, speedMs[speed])
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, speed, dateRange.length])

  useEffect(() => { onDateChange(currentDate) }, [currentDate, onDateChange])

  const handleReset = useCallback(() => { setIsPlaying(false); setCurrentDateIndex(0) }, [])

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border border-border bg-surface/95 p-4 backdrop-blur-sm">
      <div className="relative mb-2 h-6">
        {KEY_EVENTS.map((event) => {
          const eventDate = new Date(event.date)
          const startDate = new Date(minDate)
          const endDate = new Date(maxDate)
          const position = ((eventDate.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100
          if (position < 0 || position > 100) return null
          return (
            <div key={event.date} className="absolute -translate-x-1/2 cursor-help" style={{ left: `${position}%` }} title={`${event.date}: ${event.label}`}>
              <div className={`h-4 w-1 rounded-full ${
                event.type === 'arrest' ? 'bg-red-400' :
                event.type === 'death' ? 'bg-gray-400' :
                event.type === 'legal' ? 'bg-amber-400' : 'bg-blue-400'
              }`} />
            </div>
          )
        })}
      </div>
      <Slider
        value={[currentDateIndex]}
        onValueChange={([val]) => { setCurrentDateIndex(val); setIsPlaying(false) }}
        min={0} max={dateRange.length - 1} step={1}
      />
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
          <Select value={speed} onValueChange={(val) => setSpeed(val as typeof speed)}>
            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1x">1x</SelectItem>
              <SelectItem value="2x">2x</SelectItem>
              <SelectItem value="5x">5x</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm font-medium text-accent">
          {new Date(currentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1"><div className="h-2 w-2 rounded-full bg-red-400" /> Arrest</Badge>
          <Badge variant="outline" className="gap-1"><div className="h-2 w-2 rounded-full bg-amber-400" /> Legal</Badge>
        </div>
      </div>
    </div>
  )
}
