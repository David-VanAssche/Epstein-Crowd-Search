// components/analysis/TemporalHeatmap.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface FlightStat {
  entity_id: string
  entity_name: string
  flight_count: number
  first_flight: string | null
  last_flight: string | null
}

export function TemporalHeatmap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<FlightStat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/flight-stats?per_page=30&sort=flight_count')
      .then((r) => r.json())
      .then((json) => setData(json.data || []))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    import('d3').then((d3) => {
      const svg = d3.select(svgRef.current)
      svg.selectAll('*').remove()

      const margin = { top: 30, right: 20, bottom: 10, left: 120 }
      const width = 700 - margin.left - margin.right
      const barHeight = 22
      const height = data.length * barHeight + margin.top + margin.bottom

      svg.attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height}`)

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

      const maxCount = d3.max(data, (d) => d.flight_count) || 1
      const x = d3.scaleLinear().domain([0, maxCount]).range([0, width])
      const y = d3.scaleBand()
        .domain(data.map((d) => d.entity_name))
        .range([0, data.length * barHeight])
        .padding(0.15)

      const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCount])

      g.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', 0)
        .attr('y', (d) => y(d.entity_name)!)
        .attr('width', (d) => x(d.flight_count))
        .attr('height', y.bandwidth())
        .attr('fill', (d) => color(d.flight_count))
        .attr('rx', 2)

      g.selectAll('.label')
        .data(data)
        .join('text')
        .attr('x', -4)
        .attr('y', (d) => y(d.entity_name)! + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('font-size', '11px')
        .attr('fill', 'currentColor')
        .text((d) => d.entity_name.length > 18 ? d.entity_name.slice(0, 18) + '...' : d.entity_name)

      g.selectAll('.count')
        .data(data)
        .join('text')
        .attr('x', (d) => x(d.flight_count) + 4)
        .attr('y', (d) => y(d.entity_name)! + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('font-size', '10px')
        .attr('fill', 'currentColor')
        .attr('class', 'text-muted-foreground')
        .text((d) => d.flight_count)

      // Top axis
      g.append('g')
        .attr('transform', `translate(0,-4)`)
        .call(d3.axisTop(x).ticks(5).tickSize(0))
        .call((g) => g.select('.domain').remove())
        .selectAll('text')
        .attr('fill', 'currentColor')
        .attr('font-size', '10px')
    })
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flight Frequency</CardTitle>
        <p className="text-xs text-muted-foreground">Top passengers by number of flights in the Epstein archive</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px]" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No flight statistics available yet.</p>
        ) : (
          <svg ref={svgRef} className="w-full" />
        )}
      </CardContent>
    </Card>
  )
}
