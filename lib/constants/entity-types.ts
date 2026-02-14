// lib/constants/entity-types.ts
// Single source of truth for entity type metadata used across UI components.
// The canonical EntityType union lives in types/entities.ts — this file
// provides display labels, colors, and ordered lists for UI rendering.

import type { EntityType } from '@/types/entities'

export const ENTITY_TYPE_META: Record<EntityType, { label: string; color: string; cssClass: string }> = {
  person:             { label: 'People',          color: '#60a5fa', cssClass: 'text-blue-400 border-blue-400/30' },
  organization:       { label: 'Organizations',   color: '#c084fc', cssClass: 'text-purple-400 border-purple-400/30' },
  location:           { label: 'Locations',       color: '#4ade80', cssClass: 'text-green-400 border-green-400/30' },
  aircraft:           { label: 'Aircraft',        color: '#fbbf24', cssClass: 'text-amber-400 border-amber-400/30' },
  vessel:             { label: 'Vessels',         color: '#22d3ee', cssClass: 'text-cyan-400 border-cyan-400/30' },
  property:           { label: 'Properties',      color: '#fb923c', cssClass: 'text-orange-400 border-orange-400/30' },
  account:            { label: 'Accounts',        color: '#f472b6', cssClass: 'text-pink-400 border-pink-400/30' },
  event:              { label: 'Events',          color: '#fb7185', cssClass: 'text-rose-400 border-rose-400/30' },
  legal_case:         { label: 'Legal Cases',     color: '#818cf8', cssClass: 'text-indigo-400 border-indigo-400/30' },
  government_body:    { label: 'Gov Bodies',      color: '#94a3b8', cssClass: 'text-slate-400 border-slate-400/30' },
  trust:              { label: 'Trusts',          color: '#f87171', cssClass: 'text-red-400 border-red-400/30' },
  phone_number:       { label: 'Phone Numbers',   color: '#2dd4bf', cssClass: 'text-teal-400 border-teal-400/30' },
  vehicle:            { label: 'Vehicles',        color: '#facc15', cssClass: 'text-yellow-400 border-yellow-400/30' },
  document_reference: { label: 'Doc References',  color: '#a1a1aa', cssClass: 'text-zinc-400 border-zinc-400/30' },
}

/** Ordered list of all entity types for UI rendering. */
export const ALL_ENTITY_TYPES = Object.keys(ENTITY_TYPE_META) as EntityType[]
