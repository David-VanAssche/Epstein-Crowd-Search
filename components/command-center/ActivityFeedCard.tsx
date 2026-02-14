'use client'

import Link from 'next/link'
import { EyeOff, Network, FileText, Sparkles, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityItem } from '@/lib/hooks/useActivityFeed'

const TYPE_CONFIG: Record<
  string,
  { icon: typeof EyeOff; color: string }
> = {
  redaction: { icon: EyeOff, color: 'text-amber-400' },
  connection: { icon: Network, color: 'text-blue-400' },
  processing: { icon: FileText, color: 'text-green-400' },
  discovery: { icon: Sparkles, color: 'text-purple-400' },
  bounty: { icon: Target, color: 'text-red-400' },
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  )
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ActivityFeedCard({ item }: { item: ActivityItem }) {
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.processing
  const Icon = config.icon

  const content = (
    <div className="flex gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated">
      <div className={cn('mt-0.5 shrink-0', config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground line-clamp-2">{item.description}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timeAgo(item.timestamp)}</span>
          {item.actor && (
            <>
              <span className="text-border">·</span>
              <span>{item.actor}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )

  if (item.link) {
    return <Link href={item.link}>{content}</Link>
  }
  return content
}
