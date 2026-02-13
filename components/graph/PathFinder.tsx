// components/graph/PathFinder.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

interface PathStep {
  entityId: string
  entityName: string
  entityType: string
  relationshipType: string
  evidenceDocuments: Array<{ id: string; filename: string; pageNumber?: number }>
}

interface PathFinderProps {
  onClose: () => void
}

export function PathFinder({ onClose }: PathFinderProps) {
  const [sourceSearch, setSourceSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [path, setPath] = useState<PathStep[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFindPath = async () => {
    if (!sourceSearch.trim() || !targetSearch.trim()) return
    setIsSearching(true)
    setError(null)
    setPath(null)
    try {
      const res = await fetch(
        `/api/graph/path?source=${encodeURIComponent(sourceSearch)}&target=${encodeURIComponent(targetSearch)}`
      )
      if (!res.ok) throw new Error('No path found')
      const data = await res.json()
      setPath(data.path)
    } catch {
      setError('No connection path found between these entities, or the API is not yet available.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <Card className="border-border bg-surface/95 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Find Connection Path</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">From entity</Label>
          <Input placeholder="e.g., Jeffrey Epstein" value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">To entity</Label>
          <Input placeholder="e.g., Bill Clinton" value={targetSearch} onChange={(e) => setTargetSearch(e.target.value)} className="h-8 text-sm" />
        </div>
        <Button onClick={handleFindPath} disabled={!sourceSearch.trim() || !targetSearch.trim() || isSearching} className="w-full" size="sm">
          {isSearching ? 'Searching...' : 'Find Connection'}
        </Button>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {path && path.length > 0 && (
          <>
            <Separator />
            <div className="text-center text-sm font-medium text-accent">
              {path.length - 1} degree{path.length - 1 !== 1 ? 's' : ''} of separation
            </div>
            <div className="space-y-3">
              {path.map((step, i) => (
                <div key={step.entityId}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">{i + 1}</div>
                    <Link href={`/entity/${step.entityId}`} className="text-sm font-medium hover:text-accent">{step.entityName}</Link>
                    <Badge variant="outline" className="text-xs">{step.entityType}</Badge>
                  </div>
                  {i < path.length - 1 && (
                    <div className="ml-3 border-l border-border py-2 pl-4">
                      <Badge variant="secondary" className="text-xs">{step.relationshipType}</Badge>
                      {step.evidenceDocuments.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {step.evidenceDocuments.slice(0, 2).map((doc) => (
                            <Link key={doc.id} href={`/document/${doc.id}`} className="block text-xs text-blue-400 hover:underline">
                              {doc.filename}{doc.pageNumber ? ` (p. ${doc.pageNumber})` : ''}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full" disabled>Export as Evidence Chain</Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
