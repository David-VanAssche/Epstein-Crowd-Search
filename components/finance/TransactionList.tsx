// components/finance/TransactionList.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { FinancialTransaction } from '@/types/structured-data'

interface TransactionListProps {
  transactions: FinancialTransaction[]
}

function formatAmount(amount: number | null) {
  if (amount === null) return 'Unknown'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))
}

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-surface"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">{tx.transaction_type}</Badge>
                {tx.is_suspicious && (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" /> Suspicious
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {tx.from_entity_id ? (
                  <Link href={`/entity/${tx.from_entity_id}`} className="text-accent hover:underline font-medium">
                    {tx.from_entity_name || 'Unknown sender'}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{tx.from_entity_name || 'Unknown sender'}</span>
                )}
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                {tx.to_entity_id ? (
                  <Link href={`/entity/${tx.to_entity_id}`} className="text-accent hover:underline font-medium">
                    {tx.to_entity_name || 'Unknown recipient'}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{tx.to_entity_name || 'Unknown recipient'}</span>
                )}
              </div>
              {tx.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tx.description}</p>
              )}
              {tx.suspicious_reasons && tx.suspicious_reasons.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {tx.suspicious_reasons.map((flag) => (
                    <Badge key={flag} variant="outline" className="text-xs text-amber-400 border-amber-400/30">
                      {flag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold">{formatAmount(tx.amount)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
