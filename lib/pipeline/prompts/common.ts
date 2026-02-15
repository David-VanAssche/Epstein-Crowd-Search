// lib/pipeline/prompts/common.ts
// Shared prompt fragments used by all 5 prompt builders.

import type { PromptTier } from './types'
import type { RelationshipType } from '@/types/entities'

// --- Tier preambles: one-sentence context for each tier ---

export const TIER_PREAMBLES: Record<PromptTier, string> = {
  sworn:
    'This is sworn testimony from a DOJ FOIA release — a deposition, grand jury transcript, or witness statement given under oath.',
  official:
    'This is an official legal/law enforcement document from a DOJ FOIA release — a court filing, indictment, warrant, or government report.',
  flight:
    'This is a flight log or manifest from a DOJ FOIA release — a tabular record of aircraft movements and passengers.',
  financial:
    'This is a financial record from a DOJ FOIA release — a bank statement, tax filing, trust document, or corporate filing.',
  correspondence:
    'This is correspondence from a DOJ FOIA release — an email, letter, memo, or fax between parties.',
  contacts:
    'This is a contacts record from a DOJ FOIA release — an address book, phone list, or calendar.',
  default:
    'This is a document from a DOJ FOIA release related to the Jeffrey Epstein investigation.',
}

// --- Tag supplements: short disambiguation hints for secondary tiers ---

export const TAG_SUPPLEMENTS: Record<PromptTier, string> = {
  sworn:
    'This document also contains sworn testimony elements. When encountering Q&A patterns or witness statements, treat those sections as high-reliability evidence.',
  official:
    'This document also contains official legal filings. When encountering case numbers, court orders, or government agency references, note the formal legal context.',
  flight:
    'This document also contains flight log data. When encountering passenger lists, tail numbers, or airport codes, extract travel details.',
  financial:
    'This document also contains financial records. When encountering dollar amounts, account numbers, or institution names, extract transaction details.',
  correspondence:
    'This document also contains correspondence. When encountering email headers, salutations, or sender/recipient patterns, note the communication context.',
  contacts:
    'This document also contains contact information. When encountering phone numbers, addresses, or directory entries, extract structured contact data.',
  default: '',
}

// --- Ethical guidelines (shared by criminal-indicators and document-summary) ---

export const ETHICAL_GUIDELINES =
  'IMPORTANT: Flag patterns for human review only. Do NOT make accusations. Be factual and cite specific text from the document.'

// --- Relationship types by tier ---
// All 22 canonical types are always available. Primary types are listed first with "focus especially on" guidance.

export const RELATIONSHIP_TYPES_BY_TIER: Record<
  PromptTier,
  { primary: RelationshipType[]; all: RelationshipType[] }
> = {
  sworn: {
    primary: [
      'victim_of',
      'recruited_by',
      'witness_testimony',
      'co_defendant',
      'associate_of',
      'introduced_by',
      'met_with',
    ],
    all: getAllRelationshipTypes(),
  },
  official: {
    primary: [
      'co_defendant',
      'legal_representative',
      'prosecuted_by',
      'investigated_by',
      'witness_testimony',
      'victim_of',
    ],
    all: getAllRelationshipTypes(),
  },
  flight: {
    primary: ['traveled_with', 'employed_by', 'associate_of', 'guest_of'],
    all: getAllRelationshipTypes(),
  },
  financial: {
    primary: [
      'financial_connection',
      'employed_by',
      'beneficiary_of',
      'controlled_by',
      'owns',
    ],
    all: getAllRelationshipTypes(),
  },
  correspondence: {
    primary: [
      'communicated_with',
      'met_with',
      'associate_of',
      'introduced_by',
    ],
    all: getAllRelationshipTypes(),
  },
  contacts: {
    primary: [
      'associate_of',
      'family_member',
      'employed_by',
      'located_at',
    ],
    all: getAllRelationshipTypes(),
  },
  default: {
    primary: [],
    all: getAllRelationshipTypes(),
  },
}

function getAllRelationshipTypes(): RelationshipType[] {
  return [
    'traveled_with',
    'employed_by',
    'associate_of',
    'family_member',
    'legal_representative',
    'financial_connection',
    'mentioned_together',
    'witness_testimony',
    'employer_of',
    'guest_of',
    'owns',
    'controlled_by',
    'beneficiary_of',
    'investigated_by',
    'prosecuted_by',
    'victim_of',
    'co_defendant',
    'introduced_by',
    'recruited_by',
    'located_at',
    'communicated_with',
    'met_with',
  ]
}

// --- Entity priority types by tier ---

export const ENTITY_PRIORITY_TYPES: Record<PromptTier, string[]> = {
  sworn: ['person', 'legal_case', 'event', 'location', 'organization'],
  official: [
    'person',
    'legal_case',
    'government_body',
    'organization',
    'event',
  ],
  flight: ['person', 'aircraft', 'location', 'event'],
  financial: [
    'person',
    'organization',
    'account',
    'trust',
    'property',
  ],
  correspondence: [
    'person',
    'organization',
    'location',
    'event',
  ],
  contacts: [
    'person',
    'organization',
    'phone_number',
    'location',
  ],
  default: [
    'person',
    'organization',
    'location',
    'event',
    'legal_case',
  ],
}
