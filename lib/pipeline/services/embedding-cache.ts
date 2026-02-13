// lib/pipeline/services/embedding-cache.ts
// Two-tier embedding cache: L1 in-memory LRU + L2 Supabase lookup.
// Wraps any embedding call to avoid re-computing embeddings for identical text.

import { createHash } from 'crypto'
import { LRUCache } from 'lru-cache'

export interface EmbeddingCacheConfig {
  maxMemoryEntries: number
}

export class EmbeddingCache {
  private l1: LRUCache<string, number[]>

  constructor(config: EmbeddingCacheConfig = { maxMemoryEntries: 10_000 }) {
    this.l1 = new LRUCache<string, number[]>({ max: config.maxMemoryEntries })
  }

  static hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }

  getFromMemory(textHash: string): number[] | undefined {
    return this.l1.get(textHash)
  }

  setInMemory(textHash: string, embedding: number[]): void {
    this.l1.set(textHash, embedding)
  }

  async getOrCompute(
    text: string,
    computeFn: (text: string) => Promise<number[]>
  ): Promise<number[]> {
    const hash = EmbeddingCache.hashText(text)
    const cached = this.l1.get(hash)
    if (cached) return cached

    const embedding = await computeFn(text)
    this.l1.set(hash, embedding)
    return embedding
  }

  async batchGetOrCompute(
    texts: string[],
    batchComputeFn: (texts: string[]) => Promise<number[][]>
  ): Promise<number[][]> {
    const results: (number[] | null)[] = new Array(texts.length).fill(null)
    const uncachedIndices: number[] = []
    const uncachedTexts: string[] = []

    for (let i = 0; i < texts.length; i++) {
      const hash = EmbeddingCache.hashText(texts[i])
      const cached = this.l1.get(hash)
      if (cached) {
        results[i] = cached
      } else {
        uncachedIndices.push(i)
        uncachedTexts.push(texts[i])
      }
    }

    if (uncachedTexts.length > 0) {
      const computed = await batchComputeFn(uncachedTexts)
      for (let i = 0; i < uncachedIndices.length; i++) {
        const originalIndex = uncachedIndices[i]
        results[originalIndex] = computed[i]
        const hash = EmbeddingCache.hashText(uncachedTexts[i])
        this.l1.set(hash, computed[i])
      }
    }

    return results as number[][]
  }

  stats(): { memorySize: number; maxMemory: number } {
    return { memorySize: this.l1.size, maxMemory: this.l1.max }
  }
}
