// types/finance.ts

export interface FinancialTransactionListItem {
  id: string
  from_raw: string | null
  from_entity_name: string | null
  to_raw: string | null
  to_entity_name: string | null
  amount: number | null
  currency: string
  transaction_date: string | null
  transaction_type: string | null
  description: string | null
  is_suspicious: boolean
  suspicious_reasons: string[]
  shell_company_involved: boolean
  document_id: string
  document_filename: string | null
}

export interface FinancialSummary {
  total_transactions: number
  total_amount: number
  suspicious_count: number
  shell_company_count: number
  by_type: Array<{ type: string; count: number; total: number }>
  by_year: Array<{ year: number; count: number; total: number }>
  top_senders: Array<{ name: string; count: number; total: number }>
  top_receivers: Array<{ name: string; count: number; total: number }>
}

export interface FinancialFlowNode {
  id: string
  name: string
  type: 'person' | 'organization' | 'account' | 'unknown'
}

export interface FinancialFlowLink {
  source: string
  target: string
  value: number
  transaction_count: number
  is_suspicious: boolean
}

export interface FinancialFiltersState {
  entityId: string | null
  minAmount: number | null
  maxAmount: number | null
  transactionType: string | null
  isSuspicious: boolean | null
  dateFrom: string | null
  dateTo: string | null
}
