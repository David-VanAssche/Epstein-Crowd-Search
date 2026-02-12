// components/document/ChunkNavigator.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Chunk {
  id: string
  content: string
  page_number: number | null
  contextual_header: string | null
}

interface ChunkNavigatorProps {
  chunks: Chunk[]
}

export function ChunkNavigator({ chunks }: ChunkNavigatorProps) {
  const scrollToChunk = (index: number) => {
    document.getElementById(`chunk-${index}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Sections ({chunks.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-1">
            {chunks.map((chunk, i) => (
              <Button
                key={chunk.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => scrollToChunk(i)}
              >
                {chunk.page_number && <span className="mr-2 text-muted-foreground">p.{chunk.page_number}</span>}
                <span className="truncate">{chunk.contextual_header || chunk.content.slice(0, 40)}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
