# Pinboard Implementation Project

## Vision

The Pinboard is a spatial investigation workspace where researchers organize evidence from
the Epstein archive. Unlike a generic whiteboard (Miro/Figma), every pin is a **live window
into the archive database** — entities show real-time connection counts, documents show
redaction status, and the system proactively surfaces connections the user hasn't noticed yet.

**Core loop**: Browse archive → Pin interesting items → Arrange spatially → AI surfaces
gaps/connections → Refine investigation → Publish findings or solve redactions.

## User Personas

| Persona | Board purpose | Key needs |
|---------|--------------|-----------|
| Investigative journalist | Evidence for an article | Privacy, export, source citations |
| Academic researcher | Systematic network analysis | Bulk pinning, auto-layout, data export |
| Citizen investigator | Following rabbit holes | Low friction, "pin this" from anywhere |
| Redaction solver | Working hypothesis for a set of related redactions | Entity fitting, char-length matching |

## Privacy Model

| Mode | Default | Visibility | Use case |
|------|---------|-----------|----------|
| **Private** | Yes | Owner only | Active investigations |
| **Published** | Opt-in | Read-only snapshot, attributed | Sharing conclusions |
| **Anonymous** | Opt-in | Read-only snapshot, no attribution | Sensitive findings |

No real-time collaboration. Fork published boards into private copies instead.

## Phase Overview

| Phase | Scope | Doc |
|-------|-------|-----|
| 1 | Database + API + Basic CRUD | [phase-01-foundation.md](./phase-01-foundation.md) |
| 2 | Canvas rewrite + pin-from-anywhere | [phase-02-canvas-ux.md](./phase-02-canvas-ux.md) |
| 3 | Live data pins + detail panel | [phase-03-live-pins.md](./phase-03-live-pins.md) |
| 4 | AI suggestions + auto-layout | [phase-04-ai-layer.md](./phase-04-ai-layer.md) |
| 5 | Publish, fork, export | [phase-05-sharing.md](./phase-05-sharing.md) |
| 6 | Polish, performance, mobile | [phase-06-polish.md](./phase-06-polish.md) |

## Existing Code Inventory

| File | Status | Notes |
|------|--------|-------|
| `app/(auth)/pinboard/page.tsx` | Scaffold | Hardcoded empty state, no API calls |
| `components/pinboard/PinboardCanvas.tsx` | Scaffold | Basic drag/zoom, no persistence |
| `components/pinboard/PinItem.tsx` | Scaffold | Static cards, no live data |
| `components/pinboard/AddPinDialog.tsx` | Scaffold | Search tab not wired |
| `types/collaboration.ts` | Has types | `PinboardBoard/Pin/Connection` exist but use JSON blob |
| `supabase/migrations/00016_*` | No pinboard tables | Only investigation_threads etc. |
| `e2e/pages/pinboard.spec.ts` | Exists | Likely tests the empty state |

## Progress Tracking

Update this section after each implementation session:

| Date | Session | Completed | Notes |
|------|---------|-----------|-------|
| — | — | — | Not started |

## Key Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Normalized tables (not JSON blob) | Pins need independent RLS, querying, and cross-board dedup | Design |
| No real-time collab | CRDT complexity + privacy model makes it impractical | Design |
| Fork instead of share-edit | Simpler, preserves investigation independence | Design |
| Pin from anywhere via global hook | Primary UX flow is browse→pin, not open-board→add | Design |
| Sections are optional visual groupings | Power users organize, casual users don't need to | Design |
