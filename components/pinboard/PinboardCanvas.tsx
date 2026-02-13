// components/pinboard/PinboardCanvas.tsx
'use client'

import { useRef, useState, useCallback } from 'react'
import { PinItem } from '@/components/pinboard/PinItem'

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

interface PinboardCanvasProps {
  pins: Pin[]
  connections: Connection[]
  gridSnap: boolean
}

export function PinboardCanvas({ pins, connections, gridSnap }: PinboardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [pinPositions, setPinPositions] = useState<Record<string, { x: number; y: number }>>(
    Object.fromEntries(pins.map((p) => [p.id, p.position]))
  )
  const [drawingConnection, setDrawingConnection] = useState<string | null>(null)

  const handlePinDrag = useCallback((pinId: string, newPosition: { x: number; y: number }) => {
    const snapped = gridSnap
      ? { x: Math.round(newPosition.x / 20) * 20, y: Math.round(newPosition.y / 20) * 20 }
      : newPosition
    setPinPositions((prev) => ({ ...prev, [pinId]: snapped }))
  }, [gridSnap])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => Math.max(0.25, Math.min(3, s * delta)))
  }, [])

  return (
    <div
      ref={canvasRef}
      className="h-full w-full cursor-grab overflow-hidden bg-[#0a0a0f] pt-12"
      onWheel={handleWheel}
      style={{
        backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
        backgroundSize: `${20 * scale}px ${20 * scale}px`,
      }}
    >
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {connections.map((conn) => {
            const from = pinPositions[conn.fromPinId]
            const to = pinPositions[conn.toPinId]
            if (!from || !to) return null

            return (
              <g key={conn.id}>
                <line
                  x1={from.x + 100}
                  y1={from.y + 40}
                  x2={to.x + 100}
                  y2={to.y + 40}
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  opacity="0.6"
                />
                {conn.label && (
                  <text
                    x={(from.x + to.x) / 2 + 100}
                    y={(from.y + to.y) / 2 + 40}
                    fill="#94a3b8"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {pins.map((pin) => (
          <PinItem
            key={pin.id}
            pin={pin}
            position={pinPositions[pin.id] || pin.position}
            onDrag={(pos) => handlePinDrag(pin.id, pos)}
            onStartConnection={() => setDrawingConnection(pin.id)}
            isConnecting={drawingConnection !== null}
          />
        ))}
      </div>
    </div>
  )
}
