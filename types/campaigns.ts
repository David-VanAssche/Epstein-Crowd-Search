export interface Campaign {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  pipeline_stages: string[]
  total_units: number
  total_units_processed: number
  results_count: number
  cost_per_unit: number
  funded_amount: number
  spent_amount: number
  status: 'active' | 'funded' | 'processing' | 'complete' | 'paused'
  created_at: string
  updated_at: string
  // Computed fields from API
  progress_percent: number
  funding_percent: number
  remaining_cost: number
  total_cost: number
}

export interface CampaignListResponse {
  campaigns: Campaign[]
  totals: {
    total_funded: number
    total_spent: number
    total_units: number
    total_processed: number
    overall_progress: number
  }
}

export interface ContributionSummary {
  id: string
  amount_cents: number
  donor_display_name: string | null
  is_anonymous: boolean
  created_at: string
}

export interface CampaignDetailResponse {
  campaign: Campaign
  recent_contributions: ContributionSummary[]
  recent_spend: {
    id: string
    amount: number
    service: string
    description: string
    pages_processed: number
    created_at: string
  }[]
}

export interface CheckoutRequest {
  campaign_slug: string
  amount_cents: number
  donor_display_name?: string
  is_anonymous?: boolean
}

export interface CheckoutResponse {
  checkout_url: string
}
