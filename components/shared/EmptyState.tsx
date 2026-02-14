import { type LucideIcon, FileSearch, Inbox, Clock, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type EmptyStateVariant = 'not-processed' | 'no-results' | 'coming-soon' | 'community-data' | 'custom'

interface EmptyStateProps {
  variant?: EmptyStateVariant
  icon?: LucideIcon
  title?: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  showFundingCTA?: boolean
}

const variantDefaults: Record<
  Exclude<EmptyStateVariant, 'custom'>,
  { icon: LucideIcon; title: string; description: string }
> = {
  'not-processed': {
    icon: Clock,
    title: 'Not Yet Processed',
    description:
      'This content will be available once document processing is funded and complete.',
  },
  'no-results': {
    icon: FileSearch,
    title: 'No Results Found',
    description: 'Try adjusting your search terms or filters.',
  },
  'coming-soon': {
    icon: Inbox,
    title: 'Coming Soon',
    description: 'This feature is under development.',
  },
  'community-data': {
    icon: Heart,
    title: 'Community Data Available',
    description:
      'Search works on community-processed data. Fund AI processing for deeper analysis and more complete results.',
  },
}

export function EmptyState({
  variant = 'custom',
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  showFundingCTA = false,
}: EmptyStateProps) {
  const defaults = variant !== 'custom' ? variantDefaults[variant] : null
  const FinalIcon = Icon ?? defaults?.icon ?? Inbox
  const finalTitle = title ?? defaults?.title ?? 'Nothing here'
  const finalDescription = description ?? defaults?.description ?? ''

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-surface p-4 mb-4">
        <FinalIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{finalTitle}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {finalDescription}
      </p>
      {ctaLabel && ctaHref && (
        <Button asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      )}
      {showFundingCTA && (
        <Button asChild variant="outline" className="mt-2 gap-2">
          <Link href="/funding">
            <Heart className="h-4 w-4" />
            Help fund processing &rarr;
          </Link>
        </Button>
      )}
    </div>
  )
}
