// components/document/DocumentBreadcrumb.tsx
'use client'

import { useEffect } from 'react'
import { setBreadcrumbLabel } from '@/lib/breadcrumbs'

export function DocumentBreadcrumb({ id, filename }: { id: string; filename: string }) {
  useEffect(() => {
    setBreadcrumbLabel(id, filename)
  }, [id, filename])

  return null
}
