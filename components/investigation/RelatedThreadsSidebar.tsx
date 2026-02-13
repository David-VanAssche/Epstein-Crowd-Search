// components/investigation/RelatedThreadsSidebar.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThreadConvergence } from './ThreadConvergence'
import { GitMerge } from 'lucide-react'

interface RelatedThreadsSidebarProps {
  threadId: string
}

export function RelatedThreadsSidebar({ threadId }: RelatedThreadsSidebarProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Related Threads</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ThreadConvergence threadId={threadId} />
      </CardContent>
    </Card>
  )
}
