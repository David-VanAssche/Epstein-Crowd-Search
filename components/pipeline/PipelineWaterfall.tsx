'use client'

import { usePipelineStats } from '@/lib/hooks/usePipelineStats'
import { PIPELINE_STAGE_INFO } from '@/lib/pipeline/stage-info'
import { PipelineStage } from '@/lib/pipeline/stages'
import {
  UNIVERSAL_STAGES,
  GLOBAL_STAGES,
  CONDITIONAL_STAGES,
  getEligibleCount,
} from '@/lib/pipeline/flow-config'
import { FlowSection } from './FlowSection'
import { StageRow } from './StageRow'
import { ClassificationBreakdown } from './ClassificationBreakdown'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  ScanText, FolderKanban, LayoutList, Eye, TextQuote, Users,
  EyeOff, Binary, Share2, Clock, FileText, Mail, DollarSign,
  AlertTriangle, Plane, Network, ShieldAlert, Zap, Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  ScanText, FolderKanban, LayoutList, Eye, TextQuote, Users,
  EyeOff, Binary, Share2, Clock, FileText, Mail, DollarSign,
  AlertTriangle, Plane, Network, ShieldAlert,
}

// Validate icon map at module load (fix #8)
if (process.env.NODE_ENV === 'development') {
  for (const info of PIPELINE_STAGE_INFO) {
    if (!(info.icon in ICON_MAP)) {
      console.warn(`[PipelineWaterfall] Unknown icon: ${info.icon} for stage ${info.stage}`)
    }
  }
}

function getStageIcon(stage: PipelineStage): LucideIcon {
  const info = PIPELINE_STAGE_INFO.find((s) => s.stage === stage)
  return (info ? ICON_MAP[info.icon] : undefined) ?? Zap
}

function getStageLabel(stage: PipelineStage): string {
  const info = PIPELINE_STAGE_INFO.find((s) => s.stage === stage)
  return info?.label ?? stage
}

function estimateCostPerPage(): number {
  return PIPELINE_STAGE_INFO.reduce((sum, s) => sum + s.costs.perPage, 0)
}

export function PipelineWaterfall() {
  // Fix #2: hook now returns PipelineFlowStats directly (no double-unwrap)
  const { data: stats, isLoading, isError } = usePipelineStats()

  const totalDocs = stats?.total_documents ?? 0
  const ocrCompleted = stats?.ocr_completed ?? 0
  const classified = stats?.classified ?? 0
  const stageCompleted = stats?.stage_completed ?? {}
  const classBreakdown = stats?.classification_breakdown ?? {}

  // Fix #5: label clarifies this is per-page estimate
  const costPerPage = estimateCostPerPage()
  const estimatedTotalCost = totalDocs * costPerPage

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-border bg-surface p-6">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="mt-3 h-2 w-full rounded bg-muted" />
            <div className="mt-2 h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  // Fix #6: render error state instead of silent all-zeros
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-muted-foreground">
        Failed to load pipeline stats. Please refresh the page.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-2">
      {/* ─── Corpus Overview ─── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="text-lg font-bold">
                {totalDocs.toLocaleString()} documents
              </div>
              {/* Fix #5: clarify cost is approximate (1 pg/doc assumption) */}
              <p className="text-sm text-muted-foreground">
                Corpus total &middot; Est. processing cost: ~${estimatedTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} (assumes 1 pg/doc avg)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center py-1">
        <div className="h-5 w-px bg-muted-foreground/20" />
      </div>

      {/* ─── 1 OCR & Text Extraction ─── */}
      <FlowSection number={1} title="OCR & Text Extraction" subtitle={`${ocrCompleted.toLocaleString()} documents ready for classification`}>
        <StageRow
          icon={ScanText}
          label="OCR"
          completed={ocrCompleted}
          eligible={totalDocs}
        />
      </FlowSection>

      {/* ─── 2 Classification ─── */}
      <FlowSection
        number={2}
        title="Classification"
        subtitle={`${classified.toLocaleString()} of ${ocrCompleted.toLocaleString()} OCR'd documents classified`}
      >
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{classified.toLocaleString()} / {ocrCompleted.toLocaleString()}</span>
            <span className="font-medium">
              {ocrCompleted > 0 ? Math.round((classified / ocrCompleted) * 100) : 0}%
            </span>
          </div>
          <Progress
            value={ocrCompleted > 0 ? Math.min(100, Math.round((classified / ocrCompleted) * 100)) : 0}
            className="h-1.5"
          />
        </div>
        <ClassificationBreakdown
          breakdown={classBreakdown}
          totalClassified={classified}
        />
      </FlowSection>

      {/* ─── 3 Universal Stages ─── */}
      <FlowSection
        number={3}
        title="Universal Stages"
        subtitle={`Run on all ${classified.toLocaleString()} classified documents`}
      >
        {UNIVERSAL_STAGES.map((stage) => (
          <StageRow
            key={stage}
            icon={getStageIcon(stage)}
            label={getStageLabel(stage)}
            completed={stageCompleted[stage] ?? 0}
            eligible={classified}
          />
        ))}
      </FlowSection>

      {/* ─── 4 Conditional Stages ─── */}
      <FlowSection number={4} title="Conditional Stages" subtitle="Routed by document classification">
        <div className="space-y-3">
          {CONDITIONAL_STAGES.map((config) => {
            // Fix #4: heuristic-only stages use classified as superset, not completed=eligible
            const eligible = config.types.length > 0
              ? getEligibleCount(config.types, classBreakdown)
              : config.isHeuristic
                ? classified
                : 0
            const completed = stageCompleted[config.stage] ?? 0

            // Fix #7: always show all stages (with "Pending" when 0/0)
            return (
              <div key={config.stage} className="rounded-md border border-border/50 px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{config.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{config.description}</span>
                  </div>
                </div>
                <StageRow
                  icon={getStageIcon(config.stage)}
                  label=""
                  completed={completed}
                  eligible={eligible}
                  isApproximate={config.isHeuristic}
                />
              </div>
            )
          })}
        </div>
      </FlowSection>

      {/* ─── 5 Global Stages ─── */}
      <FlowSection number={5} title="Global Stages" subtitle="Run across all data" showConnector={false}>
        {/* Fix #11: extract Icon variable instead of IIFE */}
        {GLOBAL_STAGES.map((stage) => {
          const Icon = getStageIcon(stage)
          const completed = stageCompleted[stage] ?? 0
          return (
            <div key={stage} className="flex items-center gap-3 py-1.5">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm">{getStageLabel(stage)}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {completed > 0 ? `${completed.toLocaleString()} runs` : 'Pending'}
              </span>
            </div>
          )
        })}
      </FlowSection>
    </div>
  )
}
