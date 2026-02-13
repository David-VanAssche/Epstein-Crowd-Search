// components/entity/PropertyOwnershipTimeline.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building, ArrowRight, AlertTriangle } from 'lucide-react'
import { usePropertyOwnership } from '@/lib/hooks/usePropertyOwnership'
import { LoadingState } from '@/components/shared/LoadingState'
import Link from 'next/link'

interface PropertyOwnershipTimelineProps {
  entityId: string
}

function formatDate(d: string | null) {
  if (!d) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }).format(new Date(d))
}

function formatAmount(n: number | null) {
  if (n === null) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function PropertyOwnershipTimeline({ entityId }: PropertyOwnershipTimelineProps) {
  const { entity, asProperty, asOwner, isLoading } = usePropertyOwnership(entityId)

  if (isLoading) return <LoadingState variant="list" count={3} />

  const hasData = asProperty.length > 0 || asOwner.length > 0

  if (!hasData) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No ownership records found for this entity.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {asProperty.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ownership History</CardTitle>
            <p className="text-xs text-muted-foreground">Who has owned this property over time</p>
          </CardHeader>
          <CardContent>
            <div className="relative border-l-2 border-border pl-6 space-y-6">
              {asProperty.map((record) => (
                <div key={record.id} className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-border bg-background" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatDate(record.from_date)}
                        {record.to_date ? ` — ${formatDate(record.to_date)}` : ' — Present'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {record.owner_id ? (
                        <Link href={`/entity/${record.owner_id}`} className="text-accent hover:underline font-medium">
                          {record.owner_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{record.owner_name || 'Unknown owner'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {record.acquisition_type && (
                        <Badge variant="secondary" className="text-xs">{record.acquisition_type}</Badge>
                      )}
                      {record.acquisition_amount && (
                        <Badge variant="outline" className="text-xs">{formatAmount(record.acquisition_amount)}</Badge>
                      )}
                      {record.shell_company && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" /> Shell Company
                          {record.shell_company_name && `: ${record.shell_company_name}`}
                        </Badge>
                      )}
                    </div>
                    {record.notes && (
                      <p className="text-xs text-muted-foreground">{record.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {asOwner.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Properties Owned</CardTitle>
            <p className="text-xs text-muted-foreground">Properties associated with this entity</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {asOwner.map((record) => (
                <div key={record.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Building className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    {record.property_id ? (
                      <Link href={`/entity/${record.property_id}`} className="text-sm font-medium text-accent hover:underline">
                        {record.property_name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{record.property_name || 'Unknown property'}</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(record.from_date)}{record.to_date ? ` — ${formatDate(record.to_date)}` : ' — Present'}
                      {record.acquisition_amount && ` | ${formatAmount(record.acquisition_amount)}`}
                    </p>
                  </div>
                  {record.shell_company && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Shell
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
