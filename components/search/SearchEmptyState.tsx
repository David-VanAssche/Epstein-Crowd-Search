'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Brain,
  Layers,
  Users,
  ShieldAlert,
  FileText,
  Calendar,
  Fingerprint,
  MapPin,
  GitMerge,
  Mic,
  Network,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const CAPABILITIES = [
  {
    icon: Brain,
    label: 'Semantic',
    tooltip: 'Meaning-based search, not just keywords',
    color: 'text-accent border-accent/30',
  },
  {
    icon: Layers,
    label: 'Multimodal',
    tooltip: 'Search documents, images, audio & video',
    color: 'text-blue-400 border-blue-400/30',
  },
  {
    icon: Users,
    label: 'Entity-Aware',
    tooltip: 'Understands people, places & organizations',
    color: 'text-entity-person border-entity-person/30',
  },
  {
    icon: ShieldAlert,
    label: 'Redaction-Aware',
    tooltip: 'Finds redacted content & recovered text',
    color: 'text-amber-400 border-amber-400/30',
  },
  {
    icon: FileText,
    label: '9 Doc Types',
    tooltip: 'Depositions, flight logs, FBI 302s & more',
    color: 'text-purple-400 border-purple-400/30',
  },
  {
    icon: Calendar,
    label: 'Temporal',
    tooltip: 'Date-range filtering with natural language',
    color: 'text-green-400 border-green-400/30',
  },
]

const SEARCH_PAGE_EXAMPLES = [
  {
    query: 'Who was present at the New York townhouse according to staff depositions?',
    icon: MapPin,
    capability: 'Entity extraction + location + doc type',
  },
  {
    query: 'Documents where original text is visible beneath blacked-out redactions',
    icon: Fingerprint,
    capability: 'OCR redaction recovery',
  },
  {
    query: 'Connections between flight passengers and financial beneficiaries',
    icon: Network,
    capability: 'Cross-document entity linking',
  },
  {
    query: 'Compare accounts of recruitment across different victim testimonies',
    icon: GitMerge,
    capability: 'Cross-document semantic analysis',
  },
  {
    query: 'Phone calls or meetings referenced in correspondence during the 2005 investigation',
    icon: Mic,
    capability: 'Temporal + semantic + doc type filtering',
  },
]

export function SearchEmptyState() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Heading */}
      <h2 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Search 3.5 Million Pages
      </h2>
      <p className="mb-6 max-w-lg text-sm text-muted-foreground">
        Semantic AI search across documents, images, audio, and video
        transcripts from the DOJ Epstein files release.
      </p>

      {/* Capability badges */}
      <TooltipProvider delayDuration={200}>
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {CAPABILITIES.map(({ icon: Icon, label, tooltip, color }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`cursor-default gap-1.5 px-2.5 py-1 text-xs ${color}`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Example queries */}
      <div className="w-full max-w-2xl">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Try an example query
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SEARCH_PAGE_EXAMPLES.map((example, i) => {
            const Icon = example.icon
            return (
              <motion.div
                key={example.query}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
              >
                <Link
                  href={`/search?q=${encodeURIComponent(example.query)}`}
                >
                  <Card className="h-full border-border bg-surface transition-all hover:border-accent/30 hover:bg-surface-elevated">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <div className="text-left">
                        <p className="text-sm text-foreground">
                          {example.query}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {example.capability}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
