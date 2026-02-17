'use client'

import { useState } from 'react'
import { usePipelineStats } from '@/lib/hooks/usePipelineStats'
import type { StageCount } from '@/lib/hooks/usePipelineStats'
import {
  PIPELINE_STAGE_INFO,
  TOTAL_COST_PER_PAGE,
  TOTAL_COST_PER_IMAGE,
  TOTAL_COST_PER_VIDEO_MINUTE,
  TOTAL_COST_PER_AUDIO_MINUTE,
} from '@/lib/pipeline/stage-info'
import type { StageInfo } from '@/lib/pipeline/stage-info'
import { PipelineStage } from '@/lib/pipeline/stages'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ScanText, FolderKanban, LayoutList, Eye, TextQuote, Users,
  EyeOff, Binary, Share2, Clock, FileText, Mail, DollarSign,
  AlertTriangle, Plane, Network, ShieldAlert,
  ChevronDown, ChevronUp, ArrowDown, Zap,
  FileImage, Video, Headphones,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  ScanText, FolderKanban, LayoutList, Eye, TextQuote, Users,
  EyeOff, Binary, Share2, Clock, FileText, Mail, DollarSign,
  AlertTriangle, Plane, Network, ShieldAlert,
}

const LAYER_LABELS: Record<number, string> = {
  0: 'Foundation',
  1: 'Understanding',
  2: 'Enrichment',
  3: 'Deep Analysis',
  4: 'Scoring & Linking',
  5: 'Network Intelligence',
  6: 'Final Scoring',
}

const LAYER_COLORS: Record<number, string> = {
  0: 'border-blue-500/30 bg-blue-950/10',
  1: 'border-indigo-500/30 bg-indigo-950/10',
  2: 'border-violet-500/30 bg-violet-950/10',
  3: 'border-purple-500/30 bg-purple-950/10',
  4: 'border-amber-500/30 bg-amber-950/10',
  5: 'border-orange-500/30 bg-orange-950/10',
  6: 'border-red-500/30 bg-red-950/10',
}

function formatCost(cost: number): string {
  if (cost === 0) return 'Free'
  if (cost < 0.001) return `$${(cost * 1000).toFixed(2)}/1K`
  return `$${cost.toFixed(4)}`
}

function StageCard({ info, completed, total, onFund }: {
  info: StageInfo
  completed: number
  total: number
  onFund: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = ICON_MAP[info.icon] ?? Zap
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  const remaining = Math.max(0, total - completed)
  const isFree = info.costs.perPage === 0 && info.costs.perImage === 0
  const estimatedCostRemaining = remaining * info.costs.perPage

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${LAYER_COLORS[info.layer]}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/50">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{info.label}</h3>
            {isFree && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Free
              </Badge>
            )}
            {pct === 100 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-green-600">
                Done
              </Badge>
            )}
          </div>

          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {info.whatItDoes}
          </p>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {completed.toLocaleString()} / {total.toLocaleString()} documents
              </span>
              <span className="font-medium">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>

          {/* Expandable details */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less' : 'Details & costs'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
              {/* What it unlocks */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  What this unlocks
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {info.whatItUnlocks}
                </p>
              </div>

              {/* Cost table */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Cost per unit
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Per page:</span>
                    <span className="font-medium">{formatCost(info.costs.perPage)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileImage className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Per image:</span>
                    <span className="font-medium">{formatCost(info.costs.perImage)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Per video min:</span>
                    <span className="font-medium">{formatCost(info.costs.perVideoMinute)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Headphones className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Per audio min:</span>
                    <span className="font-medium">{formatCost(info.costs.perAudioMinute)}</span>
                  </div>
                </div>
              </div>

              {/* Cost to complete this stage */}
              {!isFree && remaining > 0 && (
                <div className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Cost to finish this stage ({remaining.toLocaleString()} docs):
                  </span>
                  <span className="text-sm font-bold text-primary">
                    ${estimatedCostRemaining.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Fund button */}
              {!isFree && remaining > 0 && (
                <Button size="sm" className="w-full" onClick={onFund}>
                  Fund This Stage
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PipelineFunnel() {
  const { data, isLoading } = usePipelineStats()
  const stats = data?.data

  const totalDocs = stats?.total_documents ?? 0
  const byStage = stats?.by_stage ?? {}
  const mediaType = stats?.by_media_type ?? { pdf: 0, image: 0, video: 0, audio: 0 }

  // Group stages by layer
  const layers = new Map<number, StageInfo[]>()
  for (const info of PIPELINE_STAGE_INFO) {
    const existing = layers.get(info.layer) ?? []
    existing.push(info)
    layers.set(info.layer, existing)
  }

  // Total cost estimates
  const totalPages = stats?.total_pages ?? 0
  const estimatedTotalCost =
    totalPages * TOTAL_COST_PER_PAGE +
    mediaType.image * TOTAL_COST_PER_IMAGE +
    (mediaType.video * 5) * TOTAL_COST_PER_VIDEO_MINUTE + // assume 5 min avg
    (mediaType.audio * 10) * TOTAL_COST_PER_AUDIO_MINUTE   // assume 10 min avg

  function handleFundStage() {
    window.location.href = '/funding'
  }

  /** Get per-stage completion from the by_stage RPC data */
  function getStageCompletion(stage: PipelineStage): StageCount {
    return byStage[stage] ?? { completed: 0, total: totalDocs }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-border bg-surface p-6">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="mt-3 h-2 w-full rounded bg-muted" />
            <div className="mt-2 h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Corpus summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-primary">
              {totalDocs.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold text-primary">
                {totalPages.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total Pages</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <FileImage className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold text-primary">
                {mediaType.image.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Images</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold text-primary">
                {mediaType.video.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Videos</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface">
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Headphones className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold text-primary">
                {mediaType.audio.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Audio Files</p>
          </CardContent>
        </Card>
      </div>

      {/* Estimated total cost */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-2 py-6 sm:flex-row sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              Estimated cost to fully process the entire corpus
            </div>
            <div className="text-xs text-muted-foreground">
              All 17 stages across {totalPages.toLocaleString()} pages, {mediaType.image.toLocaleString()} images, {mediaType.video.toLocaleString()} videos, {mediaType.audio.toLocaleString()} audio files
            </div>
          </div>
          <div className="text-3xl font-bold text-primary">
            ${estimatedTotalCost.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      {/* All-stage cost-per-unit reference */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-base">Full Pipeline Cost Per Unit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-background px-4 py-3 text-center">
              <div className="text-lg font-bold text-primary">
                ${TOTAL_COST_PER_PAGE.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">per document page</div>
              <div className="mt-1 text-[10px] text-muted-foreground/60">
                17 stages, full enrichment
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-4 py-3 text-center">
              <div className="text-lg font-bold text-primary">
                ${TOTAL_COST_PER_IMAGE.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">per image</div>
              <div className="mt-1 text-[10px] text-muted-foreground/60">
                OCR + entity extraction + embedding
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-4 py-3 text-center">
              <div className="text-lg font-bold text-primary">
                ${TOTAL_COST_PER_VIDEO_MINUTE.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">per video minute</div>
              <div className="mt-1 text-[10px] text-muted-foreground/60">
                Transcription + full text pipeline
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-4 py-3 text-center">
              <div className="text-lg font-bold text-primary">
                ${TOTAL_COST_PER_AUDIO_MINUTE.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">per audio minute</div>
              <div className="mt-1 text-[10px] text-muted-foreground/60">
                Whisper transcription + analysis
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline funnel — grouped by layer */}
      <div className="space-y-6">
        {Array.from(layers.entries())
          .sort(([a], [b]) => a - b)
          .map(([layerNum, stages], layerIdx) => (
            <div key={layerNum}>
              {/* Layer header */}
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {layerNum}
                </div>
                <h2 className="text-lg font-bold">{LAYER_LABELS[layerNum]}</h2>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Stage cards in this layer */}
              <div className="grid gap-3 lg:grid-cols-2">
                {stages.map((info) => {
                  const sc = getStageCompletion(info.stage)
                  return (
                    <StageCard
                      key={info.stage}
                      info={info}
                      completed={sc.completed}
                      total={sc.total || totalDocs}
                      onFund={handleFundStage}
                    />
                  )
                })}
              </div>

              {/* Arrow between layers */}
              {layerIdx < layers.size - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
