// components/browse/AudioPlayer.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export function AudioPlayer() {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Now Playing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Select a recording to play</p>
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="sm" disabled>⏮</Button>
          <Button variant="outline" size="sm" disabled>▶</Button>
          <Button variant="ghost" size="sm" disabled>⏭</Button>
        </div>
        <Slider defaultValue={[0]} max={100} step={1} disabled />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0:00</span>
          <span>0:00</span>
        </div>
      </CardContent>
    </Card>
  )
}
