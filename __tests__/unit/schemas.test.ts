import { describe, it, expect } from 'vitest'
import {
  searchRequestSchema,
  multimodalSearchRequestSchema,
  chatRequestSchema,
  proposalRequestSchema,
  voteRequestSchema,
  timelineQuerySchema,
  annotationRequestSchema,
  threadCreateSchema,
  threadItemSchema,
  ocrCorrectionSchema,
  bountyCreateSchema,
  factCreateSchema,
  entityConnectionsSchema,
  paginationSchema,
} from '@/lib/api/schemas'

const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('searchRequestSchema', () => {
  it('accepts minimal valid input', () => {
    const result = searchRequestSchema.safeParse({ query: 'epstein' })
    expect(result.success).toBe(true)
  })

  it('applies default values', () => {
    const result = searchRequestSchema.parse({ query: 'test' })
    expect(result.page).toBe(1)
    expect(result.per_page).toBe(20)
    expect(result.sort).toBe('relevance')
  })

  it('rejects empty query', () => {
    const result = searchRequestSchema.safeParse({ query: '' })
    expect(result.success).toBe(false)
  })

  it('rejects query exceeding 500 chars', () => {
    const result = searchRequestSchema.safeParse({ query: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts query at 500 chars', () => {
    const result = searchRequestSchema.safeParse({ query: 'a'.repeat(500) })
    expect(result.success).toBe(true)
  })

  it('accepts valid filters', () => {
    const result = searchRequestSchema.safeParse({
      query: 'test',
      filters: { dataset_id: UUID, has_redactions: true },
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID dataset_id filter', () => {
    const result = searchRequestSchema.safeParse({
      query: 'test',
      filters: { dataset_id: 'not-a-uuid' },
    })
    expect(result.success).toBe(false)
  })

  it('accepts all sort values', () => {
    for (const sort of ['relevance', 'date_asc', 'date_desc', 'mentions'] as const) {
      expect(searchRequestSchema.safeParse({ query: 'q', sort }).success).toBe(true)
    }
  })

  it('rejects invalid sort value', () => {
    const result = searchRequestSchema.safeParse({ query: 'q', sort: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects page < 1', () => {
    expect(searchRequestSchema.safeParse({ query: 'q', page: 0 }).success).toBe(false)
  })

  it('rejects per_page > 100', () => {
    expect(searchRequestSchema.safeParse({ query: 'q', per_page: 101 }).success).toBe(false)
  })

  it('rejects non-integer page', () => {
    expect(searchRequestSchema.safeParse({ query: 'q', page: 1.5 }).success).toBe(false)
  })

  it('accepts optional filters as undefined', () => {
    const result = searchRequestSchema.safeParse({ query: 'q' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.filters).toBeUndefined()
    }
  })

  it('accepts per_page at boundary 100', () => {
    expect(searchRequestSchema.safeParse({ query: 'q', per_page: 100 }).success).toBe(true)
  })
})

describe('multimodalSearchRequestSchema', () => {
  it('accepts minimal input', () => {
    expect(multimodalSearchRequestSchema.safeParse({ query: 'test' }).success).toBe(true)
  })

  it('applies default modalities', () => {
    const result = multimodalSearchRequestSchema.parse({ query: 'test' })
    expect(result.modalities).toEqual({ documents: true, images: true, videos: true })
  })

  it('allows overriding modalities', () => {
    const result = multimodalSearchRequestSchema.parse({
      query: 'test',
      modalities: { documents: true, images: false, videos: false },
    })
    expect(result.modalities.images).toBe(false)
  })

  it('rejects empty query', () => {
    expect(multimodalSearchRequestSchema.safeParse({ query: '' }).success).toBe(false)
  })
})

describe('chatRequestSchema', () => {
  it('accepts minimal valid input', () => {
    const result = chatRequestSchema.safeParse({ message: 'hello', session_id: 'abc' })
    expect(result.success).toBe(true)
  })

  it('applies default model_tier', () => {
    const result = chatRequestSchema.parse({ message: 'hello', session_id: 'abc' })
    expect(result.model_tier).toBe('free')
  })

  it('rejects empty message', () => {
    expect(chatRequestSchema.safeParse({ message: '', session_id: 'abc' }).success).toBe(false)
  })

  it('rejects message > 4000 chars', () => {
    expect(chatRequestSchema.safeParse({ message: 'a'.repeat(4001), session_id: 'abc' }).success).toBe(false)
  })

  it('requires session_id', () => {
    expect(chatRequestSchema.safeParse({ message: 'hello' }).success).toBe(false)
  })

  it('rejects empty session_id', () => {
    expect(chatRequestSchema.safeParse({ message: 'hello', session_id: '' }).success).toBe(false)
  })

  it('accepts valid model tiers', () => {
    for (const tier of ['free', 'researcher', 'pro'] as const) {
      expect(chatRequestSchema.safeParse({ message: 'hi', session_id: 's', model_tier: tier }).success).toBe(true)
    }
  })

  it('accepts optional conversation_id', () => {
    const result = chatRequestSchema.safeParse({
      message: 'hi',
      session_id: 's',
      conversation_id: UUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID conversation_id', () => {
    const result = chatRequestSchema.safeParse({
      message: 'hi',
      session_id: 's',
      conversation_id: 'bad',
    })
    expect(result.success).toBe(false)
  })
})

describe('proposalRequestSchema', () => {
  const valid = {
    proposed_text: 'Jeffrey Epstein',
    evidence_type: 'cross_reference' as const,
    evidence_description: 'Based on cross-referencing with public court documents that name this individual.',
  }

  it('accepts minimal valid input', () => {
    expect(proposalRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('applies default arrays', () => {
    const result = proposalRequestSchema.parse(valid)
    expect(result.evidence_sources).toEqual([])
    expect(result.supporting_chunk_ids).toEqual([])
  })

  it('rejects empty proposed_text', () => {
    expect(proposalRequestSchema.safeParse({ ...valid, proposed_text: '' }).success).toBe(false)
  })

  it('rejects proposed_text > 1000', () => {
    expect(proposalRequestSchema.safeParse({ ...valid, proposed_text: 'a'.repeat(1001) }).success).toBe(false)
  })

  it('rejects evidence_description < 10 chars', () => {
    expect(proposalRequestSchema.safeParse({ ...valid, evidence_description: 'short' }).success).toBe(false)
  })

  it('rejects evidence_description > 5000 chars', () => {
    expect(proposalRequestSchema.safeParse({ ...valid, evidence_description: 'a'.repeat(5001) }).success).toBe(false)
  })

  it('accepts all evidence types', () => {
    const types = ['public_statement', 'cross_reference', 'context_deduction', 'document_comparison', 'official_release', 'media_report', 'other']
    for (const t of types) {
      expect(proposalRequestSchema.safeParse({ ...valid, evidence_type: t }).success).toBe(true)
    }
  })

  it('rejects invalid evidence_type', () => {
    expect(proposalRequestSchema.safeParse({ ...valid, evidence_type: 'invalid' }).success).toBe(false)
  })

  it('rejects > 10 evidence_sources', () => {
    expect(proposalRequestSchema.safeParse({
      ...valid,
      evidence_sources: Array(11).fill('http://example.com'),
    }).success).toBe(false)
  })

  it('rejects > 20 supporting_chunk_ids', () => {
    expect(proposalRequestSchema.safeParse({
      ...valid,
      supporting_chunk_ids: Array(21).fill(UUID),
    }).success).toBe(false)
  })

  it('accepts optional proposed_entity_id as UUID', () => {
    expect(proposalRequestSchema.safeParse({ ...valid, proposed_entity_id: UUID }).success).toBe(true)
  })
})

describe('voteRequestSchema', () => {
  it('accepts valid vote', () => {
    expect(voteRequestSchema.safeParse({ proposal_id: UUID, vote_type: 'upvote' }).success).toBe(true)
  })

  it('accepts all vote types', () => {
    for (const vt of ['upvote', 'downvote', 'corroborate'] as const) {
      expect(voteRequestSchema.safeParse({ proposal_id: UUID, vote_type: vt }).success).toBe(true)
    }
  })

  it('rejects non-UUID proposal_id', () => {
    expect(voteRequestSchema.safeParse({ proposal_id: 'bad', vote_type: 'upvote' }).success).toBe(false)
  })

  it('rejects invalid vote_type', () => {
    expect(voteRequestSchema.safeParse({ proposal_id: UUID, vote_type: 'invalid' }).success).toBe(false)
  })
})

describe('timelineQuerySchema', () => {
  it('accepts empty object with defaults', () => {
    const result = timelineQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.per_page).toBe(50)
  })

  it('accepts entity_id filter', () => {
    expect(timelineQuerySchema.safeParse({ entity_id: UUID }).success).toBe(true)
  })

  it('rejects non-UUID entity_id', () => {
    expect(timelineQuerySchema.safeParse({ entity_id: 'bad' }).success).toBe(false)
  })
})

describe('annotationRequestSchema', () => {
  it('accepts minimal valid input', () => {
    expect(annotationRequestSchema.safeParse({
      document_id: UUID,
      content: 'test annotation',
    }).success).toBe(true)
  })

  it('applies default annotation_type', () => {
    const result = annotationRequestSchema.parse({ document_id: UUID, content: 'note' })
    expect(result.annotation_type).toBe('observation')
  })

  it('accepts all annotation types', () => {
    for (const t of ['question', 'observation', 'correction', 'connection'] as const) {
      expect(annotationRequestSchema.safeParse({
        document_id: UUID,
        content: 'note',
        annotation_type: t,
      }).success).toBe(true)
    }
  })

  it('rejects empty content', () => {
    expect(annotationRequestSchema.safeParse({ document_id: UUID, content: '' }).success).toBe(false)
  })

  it('rejects content > 5000 chars', () => {
    expect(annotationRequestSchema.safeParse({
      document_id: UUID,
      content: 'a'.repeat(5001),
    }).success).toBe(false)
  })
})

describe('threadCreateSchema', () => {
  it('accepts minimal valid input', () => {
    expect(threadCreateSchema.safeParse({ title: 'My Thread' }).success).toBe(true)
  })

  it('applies defaults', () => {
    const result = threadCreateSchema.parse({ title: 'test' })
    expect(result.is_public).toBe(true)
    expect(result.tags).toEqual([])
  })

  it('rejects empty title', () => {
    expect(threadCreateSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('rejects title > 200 chars', () => {
    expect(threadCreateSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false)
  })

  it('rejects > 10 tags', () => {
    expect(threadCreateSchema.safeParse({
      title: 'test',
      tags: Array(11).fill('tag'),
    }).success).toBe(false)
  })
})

describe('threadItemSchema', () => {
  it('accepts valid item', () => {
    expect(threadItemSchema.safeParse({ item_type: 'document', target_id: UUID }).success).toBe(true)
  })

  it('accepts note type without target_id', () => {
    expect(threadItemSchema.safeParse({ item_type: 'note', note: 'My note' }).success).toBe(true)
  })

  it('accepts all item types', () => {
    for (const t of ['document', 'entity', 'timeline_event', 'annotation', 'note', 'image'] as const) {
      expect(threadItemSchema.safeParse({ item_type: t }).success).toBe(true)
    }
  })
})

describe('ocrCorrectionSchema', () => {
  it('accepts valid correction', () => {
    expect(ocrCorrectionSchema.safeParse({
      document_id: UUID,
      original_text: 'misspeled',
      corrected_text: 'misspelled',
    }).success).toBe(true)
  })

  it('rejects empty original_text', () => {
    expect(ocrCorrectionSchema.safeParse({
      document_id: UUID,
      original_text: '',
      corrected_text: 'fix',
    }).success).toBe(false)
  })

  it('rejects text > 10000 chars', () => {
    expect(ocrCorrectionSchema.safeParse({
      document_id: UUID,
      original_text: 'a'.repeat(10001),
      corrected_text: 'fix',
    }).success).toBe(false)
  })
})

describe('bountyCreateSchema', () => {
  const valid = {
    title: 'Find connections',
    description: 'Look for connections between the following entities.',
    target_type: 'entity' as const,
  }

  it('accepts minimal valid input', () => {
    expect(bountyCreateSchema.safeParse(valid).success).toBe(true)
  })

  it('applies defaults', () => {
    const result = bountyCreateSchema.parse(valid)
    expect(result.entity_ids).toEqual([])
    expect(result.xp_reward).toBe(0)
  })

  it('rejects description < 10 chars', () => {
    expect(bountyCreateSchema.safeParse({ ...valid, description: 'short' }).success).toBe(false)
  })

  it('rejects xp_reward > 1000', () => {
    expect(bountyCreateSchema.safeParse({ ...valid, xp_reward: 1001 }).success).toBe(false)
  })

  it('accepts all target types', () => {
    for (const t of ['entity', 'redaction', 'question', 'pattern'] as const) {
      expect(bountyCreateSchema.safeParse({ ...valid, target_type: t }).success).toBe(true)
    }
  })

  it('rejects > 10 entity_ids', () => {
    expect(bountyCreateSchema.safeParse({
      ...valid,
      entity_ids: Array(11).fill(UUID),
    }).success).toBe(false)
  })

  it('rejects invalid target_type', () => {
    expect(bountyCreateSchema.safeParse({ ...valid, target_type: 'nope' }).success).toBe(false)
  })

  it('accepts optional expires_at', () => {
    expect(bountyCreateSchema.safeParse({
      ...valid,
      expires_at: '2030-01-01T00:00:00Z',
    }).success).toBe(true)
  })
})

describe('factCreateSchema', () => {
  const valid = { fact_text: 'Epstein visited the island on multiple occasions.' }

  it('accepts minimal valid input', () => {
    expect(factCreateSchema.safeParse(valid).success).toBe(true)
  })

  it('applies default arrays', () => {
    const result = factCreateSchema.parse(valid)
    expect(result.entity_ids).toEqual([])
    expect(result.supporting_chunk_ids).toEqual([])
    expect(result.supporting_document_ids).toEqual([])
  })

  it('rejects fact_text < 10 chars', () => {
    expect(factCreateSchema.safeParse({ fact_text: 'short' }).success).toBe(false)
  })

  it('rejects fact_text > 2000 chars', () => {
    expect(factCreateSchema.safeParse({ fact_text: 'a'.repeat(2001) }).success).toBe(false)
  })

  it('rejects > 20 entity_ids', () => {
    expect(factCreateSchema.safeParse({
      ...valid,
      entity_ids: Array(21).fill(UUID),
    }).success).toBe(false)
  })

  it('rejects non-UUID in entity_ids', () => {
    expect(factCreateSchema.safeParse({
      ...valid,
      entity_ids: ['bad-id'],
    }).success).toBe(false)
  })

  it('accepts valid supporting_document_ids', () => {
    expect(factCreateSchema.safeParse({
      ...valid,
      supporting_document_ids: [UUID],
    }).success).toBe(true)
  })
})

describe('entityConnectionsSchema', () => {
  it('applies defaults', () => {
    const result = entityConnectionsSchema.parse({})
    expect(result.depth).toBe(2)
    expect(result.limit).toBe(50)
  })

  it('rejects depth > 4', () => {
    expect(entityConnectionsSchema.safeParse({ depth: 5 }).success).toBe(false)
  })

  it('rejects depth < 1', () => {
    expect(entityConnectionsSchema.safeParse({ depth: 0 }).success).toBe(false)
  })

  it('rejects limit > 200', () => {
    expect(entityConnectionsSchema.safeParse({ limit: 201 }).success).toBe(false)
  })

  it('accepts boundary values', () => {
    expect(entityConnectionsSchema.safeParse({ depth: 1, limit: 1 }).success).toBe(true)
    expect(entityConnectionsSchema.safeParse({ depth: 4, limit: 200 }).success).toBe(true)
  })
})

describe('paginationSchema', () => {
  it('applies defaults', () => {
    const result = paginationSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.per_page).toBe(20)
  })

  it('rejects page 0', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('rejects per_page > 100', () => {
    expect(paginationSchema.safeParse({ per_page: 101 }).success).toBe(false)
  })

  it('accepts boundary values', () => {
    expect(paginationSchema.safeParse({ page: 1, per_page: 100 }).success).toBe(true)
  })
})
