// components/gamification/CascadeReplay.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

interface CascadeNode {
  id: string
  text: string
  documentId: string
  documentFilename: string
  depth: number
  parentId: string | null
}

interface CascadeReplayProps {
  cascadeData: {
    id: string
    rootRedactionId: string
    rootText: string
    totalNodes: number
    totalDocuments: number
    nodes: CascadeNode[]
  }
}

export function CascadeReplay({ cascadeData }: CascadeReplayProps) {
  const [visibleDepth, setVisibleDepth] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<'1x' | '2x' | '5x'>('1x')
  const [showTally, setShowTally] = useState(false)

  const maxDepth = Math.max(...cascadeData.nodes.map((n) => n.depth), 0)

  const speedMs = { '1x': 1500, '2x': 750, '5x': 300 }

  useEffect(() => {
    if (!isPlaying) return

    const timer = setTimeout(() => {
      if (visibleDepth < maxDepth) {
        setVisibleDepth((d) => d + 1)
      } else {
        setIsPlaying(false)
        setShowTally(true)
      }
    }, speedMs[speed])

    return () => clearTimeout(timer)
  }, [isPlaying, visibleDepth, maxDepth, speed])

  const handlePlay = useCallback(() => {
    if (visibleDepth >= maxDepth) {
      setVisibleDepth(0)
      setShowTally(false)
    }
    setIsPlaying(true)
  }, [visibleDepth, maxDepth])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setVisibleDepth(0)
    setShowTally(false)
  }, [])

  const visibleNodes = cascadeData.nodes.filter((n) => n.depth <= visibleDepth)

  const nodesByDepth: Record<number, CascadeNode[]> = {}
  visibleNodes.forEach((node) => {
    if (!nodesByDepth[node.depth]) nodesByDepth[node.depth] = []
    nodesByDepth[node.depth].push(node)
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex justify-center"
          >
            <div className="rounded-xl border-2 border-accent bg-accent/10 px-6 py-4 text-center shadow-lg shadow-accent/20">
              <Badge variant="outline" className="mb-2">Original Discovery</Badge>
              <p className="text-sm font-medium">{cascadeData.rootText}</p>
            </div>
          </motion.div>

          {Array.from({ length: maxDepth + 1 }, (_, depth) => {
            if (depth === 0) return null
            const depthNodes = nodesByDepth[depth] || []
            if (depthNodes.length === 0) return null

            return (
              <AnimatePresence key={depth}>
                {visibleDepth >= depth && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1 - depth * 0.15, y: 0 }}
                    transition={{ duration: 0.5, staggerChildren: 0.1 }}
                    className="mb-6"
                  >
                    <div className="mb-2 flex justify-center">
                      <span className="text-xs text-muted-foreground">
                        Cascade depth {depth} ({depthNodes.length} match{depthNodes.length !== 1 ? 'es' : ''})
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      {depthNodes.slice(0, 200).map((node, i) => (
                        <motion.div
                          key={node.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.05, duration: 0.3 }}
                        >
                          <Link href={`/document/${node.documentId}`}>
                            <div className="max-w-48 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated">
                              <p className="text-xs font-medium line-clamp-2">{node.text}</p>
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {node.documentFilename}
                              </p>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )
          })}

          <AnimatePresence>
            {showTally && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="mt-12 text-center"
              >
                <div className="mx-auto max-w-md rounded-xl border border-accent bg-accent/5 p-8">
                  <h2 className="mb-2 text-2xl font-bold text-accent">Cascade Impact</h2>
                  <p className="text-lg text-muted-foreground">
                    This discovery unlocked{' '}
                    <span className="font-bold text-primary">{cascadeData.totalNodes}</span>{' '}
                    connections across{' '}
                    <span className="font-bold text-primary">{cascadeData.totalDocuments}</span>{' '}
                    documents.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-border bg-surface/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={isPlaying ? () => setIsPlaying(false) : handlePlay}>
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
            <Select value={speed} onValueChange={(val) => setSpeed(val as typeof speed)}>
              <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1x">1x</SelectItem>
                <SelectItem value="2x">2x</SelectItem>
                <SelectItem value="5x">5x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Depth: {visibleDepth} / {maxDepth}
          </div>

          <Button variant="outline" size="sm" onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.share) {
              navigator.share({
                title: 'Cascade Impact',
                url: window.location.href,
              })
            } else if (typeof navigator !== 'undefined') {
              navigator.clipboard.writeText(window.location.href)
            }
          }}>
            Share
          </Button>
        </div>
      </div>
    </div>
  )
}
