import { EmptyState } from '@/components/shared/EmptyState'
export default function EntityNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <EmptyState variant="no-results" title="Entity Not Found" description="This entity doesn't exist in the database." />
    </div>
  )
}
