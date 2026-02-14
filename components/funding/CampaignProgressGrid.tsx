'use client'

import { useState } from 'react'
import { useCampaigns } from '@/lib/hooks/useCampaigns'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CampaignDetailCard } from './CampaignDetailCard'
import {
  Layers, Users, Share2, Calendar, EyeOff, Plane, Mail,
  DollarSign, AlertTriangle, MapPin, Camera, Headphones,
  GitBranch, Clock, FileText, Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Campaign } from '@/types/campaigns'

const ICON_MAP: Record<string, LucideIcon> = {
  Layers, Users, Share2, Calendar, EyeOff, Plane, Mail,
  DollarSign, AlertTriangle, MapPin, Camera, Headphones,
  GitBranch, Clock, FileText, Lightbulb,
}

export function CampaignProgressGrid() {
  const { data, isLoading } = useCampaigns()
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse border-border bg-surface">
            <CardContent className="py-4">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-3 h-2 w-full rounded bg-muted" />
              <div className="mt-2 h-3 w-16 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const campaigns = data?.campaigns ?? []
  const totals = data?.totals

  return (
    <div className="space-y-8">
      {/* Aggregate stats */}
      {totals && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <div className="text-2xl font-bold text-primary">${totals.total_funded.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total Funded</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <div className="text-2xl font-bold text-primary">${totals.total_spent.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total Spent</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <div className="text-2xl font-bold text-primary">{totals.total_processed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Pages Processed</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <div className="text-2xl font-bold text-primary">{totals.overall_progress}%</div>
            <div className="text-xs text-muted-foreground">Overall Progress</div>
          </div>
        </div>
      )}

      {/* Campaign grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {campaigns.map((campaign) => {
          const Icon = ICON_MAP[campaign.icon] ?? Layers
          const isExpanded = expandedSlug === campaign.slug

          if (isExpanded) {
            return (
              <div key={campaign.slug} className="sm:col-span-2">
                <CampaignDetailCard campaign={campaign} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-xs"
                  onClick={() => setExpandedSlug(null)}
                >
                  Collapse
                </Button>
              </div>
            )
          }

          return (
            <Card
              key={campaign.slug}
              role="button"
              tabIndex={0}
              className="border-border bg-surface cursor-pointer transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setExpandedSlug(campaign.slug)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setExpandedSlug(campaign.slug)
                }
              }}
            >
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{campaign.title}</span>
                </div>
                <Progress value={campaign.progress_percent} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{campaign.progress_percent}%</span>
                  <span>${Number(campaign.funded_amount).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
