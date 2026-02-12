# Phase 5: Interactive Features

> **Sessions:** 2 | **Dependencies:** Phase 3 (UI pages), Phase 4 (API routes) | **Parallel with:** Phase 7 (Funding)

## Summary

Build the chat panel (available on every page), redaction dashboard, contribution hub with all 4 contribution types, proposals/voting page, user profile, and saved searches/bookmarks. These are the interactive features that drive engagement and crowdsourced contribution.

## Checklist

### Chat Panel (Global)

- [ ] `components/chat/ChatFAB.tsx` — Floating action button
  - Fixed position bottom-right on all pages
  - "Ask a question" tooltip
  - Pulse animation when idle (subtle)
  - Click toggles ChatPanel open/closed
  - Badge showing unread messages (if applicable)

- [ ] `components/chat/ChatPanel.tsx` — Slide-out chat drawer
  - 400px width, slides from right edge
  - Uses shadcn `Sheet` component
  - Header: "Ask the Archive" + model tier indicator + close button
  - Message list (scrollable, auto-scroll to bottom)
  - Rate limit display for free tier ("X/20 questions remaining today")
  - "Upgrade to Premium" subtle link for paid tier

- [ ] `components/chat/ChatMessage.tsx` — Message bubble
  - User messages: right-aligned, accent background
  - AI messages: left-aligned, surface background
  - Markdown rendering in AI messages
  - Typing indicator (animated dots) during streaming
  - Timestamp display

- [ ] `components/chat/ChatInput.tsx` — Input with send button
  - Textarea (auto-resize, max 4 lines)
  - Send button (disabled when empty or rate limited)
  - Keyboard: Enter to send, Shift+Enter for newline
  - Character count indicator

- [ ] `components/chat/SourceCitation.tsx` — Clickable source reference
  - Compact chip/pill design: "[Doc Name, p.12]"
  - Click navigates to document viewer at that page
  - Hover shows preview snippet
  - Multiple citations stack horizontally below AI message

### Chat Integration

- [ ] `lib/hooks/useChat.ts` — Chat state management hook
  - Messages array, input state
  - Send message → stream response → update messages
  - Rate limit tracking
  - Conversation persistence (session ID)

- [ ] Add ChatFAB + ChatPanel to root `app/layout.tsx`
  - Renders on every page
  - State persists across navigation

### Redaction Dashboard

- [ ] `app/(public)/redactions/page.tsx` — Redaction puzzle dashboard
  - Global progress bar (solved / total redactions)
  - Stats cards: Total, Solved, Proposed, Unsolved
  - Tab sections: "Most Impactful Unsolved" feed, "Recently Solved", "My Proposals" (if logged in)
  - "I know something" CTA button → /contribute
  - XP reward preview ("Solving this would earn ~150 XP")

- [ ] `components/redaction/RedactionDashboard.tsx` — Global progress + stats
- [ ] `components/redaction/RedactionCard.tsx` — Individual redaction card
  - Redaction ID, dataset, document type, date
  - Surrounding text with redaction placeholder (████)
  - Type/length estimate, nearby entities
  - "I Know What This Says" button
  - Proposal count, cascade potential
  - XP reward preview

- [ ] `components/redaction/SolvableFeed.tsx` — "Highest impact unsolved" feed
  - Sorted by potential_cascade_count DESC
  - Infinite scroll or pagination
  - Filter by dataset, redaction type

- [ ] `components/redaction/ProposalForm.tsx` — Submit proposal with evidence
  - Proposed text input with character count vs. estimate
  - Length mismatch warning
  - Evidence type dropdown (6 options from scaffold)
  - Evidence description textarea
  - Source URLs (multi-line input)
  - Supporting documents search (search within archive)
  - Submit button with XP preview

- [ ] `components/redaction/ProposalVoting.tsx` — Vote/corroborate on proposals
  - Proposal text display
  - Evidence summary
  - Upvote / Downvote / Corroborate buttons
  - Vote counts display
  - Confidence score meter
  - Auth gate (must be logged in)

- [ ] `components/redaction/CascadeTree.tsx` — Cascade chain visualization placeholder
  - Tree diagram showing cascade relationships
  - Placeholder for Phase 8 animation
  - Static tree display for now

- [ ] `components/redaction/UserReputation.tsx` — Reputation badge/score
  - Compact display: tier badge, accuracy rate, proposal count

### Contribution Hub

- [ ] `app/(auth)/contribute/page.tsx` — Contribution hub
  - 4 large cards in 2×2 grid:
    1. "I Know What This Says" (magnifying glass icon) → /contribute/unredact
    2. "I Have the Unredacted Image" (image icon) → /contribute/image-match
    3. "I Have a Lead" (lightbulb icon) → /contribute/intelligence
    4. "I Found a Connection" (chain link icon) → flows into unredact with cross-reference
  - Each card: title, 2-3 sentence description, "Start →" button, contribution counter
  - "How contributions work" expandable section
  - "Your contribution impact" section (logged-in users)
  - Recent contribution feed

- [ ] `components/contribute/ContributeHub.tsx` — Hub layout component
- [ ] `components/contribute/ContributionTypeCards.tsx` — The 4 type cards

### Contribution Sub-Pages

- [ ] `app/(auth)/contribute/unredact/page.tsx` — Direct unredaction form
  - Receives redaction_id from query params or lets user search
  - Shows redaction context
  - Full ProposalForm
  - Auth redirect if not logged in

- [ ] `app/(auth)/contribute/image-match/page.tsx` — Image matching
  - Drag-and-drop image upload area
  - Source description textarea + URL
  - After upload: show match results (side-by-side comparisons)
  - Confirm/reject matches
  - Submit confirmed matches

- [ ] `app/(auth)/contribute/intelligence/page.tsx` — Intelligence hints
  - Hint type radio buttons (person, org, location, relationship, general)
  - Conditional fields based on type:
    - Person: name, aliases, role/connection
    - Org/Location: name, description
    - Relationship: two entity names, relationship type
    - General: free text
  - Known associations (tag input — search existing entities)
  - Time period (date range picker)
  - Source type radio + URL + verbatim quote
  - Submit with processing explanation

### Contribution Components

- [ ] `components/contribute/DirectUnredactForm.tsx` — Full unredaction form wrapper
- [ ] `components/contribute/ImageMatcher.tsx` — Upload + similarity results
- [ ] `components/contribute/ImageComparisonView.tsx` — Side-by-side image comparison
- [ ] `components/contribute/IntelligenceHintForm.tsx` — Structured hint form
- [ ] `components/contribute/EvidenceAttacher.tsx` — URL, screenshot, doc ref attacher
- [ ] `components/contribute/ContributionImpactView.tsx` — "Your contribution unlocked X connections"

### Contribution API Routes

- [ ] `app/api/contribute/unredact/route.ts` — Direct unredaction submission (auth required)
- [ ] `app/api/contribute/image-match/route.ts` — Image upload + visual similarity match (auth required)
- [ ] `app/api/contribute/intelligence/route.ts` — Submit intelligence hint (auth required)

### Proposals & Voting

- [ ] `app/(auth)/proposals/page.tsx` — Review/vote on proposals
  - List of pending proposals with filters
  - Inline voting interface
  - Sort by: newest, highest confidence, most votes
  - Auth required

### User Profile

- [ ] `app/(auth)/profile/page.tsx` — User profile page
  - Display name, avatar, bio (editable)
  - Stats dashboard: proposals submitted/confirmed, cascades triggered, accuracy rate
  - Reputation tier badge
  - Contribution history (chronological feed)
  - Saved searches list
  - Bookmarked documents/entities
  - XP/level display (placeholder for Phase 10)

### Saved Searches & Bookmarks

- [ ] `app/(auth)/saved/page.tsx` — Saved searches and bookmarks
  - Two tabs: Saved Searches, Bookmarks
  - Saved searches: list with query, filters, date saved, "Run again" button
  - Bookmarks: list with document/entity/chunk cards, notes, date saved
  - Delete/remove actions

### Hooks

- [ ] `lib/hooks/useRedaction.ts` — Redaction state management
  - Fetch redactions (solvable feed, by document)
  - Submit proposal
  - Vote on proposal

## Files to Create

```
components/chat/
├── ChatFAB.tsx
├── ChatPanel.tsx
├── ChatMessage.tsx
├── ChatInput.tsx
└── SourceCitation.tsx
components/redaction/
├── RedactionDashboard.tsx
├── RedactionCard.tsx
├── SolvableFeed.tsx
├── ProposalForm.tsx
├── ProposalVoting.tsx
├── CascadeTree.tsx
└── UserReputation.tsx
components/contribute/
├── ContributeHub.tsx
├── ContributionTypeCards.tsx
├── DirectUnredactForm.tsx
├── ImageMatcher.tsx
├── ImageComparisonView.tsx
├── IntelligenceHintForm.tsx
├── EvidenceAttacher.tsx
└── ContributionImpactView.tsx
app/(public)/redactions/
└── page.tsx
app/(auth)/
├── contribute/
│   ├── page.tsx
│   ├── unredact/
│   │   └── page.tsx
│   ├── image-match/
│   │   └── page.tsx
│   └── intelligence/
│       └── page.tsx
├── proposals/
│   └── page.tsx
├── profile/
│   └── page.tsx
└── saved/
    └── page.tsx
app/api/contribute/
├── unredact/
│   └── route.ts
├── image-match/
│   └── route.ts
└── intelligence/
    └── route.ts
lib/hooks/
├── useChat.ts
└── useRedaction.ts
```

## Acceptance Criteria

1. Chat FAB appears on every page (bottom-right corner)
2. ChatPanel slides open (400px from right) with message UI
3. Chat input accepts text and sends (SSE streaming from API)
4. Source citations appear below AI messages as clickable chips
5. Redaction dashboard shows progress bar and solvable feed
6. Contribution hub displays 4 type cards in 2×2 grid
7. All contribution forms validate required fields before submission
8. Auth redirect works (unauthenticated users → login → return to page)
9. Proposals page lists pending proposals with voting UI
10. User profile shows stats and contribution history
11. Saved searches and bookmarks are listable and deletable
12. All contribution API routes require authentication (401 without)
13. Image matcher shows drag-and-drop upload area
14. Intelligence hint form shows conditional fields based on hint type

## Notes

- Chat panel state (open/closed, messages) should persist across page navigations within a session
- The ChatFAB + ChatPanel are rendered in the root layout, not per-page
- Auth route group `(auth)` should have a layout that checks auth and redirects to login
- Contribution forms should use progressive disclosure (show more fields as user fills in earlier ones)
- Image upload uses FormData for file upload to the API route
