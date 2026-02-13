// components/analysis/CentralityLeaderboard.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

interface MetricEntry {
  entity_id: string
  entity_name: string
  entity_type: string
  degree: number
  betweenness: number
  pagerank: number
  cluster_id: number | null
}

export function CentralityLeaderboard() {
  const [data, setData] = useState<MetricEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sort, setSort] = useState('pagerank')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/analysis/centrality?sort=${sort}&per_page=25`)
      const json = await res.json()
      setData(json.data || [])
    } catch (err) {
      console.error('[Centrality] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sort])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Network Centrality</CardTitle>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pagerank">PageRank</SelectItem>
            <SelectItem value="betweenness">Betweenness</SelectItem>
            <SelectItem value="degree">Degree</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No network metrics computed yet. Run the network metrics batch job first.
          </p>
        ) : (
          <div className="space-y-1">
            {data.map((entry, i) => (
              <Link
                key={entry.entity_id}
                href={`/entity/${entry.entity_id}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface"
              >
                <span className="text-sm font-mono text-muted-foreground w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{entry.entity_name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{entry.entity_type}</Badge>
                <div className="text-right">
                  <span className="text-sm font-mono">
                    {sort === 'degree' ? entry.degree : (entry[sort as keyof MetricEntry] as number).toFixed(4)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
