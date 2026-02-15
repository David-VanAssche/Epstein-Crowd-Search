// lib/pipeline/services/network-metrics.ts
// Stage 16: Compute PageRank, betweenness centrality, and community detection.
// All computation in Node.js (not SQL) — iterative algorithms don't map well to CTEs.

import { SupabaseClient } from '@supabase/supabase-js'

interface GraphEdge {
  entityAId: string
  entityBId: string
  strength: number
}

export class NetworkMetricsService {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async computeAll(options: {
    dryRun?: boolean
    pagerankIterations?: number
    betweennessSamples?: number
  } = {}): Promise<{
    entityCount: number
    edgeCount: number
    clusterCount: number
  }> {
    const {
      dryRun = false,
      pagerankIterations = 20,
      betweennessSamples = 200,
    } = options

    console.log('[NetworkMetrics] Loading entity graph...')

    // Load all relationships
    const { data: relationships, error } = await this.supabase
      .from('entity_relationships')
      .select('entity_a_id, entity_b_id, strength')

    if (error) throw new Error(`Failed to load relationships: ${error.message}`)
    if (!relationships || relationships.length === 0) {
      console.log('[NetworkMetrics] No relationships found. Done.')
      return { entityCount: 0, edgeCount: 0, clusterCount: 0 }
    }

    const edges: GraphEdge[] = relationships.map((r: any) => ({
      entityAId: r.entity_a_id,
      entityBId: r.entity_b_id,
      strength: r.strength || 1,
    }))

    // Build adjacency list
    const adjacency = new Map<string, Map<string, number>>()
    const allNodes = new Set<string>()

    for (const edge of edges) {
      allNodes.add(edge.entityAId)
      allNodes.add(edge.entityBId)

      if (!adjacency.has(edge.entityAId)) adjacency.set(edge.entityAId, new Map())
      if (!adjacency.has(edge.entityBId)) adjacency.set(edge.entityBId, new Map())

      adjacency.get(edge.entityAId)!.set(edge.entityBId, edge.strength)
      adjacency.get(edge.entityBId)!.set(edge.entityAId, edge.strength)
    }

    const nodeList = Array.from(allNodes)
    console.log(`[NetworkMetrics] Graph: ${nodeList.length} nodes, ${edges.length} edges`)

    // --- PageRank (power iteration) ---
    console.log(`[NetworkMetrics] Computing PageRank (${pagerankIterations} iterations)...`)
    const pagerank = this.computePageRank(nodeList, adjacency, pagerankIterations)

    // --- Betweenness Centrality (random BFS sampling) ---
    console.log(`[NetworkMetrics] Computing betweenness centrality (${betweennessSamples} samples)...`)
    const betweenness = this.computeBetweenness(nodeList, adjacency, betweennessSamples)

    // --- Community Detection (connected components + label propagation) ---
    console.log('[NetworkMetrics] Detecting communities...')
    const clusters = this.detectCommunities(nodeList, adjacency)
    const clusterCount = new Set(Object.values(clusters)).size

    console.log(`[NetworkMetrics] Found ${clusterCount} communities`)

    if (dryRun) {
      // Print top 10 by PageRank
      const sorted = nodeList.sort((a, b) => (pagerank.get(b) || 0) - (pagerank.get(a) || 0))
      console.log('[NetworkMetrics] Top 10 by PageRank:')
      for (const node of sorted.slice(0, 10)) {
        console.log(`  ${node}: PR=${pagerank.get(node)?.toFixed(6)} B=${betweenness.get(node)?.toFixed(4)} C=${clusters[node]}`)
      }
      return { entityCount: nodeList.length, edgeCount: edges.length, clusterCount }
    }

    // --- Write results to entity metadata ---
    console.log('[NetworkMetrics] Writing metrics to entity metadata...')
    let updated = 0

    // Batch update in chunks of 50
    for (let i = 0; i < nodeList.length; i += 50) {
      const batch = nodeList.slice(i, i + 50)

      for (const entityId of batch) {
        try {
          // Try RPC-based metadata merge first
          const { error: rpcError } = await this.supabase.rpc('jsonb_merge_metadata', {
            entity_id: entityId,
            new_metadata: {
              pagerank: pagerank.get(entityId) || 0,
              betweenness: betweenness.get(entityId) || 0,
              cluster_id: clusters[entityId] ?? -1,
              network_metrics_updated: new Date().toISOString(),
            },
          })

          if (rpcError) {
            // Fallback: read-then-write
            const { data } = await this.supabase
              .from('entities')
              .select('metadata')
              .eq('id', entityId)
              .single()
            const existing = (data as any)?.metadata || {}
            await this.supabase
              .from('entities')
              .update({
                metadata: {
                  ...existing,
                  pagerank: pagerank.get(entityId) || 0,
                  betweenness: betweenness.get(entityId) || 0,
                  cluster_id: clusters[entityId] ?? -1,
                  network_metrics_updated: new Date().toISOString(),
                },
              })
              .eq('id', entityId)
          }
          updated++
        } catch {
          // Skip entity on error
        }
      }

      if (i % 200 === 0 && i > 0) {
        console.log(`[NetworkMetrics] Updated ${updated}/${nodeList.length} entities`)
      }
    }

    // Refresh materialized views
    console.log('[NetworkMetrics] Refreshing materialized views...')
    const { error: refreshError } = await this.supabase.rpc('refresh_network_views')
    if (refreshError) {
      console.warn('[NetworkMetrics] View refresh failed (may not exist yet):', refreshError.message)
    }

    console.log(`[NetworkMetrics] Done: ${updated} entities updated, ${clusterCount} clusters`)
    return { entityCount: nodeList.length, edgeCount: edges.length, clusterCount }
  }

  private computePageRank(
    nodes: string[],
    adjacency: Map<string, Map<string, number>>,
    iterations: number,
    damping = 0.85
  ): Map<string, number> {
    const n = nodes.length
    const pr = new Map<string, number>()

    // Initialize uniform
    for (const node of nodes) {
      pr.set(node, 1 / n)
    }

    // Power iteration
    for (let iter = 0; iter < iterations; iter++) {
      const newPr = new Map<string, number>()
      let sinkPr = 0

      // Sum PR of dangling nodes (no outgoing edges — rare in undirected graph)
      for (const node of nodes) {
        if (!adjacency.has(node) || adjacency.get(node)!.size === 0) {
          sinkPr += pr.get(node) || 0
        }
      }

      for (const node of nodes) {
        let rank = (1 - damping) / n + damping * sinkPr / n

        const neighbors = adjacency.get(node)
        if (neighbors) {
          for (const [neighbor] of neighbors) {
            const neighborDegree = adjacency.get(neighbor)?.size || 1
            rank += damping * (pr.get(neighbor) || 0) / neighborDegree
          }
        }

        newPr.set(node, rank)
      }

      // Update
      for (const [k, v] of newPr) {
        pr.set(k, v)
      }
    }

    return pr
  }

  private computeBetweenness(
    nodes: string[],
    adjacency: Map<string, Map<string, number>>,
    samples: number
  ): Map<string, number> {
    const bc = new Map<string, number>()
    for (const node of nodes) bc.set(node, 0)

    // Random BFS from `samples` source nodes
    const sampleNodes = this.sampleRandom(nodes, Math.min(samples, nodes.length))

    for (const source of sampleNodes) {
      // BFS from source
      const dist = new Map<string, number>()
      const sigma = new Map<string, number>() // # shortest paths
      const pred = new Map<string, string[]>()
      const stack: string[] = []
      const queue: string[] = [source]

      for (const node of nodes) {
        dist.set(node, -1)
        sigma.set(node, 0)
        pred.set(node, [])
      }
      dist.set(source, 0)
      sigma.set(source, 1)

      while (queue.length > 0) {
        const v = queue.shift()!
        stack.push(v)

        const neighbors = adjacency.get(v)
        if (!neighbors) continue

        for (const [w] of neighbors) {
          if (dist.get(w) === -1) {
            dist.set(w, dist.get(v)! + 1)
            queue.push(w)
          }
          if (dist.get(w) === dist.get(v)! + 1) {
            sigma.set(w, sigma.get(w)! + sigma.get(v)!)
            pred.get(w)!.push(v)
          }
        }
      }

      // Back-propagation
      const delta = new Map<string, number>()
      for (const node of nodes) delta.set(node, 0)

      while (stack.length > 0) {
        const w = stack.pop()!
        for (const v of pred.get(w)!) {
          const d = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!)
          delta.set(v, delta.get(v)! + d)
        }
        if (w !== source) {
          bc.set(w, bc.get(w)! + delta.get(w)!)
        }
      }
    }

    // Normalize
    const maxBc = Math.max(...bc.values(), 1)
    for (const [k, v] of bc) {
      bc.set(k, v / maxBc)
    }

    return bc
  }

  private detectCommunities(
    nodes: string[],
    adjacency: Map<string, Map<string, number>>
  ): Record<string, number> {
    // Step 1: Connected components
    const visited = new Set<string>()
    const componentOf: Record<string, number> = {}
    let componentId = 0

    for (const node of nodes) {
      if (visited.has(node)) continue

      // BFS to find component
      const queue = [node]
      visited.add(node)
      const component: string[] = []

      while (queue.length > 0) {
        const v = queue.shift()!
        component.push(v)
        componentOf[v] = componentId

        const neighbors = adjacency.get(v)
        if (!neighbors) continue

        for (const [w] of neighbors) {
          if (!visited.has(w)) {
            visited.add(w)
            queue.push(w)
          }
        }
      }

      componentId++
    }

    // Step 2: Label propagation within large components
    // (Only refine components with >20 nodes)
    const componentSizes = new Map<number, number>()
    for (const cid of Object.values(componentOf)) {
      componentSizes.set(cid, (componentSizes.get(cid) || 0) + 1)
    }

    const labels = { ...componentOf }
    let nextLabel = componentId

    for (const [cid, size] of componentSizes) {
      if (size <= 20) continue

      // Label propagation (5 iterations)
      const componentNodes = nodes.filter((n) => componentOf[n] === cid)

      // Initialize each node with unique label
      for (const node of componentNodes) {
        labels[node] = nextLabel++
      }

      for (let iter = 0; iter < 5; iter++) {
        // Shuffle order
        const shuffled = [...componentNodes].sort(() => Math.random() - 0.5)

        for (const node of shuffled) {
          const neighbors = adjacency.get(node)
          if (!neighbors || neighbors.size === 0) continue

          // Count neighbor labels
          const labelCounts = new Map<number, number>()
          for (const [w, weight] of neighbors) {
            if (componentOf[w] !== cid) continue
            const lbl = labels[w]
            labelCounts.set(lbl, (labelCounts.get(lbl) || 0) + weight)
          }

          // Take most common label
          let maxLabel = labels[node]
          let maxCount = 0
          for (const [lbl, count] of labelCounts) {
            if (count > maxCount) {
              maxCount = count
              maxLabel = lbl
            }
          }
          labels[node] = maxLabel
        }
      }
    }

    // Renumber labels to sequential IDs
    const labelMap = new Map<number, number>()
    let nextId = 0
    const result: Record<string, number> = {}
    for (const node of nodes) {
      const lbl = labels[node]
      if (!labelMap.has(lbl)) labelMap.set(lbl, nextId++)
      result[node] = labelMap.get(lbl)!
    }

    return result
  }

  private sampleRandom<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }
}

/** Pipeline stage handler (batch operation — use NetworkMetricsService.computeAll() for batch) */
export async function handleNetworkMetrics(
  _documentId: string,
  _supabase: SupabaseClient
): Promise<void> {
  // Network metrics are a batch operation across the entire entity graph, not per-document
}
