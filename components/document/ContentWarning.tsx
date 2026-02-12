// components/document/ContentWarning.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export function ContentWarning() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const pref = localStorage.getItem('content-warning-dismissed')
    setDismissed(pref === 'true')
  }, [])

  if (dismissed) return null

  return (
    <div className="rounded-lg border border-amber-600/30 bg-amber-950/20 p-4">
      <h3 className="mb-2 font-semibold text-amber-400">Content Warning</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        This document may contain descriptions of abuse, exploitation, or other disturbing content.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          localStorage.setItem('content-warning-dismissed', 'true')
          setDismissed(true)
        }}
      >
        I understand, continue
      </Button>
    </div>
  )
}
