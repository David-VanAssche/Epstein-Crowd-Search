// components/browse/GhostFlightBadge.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Ghost } from 'lucide-react'

interface GhostFlightBadgeProps {
  manifestStatus: 'full' | 'partial' | 'missing' | null
}

export function GhostFlightBadge({ manifestStatus }: GhostFlightBadgeProps) {
  if (manifestStatus !== 'missing' && manifestStatus !== 'partial') return null

  const isGhost = manifestStatus === 'missing'
  const label = isGhost ? 'Ghost Flight' : 'Partial Manifest'
  const description = isGhost
    ? 'No passenger manifest found for this flight. Flight record exists from other sources (FAA logs, testimony, etc.).'
    : 'Passenger manifest is incomplete. Some passengers may not be listed.'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="destructive"
            className={`gap-1 ${isGhost ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'}`}
          >
            <Ghost className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
