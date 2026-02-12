import { EmptyState } from '@/components/shared/EmptyState'
export default function DocumentNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <EmptyState variant="no-results" title="Document Not Found" description="This document doesn't exist or has been removed." />
    </div>
  )
}
