'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useSidebar } from '@/components/ui/sidebar'
import { useFundingStatus } from '@/lib/hooks/useFunding'

export function FundingSidebarWidget() {
  const { data } = useFundingStatus()
  const { state } = useSidebar()
  const percentage = data?.percentage ?? 0

  if (state === 'collapsed') {
    return (
      <Link
        href="/funding"
        className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        title="Support this project"
      >
        <Heart className="h-4 w-4" />
      </Link>
    )
  }

  return (
    <Link
      href="/funding"
      className="block rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3 transition-colors hover:bg-sidebar-accent"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-sidebar-foreground/70">
          {percentage}% processed
        </span>
        <span className="text-sidebar-primary font-medium">Donate</span>
      </div>
      <Progress value={percentage} className="mt-1.5 h-1.5" />
    </Link>
  )
}
