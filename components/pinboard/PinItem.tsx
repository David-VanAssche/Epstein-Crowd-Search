// components/pinboard/PinItem.tsx
'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Pin {
  id: string
  type: 'document' | 'entity' | 'image' | 'note'
  title: string
  description?: string
  referenceId?: string
  position: { x: number; y: number }
}

const PIN_TYPE_COLORS: Record<string, string> = {
  document: 'border-blue-500/50',
  entity: 'border-purple-500/50',
  image: 'border-green-500/50',
  note: 'border-amber-500/50',
}

interface PinItemProps {
  pin: Pin
  position: { x: number; y: number }
  onDrag: (position: { x: number; y: number }) => void
  onStartConnection: () => void
  isConnecting: boolean
}

export function PinItem({ pin, position, onDrag, onStartConnection, isConnecting }: PinItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const cleanupRef = useRef<(() => void) | null>(null)

  // Clean up drag listeners on unmount
  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      onDrag({
        x: moveEvent.clientX - dragStart.current.x,
        y: moveEvent.clientY - dragStart.current.y,
      })
    }

    const cleanup = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', cleanup)
      cleanupRef.current = null
    }

    cleanupRef.current = cleanup
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', cleanup)
  }, [position, onDrag])

  const borderColor = PIN_TYPE_COLORS[pin.type] || 'border-border'

  return (
    <div
      className="absolute"
      style={{ left: position.x, top: position.y }}
    >
      <Card
        className={`w-48 cursor-grab border-2 bg-surface shadow-lg ${borderColor} ${
          isDragging ? 'cursor-grabbing opacity-90 shadow-xl' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{pin.type}</Badge>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-xs"
                onClick={onStartConnection}
                title="Draw connection"
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-xs text-red-400"
                title="Remove pin"
              >
                x
              </Button>
            </div>
          </div>
          <p className="text-xs font-medium line-clamp-2">{pin.title}</p>
          {pin.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pin.description}</p>
          )}
        </CardContent>
      </Card>

      {isConnecting && (
        <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-accent bg-background" />
      )}
    </div>
  )
}
