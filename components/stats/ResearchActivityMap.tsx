// components/stats/ResearchActivityMap.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ActivityData {
  most_active_entities: Array<{ name: string; views: number; annotations: number }>
  most_active_datasets: Array<{ name: string; annotations: number }>
  under_explored: Array<{ name: string; reason: string }>
}

interface ResearchActivityMapProps {
  data?: ActivityData
}

export function ResearchActivityMap({ data }: ResearchActivityMapProps) {
  const [period, setPeriod] = useState<'7d' | '30d'>('7d')

  const defaultData: ActivityData = {
    most_active_entities: [],
    most_active_datasets: [],
    under_explored: [],
  }

  const activity = data ?? defaultData

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Research Activity</CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
            <TabsList>
              <TabsTrigger value="7d">7 days</TabsTrigger>
              <TabsTrigger value="30d">30 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-sm text-muted-foreground">
          Where researchers are focusing their attention.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-semibold">Most Researched Entities</h4>
          {activity.most_active_entities.length > 0 ? (
            <div className="space-y-2">
              {activity.most_active_entities.map((entity) => (
                <div key={entity.name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <span className="text-sm">{entity.name}</span>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{entity.views} views</span>
                    <span>{entity.annotations} annotations</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Entity research activity will appear once community members begin annotating documents.
            </p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Most Active Datasets</h4>
          {activity.most_active_datasets.length > 0 ? (
            <div className="space-y-2">
              {activity.most_active_datasets.map((dataset) => (
                <div key={dataset.name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <span className="text-sm">{dataset.name}</span>
                  <span className="text-xs text-muted-foreground">{dataset.annotations} annotations</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Dataset activity will appear once community research begins.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-amber-600/30 bg-amber-950/10 p-4">
          <h4 className="mb-2 text-sm font-semibold text-amber-400">Under-Explored Sections</h4>
          {activity.under_explored.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {activity.under_explored.map((item, i) => (
                <li key={i}>
                  <span className="font-medium text-amber-400">{item.name}</span>
                  {' '}&mdash; {item.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Under-explored sections will be highlighted once enough research activity exists for comparison.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
