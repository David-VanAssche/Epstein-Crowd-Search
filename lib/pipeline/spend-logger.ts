// lib/pipeline/spend-logger.ts
// Wrapper for the log_processing_spend database function.
// Called by batch scripts after processing to record spend and update campaign progress.

import { createServiceClient } from '@/lib/supabase/service'

interface LogBatchSpendParams {
  campaignSlug: string
  service: string
  description: string
  pagesProcessed: number
  costPerPage: number
  entitiesExtracted?: number
  redactionsDetected?: number
}

export async function logBatchSpend({
  campaignSlug,
  service,
  description,
  pagesProcessed,
  costPerPage,
  entitiesExtracted = 0,
  redactionsDetected = 0,
}: LogBatchSpendParams): Promise<string | null> {
  const supabase = createServiceClient()
  const amount = pagesProcessed * costPerPage

  const { data, error } = await supabase.rpc('log_processing_spend', {
    p_campaign_slug: campaignSlug,
    p_amount: amount,
    p_service: service,
    p_description: description,
    p_pages_processed: pagesProcessed,
    p_entities_extracted: entitiesExtracted,
    p_redactions_detected: redactionsDetected,
  })

  if (error) {
    console.error('[spend-logger] Failed to log spend:', error.message)
    return null
  }

  return data as string
}
