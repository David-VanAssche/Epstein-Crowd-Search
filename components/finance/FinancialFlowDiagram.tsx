// components/finance/FinancialFlowDiagram.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFinancialSummary } from '@/lib/hooks/useFinancialTransactions'
import { Skeleton } from '@/components/ui/skeleton'

// Dynamically imported to avoid SSR issues with D3
let d3Module: typeof import('d3') | null = null
let sankeyModule: any = null

export function FinancialFlowDiagram() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [loaded, setLoaded] = useState(false)
  const { summary, isLoading } = useFinancialSummary()

  useEffect(() => {
    Promise.all([import('d3'), import('d3-sankey')])
      .then(([d3, sankey]) => {
        d3Module = d3
        sankeyModule = sankey
        setLoaded(true)
      })
      .catch(() => {
        // d3-sankey may not be installed yet
      })
  }, [])

  useEffect(() => {
    if (!loaded || !summary || !svgRef.current || !d3Module || !sankeyModule) return

    const d3 = d3Module
    const { sankey, sankeyLinkHorizontal } = sankeyModule

    // Build nodes and links from top senders -> types -> top receivers
    const senders = summary.top_senders.slice(0, 8)
    const receivers = summary.top_receivers.slice(0, 8)
    const types = summary.by_type.slice(0, 5)

    if (senders.length === 0 || receivers.length === 0) return

    const nodes: { name: string }[] = []
    const links: { source: number; target: number; value: number }[] = []

    // Add sender nodes
    senders.forEach((s) => nodes.push({ name: s.name }))
    // Add type nodes
    types.forEach((t) => nodes.push({ name: t.type }))
    // Add receiver nodes
    receivers.forEach((r) => nodes.push({ name: r.name }))

    const senderOffset = 0
    const typeOffset = senders.length
    const receiverOffset = senders.length + types.length

    // Sender -> Type links (distribute proportionally)
    senders.forEach((s, si) => {
      types.forEach((t, ti) => {
        const value = Math.max(1, Math.round(s.total * (t.total / summary.total_amount) / senders.length))
        links.push({ source: senderOffset + si, target: typeOffset + ti, value })
      })
    })

    // Type -> Receiver links
    types.forEach((t, ti) => {
      receivers.forEach((r, ri) => {
        const value = Math.max(1, Math.round(r.total * (t.total / summary.total_amount) / receivers.length))
        links.push({ source: typeOffset + ti, target: receiverOffset + ri, value })
      })
    })

    const width = 800
    const height = 500

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const layout = sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 6]])

    const { nodes: layoutNodes, links: layoutLinks } = layout({
      nodes: nodes.map((d: any, i: number) => ({ ...d, index: i })),
      links: links.map((d: any) => ({ ...d })),
    })

    const color = d3.scaleOrdinal(d3.schemeTableau10)

    svg.append('g')
      .selectAll('rect')
      .data(layoutNodes)
      .join('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => Math.max(1, d.y1 - d.y0))
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('fill', (d: any) => color(d.name))
      .attr('opacity', 0.8)

    svg.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.3)
      .selectAll('path')
      .data(layoutLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d: any) => color(d.source.name))
      .attr('stroke-width', (d: any) => Math.max(1, d.width))

    svg.append('g')
      .selectAll('text')
      .data(layoutNodes)
      .join('text')
      .attr('x', (d: any) => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr('y', (d: any) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: any) => d.x0 < width / 2 ? 'start' : 'end')
      .text((d: any) => d.name)
      .attr('fill', 'currentColor')
      .attr('font-size', '11px')
      .attr('class', 'text-foreground')
  }, [loaded, summary])

  if (isLoading || !loaded) {
    return (
      <Card>
        <CardHeader><CardTitle>Financial Flows</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[400px]" /></CardContent>
      </Card>
    )
  }

  if (!summary || summary.top_senders.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Flows</CardTitle>
        <p className="text-xs text-muted-foreground">Sankey diagram showing money flow from senders through transaction types to receivers</p>
      </CardHeader>
      <CardContent>
        <svg ref={svgRef} className="w-full" style={{ maxHeight: 500 }} />
      </CardContent>
    </Card>
  )
}
