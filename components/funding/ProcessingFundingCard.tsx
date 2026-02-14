'use client'

import { useCampaign } from '@/lib/hooks/useCampaigns'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContributionForm } from './ContributionForm'
import Link from 'next/link'
import {
  Layers, Users, Share2, Calendar, EyeOff, Plane, Mail,
  DollarSign, AlertTriangle, MapPin, Camera, Headphones,
  GitBranch, Clock, FileText, Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Layers, Users, Share2, Calendar, EyeOff, Plane, Mail,
  DollarSign, AlertTriangle, MapPin, Camera, Headphones,
  GitBranch, Clock, FileText, Lightbulb,
}

interface ProcessingFundingCardProps {
  slug: string
  title?: string
  description?: string
  variant?: 'full' | 'compact' | 'inline'
  className?: string
  hideGeneralFund?: boolean
}

export function ProcessingFundingCard({
  slug,
  title: titleOverride,
  description: descOverride,
  variant = 'full',
  className,
  hideGeneralFund = false,
}: ProcessingFundingCardProps) {
  const { data, isLoading } = useCampaign(slug)
  const campaign = data?.campaign

  // While loading, show a minimal skeleton
  if (isLoading) {
    return (
      <Card className={`border-border bg-surface animate-pulse ${className ?? ''}`}>
        <CardContent className="py-8">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="mt-3 h-3 w-full rounded bg-muted" />
          <div className="mt-4 h-2 w-full rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  // Fallback if campaign doesn't exist yet (migration not applied)
  if (!campaign) {
    return (
      <Card className={`border-border bg-surface ${className ?? ''}`}>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Processing not yet started.{' '}
            <Link href="/funding" className="text-primary hover:underline">
              Help fund processing
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  const title = titleOverride ?? campaign.title
  const description = descOverride ?? campaign.description
  const Icon = ICON_MAP[campaign.icon] ?? Layers

  // ─── Inline variant ─────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 ${className ?? ''}`}>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <Progress value={campaign.progress_percent} className="h-1.5" />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {campaign.progress_percent}% processed
        </span>
        <Link href="/funding" className="shrink-0 text-xs font-medium text-primary hover:underline">
          Fund this
        </Link>
      </div>
    )
  }

  // ─── Compact variant ────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <Card className={`border-border bg-surface ${className ?? ''}`}>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{title}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {campaign.progress_percent}%
            </span>
          </div>

          <Progress value={campaign.progress_percent} className="h-2" />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {campaign.total_units_processed.toLocaleString()} / {campaign.total_units.toLocaleString()} pages
            </span>
            <span>
              ${Number(campaign.funded_amount).toFixed(2)} funded
            </span>
          </div>

          <ContributionForm campaignSlug={slug} />
        </CardContent>
      </Card>
    )
  }

  // ─── Full variant (default) ─────────────────────────────────
  return (
    <Card className={`border-border bg-surface ${className ?? ''}`}>
      <CardContent className="py-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Processing Progress</span>
            <span>{campaign.progress_percent}%</span>
          </div>
          <Progress value={campaign.progress_percent} className="h-2.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {campaign.total_units_processed.toLocaleString()} / {campaign.total_units.toLocaleString()} pages
            </span>
            {campaign.results_count > 0 && (
              <span>{campaign.results_count.toLocaleString()} results found</span>
            )}
          </div>
        </div>

        {/* Funding status */}
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-sm">
            <span className="font-semibold text-primary">
              ${Number(campaign.funded_amount).toFixed(2)}
            </span>{' '}
            <span className="text-muted-foreground">
              funded of ${campaign.total_cost.toFixed(2)} needed
            </span>
          </p>
        </div>

        {/* Contribution form */}
        <ContributionForm campaignSlug={slug} />

        {/* General fund link */}
        {!hideGeneralFund && slug !== 'general' && (
          <div className="text-center">
            <span className="text-xs text-muted-foreground">or</span>
            <Link
              href="/funding"
              className="ml-1 text-xs font-medium text-primary hover:underline"
            >
              Support All Processing
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
