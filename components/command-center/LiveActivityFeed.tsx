'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useActivityFeed } from '@/lib/hooks/useActivityFeed'
import { ActivityFeedCard } from './ActivityFeedCard'

const FEED_TABS = [
  { value: 'all', label: 'All' },
  { value: 'redaction', label: 'Redactions' },
  { value: 'connection', label: 'Connections' },
  { value: 'processing', label: 'Processing' },
] as const

export function LiveActivityFeed() {
  const [activeTab, setActiveTab] = useState('all')
  const { data: items, isLoading } = useActivityFeed(activeTab)

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Live Activity</CardTitle>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8">
            {FEED_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs px-2.5"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-surface-elevated"
                />
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <ActivityFeedCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Activity will appear here as the community investigates documents.
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
