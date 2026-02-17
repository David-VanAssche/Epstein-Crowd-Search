'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDown } from 'lucide-react'

const SECTION_COLORS: Record<number, string> = {
  1: 'border-blue-500/30',
  2: 'border-indigo-500/30',
  3: 'border-violet-500/30',
  4: 'border-purple-500/30',
  5: 'border-amber-500/30',
}

interface FlowSectionProps {
  number: number
  title: string
  subtitle?: string
  children: React.ReactNode
  showConnector?: boolean
}

export function FlowSection({ number, title, subtitle, children, showConnector = true }: FlowSectionProps) {
  const borderColor = SECTION_COLORS[number] ?? 'border-border'

  return (
    <>
      <Card className={`${borderColor} bg-surface`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
              {number}
            </span>
            {title}
          </CardTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
      </Card>
      {showConnector && (
        <div className="flex justify-center py-1">
          <ArrowDown className="h-5 w-5 text-muted-foreground/40" />
        </div>
      )}
    </>
  )
}
