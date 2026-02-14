// app/(auth)/pinboard/page.tsx
'use client'

import { useState } from 'react'
import { PinboardCanvas } from '@/components/pinboard/PinboardCanvas'
import { AddPinDialog } from '@/components/pinboard/AddPinDialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'

interface Pin {
  id: string
  type: 'document' | 'entity' | 'image' | 'note'
  title: string
  description?: string
  referenceId?: string
  position: { x: number; y: number }
}

interface Connection {
  id: string
  fromPinId: string
  toPinId: string
  label: string
}

interface Board {
  id: string
  name: string
  pins: Pin[]
  connections: Connection[]
  isPublic: boolean
}

export default function PinboardPage() {
  const [boards] = useState<Board[]>([])
  const [activeBoard, setActiveBoard] = useState<Board | null>(null)
  const [showAddPin, setShowAddPin] = useState(false)
  const [gridSnap, setGridSnap] = useState(false)

  if (boards.length === 0 && !activeBoard) {
    return (
      <div className="flex min-h-[calc(100vh-var(--topbar-height))] items-center justify-center px-4">
        <EmptyState
          variant="not-processed"
          title="Evidence Pinboard"
          description="Create investigation boards to organize evidence. Pin documents, entities, images, and notes, then draw connections between them to build your theory. Requires sign-in."
          showFundingCTA
        />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-var(--topbar-height))] w-full overflow-hidden">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Select>
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue placeholder="Select board..." />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">New Board</Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Grid snap</Label>
            <Switch checked={gridSnap} onCheckedChange={setGridSnap} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddPin(true)}>
            Add Pin
          </Button>
          <Button variant="outline" size="sm">Export as Image</Button>
          <Button variant="ghost" size="sm">Share</Button>
        </div>
      </div>

      {activeBoard && (
        <PinboardCanvas
          pins={activeBoard.pins}
          connections={activeBoard.connections}
          gridSnap={gridSnap}
        />
      )}

      <AddPinDialog
        open={showAddPin}
        onOpenChange={setShowAddPin}
        onAddPin={(pin) => {
          setShowAddPin(false)
        }}
      />
    </div>
  )
}
