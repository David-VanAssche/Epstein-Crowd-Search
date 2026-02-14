'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { ContributionForm } from './ContributionForm'
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

interface CampaignDetailCardProps {
  campaign: Campaign
}

export function CampaignDetailCard({ campaign }: CampaignDetailCardProps) {
  const Icon = ICON_MAP[campaign.icon] ?? Layers

  return (
    <Card className="border-border bg-surface">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{campaign.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{campaign.description}</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{campaign.progress_percent}% processed</span>
            <span>{campaign.total_units_processed.toLocaleString()} / {campaign.total_units.toLocaleString()}</span>
          </div>
          <Progress value={campaign.progress_percent} className="h-2" />
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            ${Number(campaign.funded_amount).toFixed(2)} funded
          </span>
          <span className="text-muted-foreground">
            ${campaign.total_cost.toFixed(2)} needed
          </span>
        </div>

        <ContributionForm campaignSlug={campaign.slug} />
      </CardContent>
    </Card>
  )
}
