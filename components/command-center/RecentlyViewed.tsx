'use client'

import Link from 'next/link'
import { FileText, Users, Search, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRecentlyViewed } from '@/lib/hooks/useRecentlyViewed'

const TYPE_ICONS = {
  document: FileText,
  entity: Users,
  search: Search,
} as const

export function RecentlyViewed() {
  const { items } = useRecentlyViewed()

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recently Viewed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.type] ?? FileText
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Documents and entities you view will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
