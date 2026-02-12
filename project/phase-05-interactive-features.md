# Phase 5: Interactive Features

> **Sessions:** 2-3 | **Dependencies:** Phase 3 (UI pages), Phase 4 (API routes) | **Parallel with:** Phase 7 (Funding)

## Summary

Build the chat panel (available on every page), redaction dashboard, contribution hub with all 4 contribution types, collaborative annotation system, investigation threads, OCR correction interface, photo identification, entity disambiguation, document comparison view, research bounties, daily challenges, notification center, guided investigation tutorials, and user profile. These are the interactive features that drive engagement and crowdsourced contribution toward the goal of identifying perpetrators and preparing prosecutor-ready evidence.

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
- [ ] `components/contribute/PhotoIdentifier.tsx` — "Who's in this photo?" tagging interface
  - Show photo with face/person bounding boxes
  - Users tag each person with entity name (search existing or create new)
  - Community verification via voting

### Contribution API Routes

- [ ] `app/api/contribute/unredact/route.ts` — Direct unredaction submission (auth required)
- [ ] `app/api/contribute/image-match/route.ts` — Image upload + visual similarity match (auth required)
- [ ] `app/api/contribute/intelligence/route.ts` — Submit intelligence hint (auth required)
- [ ] `app/api/contribute/photo-id/route.ts` — Photo identification submission (auth required)

### Collaborative Annotations

- [ ] `components/annotations/AnnotationLayer.tsx` — Document annotation overlay
  - Floating margin notes alongside document text
  - Highlight text → "Add annotation" popover
  - Annotation types: question, observation, correction, connection
  - Upvote/downvote annotations
  - Reply threads on annotations

- [ ] `components/annotations/AnnotationCard.tsx` — Individual annotation card
  - User avatar, timestamp, annotation type badge
  - Content with markdown rendering
  - Vote buttons, reply button
  - "Flag" button for inappropriate content

- [ ] `components/annotations/AnnotationSidebar.tsx` — All annotations for a document
  - Filterable by type (question, observation, correction, connection)
  - Sortable by newest, most upvoted
  - Jump-to annotation on click

### Investigation Threads

- [ ] `app/(auth)/investigations/page.tsx` — Investigation threads directory
  - List of public investigation threads
  - Filter: active, completed, my threads, following
  - Sort: newest, most followed, most items
  - "Start New Investigation" button
  - Featured investigations section

- [ ] `app/(auth)/investigations/[id]/page.tsx` — Investigation thread detail
  - Thread header: title, creator, description, follower count, fork button
  - Items feed: documents, entities, timeline events, annotations, researcher notes
  - Add item interface (search for documents/entities to pin, or write notes)
  - Discussion section (threaded comments)
  - "Export as Report" button (PDF/Markdown)
  - Conclusion summary (editable by creator)
  - Follow/unfollow button

- [ ] `components/investigations/InvestigationCard.tsx` — Thread preview card
- [ ] `components/investigations/InvestigationTimeline.tsx` — Thread items as visual timeline
- [ ] `components/investigations/AddItemDialog.tsx` — Search and add items to thread

### OCR Correction Interface

- [ ] `app/(auth)/contribute/ocr-correction/page.tsx` — OCR correction tool
  - Side-by-side: original scanned page image | OCR text output
  - Inline editing of OCR text with diff tracking
  - "Smart queue" — prioritizes low-confidence OCR pages
  - Submit correction → community review
  - Supports handwritten note transcription (OCR often fails on these)

- [ ] `components/contribute/OCRCorrectionView.tsx` — Side-by-side correction interface
- [ ] `components/contribute/OCRDiffView.tsx` — Shows original vs. corrected text diff

### Entity Disambiguation

- [ ] `components/entity/EntityDisambiguation.tsx` — Merge/split voting interface
  - When system detects potential duplicates (e.g., "J. Smith" vs "John Smith")
  - Shows both entity profiles side-by-side
  - "Same person" / "Different people" vote buttons
  - Evidence snippets from both entities
  - Used in entity profile page as alert banner

### Document Comparison View

- [ ] `app/(public)/compare/page.tsx` — Side-by-side document comparison
  - Two document viewers side-by-side
  - Text diff highlighting (additions in green, removals in red)
  - Useful for comparing different DOJ releases of same document (different redactions)
  - URL params: `?left=doc_id&right=doc_id`

- [ ] `components/document/DocumentDiff.tsx` — Diff visualization component

### Research Bounties

- [ ] `app/(public)/bounties/page.tsx` — Research bounties board
  - Open bounties sorted by XP reward and urgency
  - Filter by: entity, topic, difficulty, bounty amount
  - Each bounty: title, description, target entities, XP reward, expiry
  - "Claim this bounty" button (auth required)
  - Bounty creator can mark as completed

- [ ] `components/bounties/BountyCard.tsx` — Bounty preview card
- [ ] `components/bounties/BountyDetail.tsx` — Full bounty with evidence requirements
- [ ] `components/bounties/CreateBountyForm.tsx` — Create new bounty (level 3+)

### Daily Challenge

- [ ] `components/engagement/DailyChallenge.tsx` — Featured redaction of the day
  - Rotated daily, selected by highest cascade potential + good context clues
  - Prominent placement on home page and redaction dashboard
  - Countdown timer to next challenge
  - Community solve counter ("47 people attempted today")
  - XP bonus for daily challenge solves

- [ ] `components/engagement/ThisDayInFiles.tsx` — "This Day in the Files"
  - Documents dated on today's month+day from any year
  - "On this day in 2003, these documents were created..."
  - Shown on home page and discoveries feed

### Guided Investigations / Tutorial Missions

- [ ] `app/(auth)/guided/page.tsx` — Guided investigation missions
  - Pre-built investigation paths for onboarding
  - Step-by-step: search → find entity → check connections → attempt redaction
  - Difficulty levels: Beginner, Intermediate, Advanced
  - XP rewards for completion
  - Teaches platform features through real research tasks

- [ ] `components/engagement/GuidedMission.tsx` — Step-by-step mission UI
- [ ] `components/engagement/MissionProgress.tsx` — Progress tracker for current mission

### Notification Center

- [ ] `components/notifications/NotificationCenter.tsx` — Bell icon + dropdown
  - Unread count badge on bell icon
  - Notification types: proposal updates, annotation replies, search alerts, achievements, bounties
  - Mark as read / mark all as read
  - Click notification → navigate to relevant page
  - Settings: configure which notifications to receive

- [ ] `components/notifications/NotificationItem.tsx` — Individual notification
- [ ] `components/notifications/NotificationSettings.tsx` — Preferences panel

### Saved Search Alerts

- [ ] Update saved searches to support alerts
  - Toggle: "Alert me when new results match this search"
  - Frequency: immediate, daily digest, weekly digest
  - Alert appears in notification center

### Proposals & Voting

- [ ] `app/(auth)/proposals/page.tsx` — Review/vote on proposals
  - List of pending proposals with filters
  - Inline voting interface
  - Sort by: newest, highest confidence, most votes
  - "Needs independent verification" flag for high-stakes proposals
  - Auth required

### User Profile

- [ ] `app/(auth)/profile/page.tsx` — User profile page
  - Display name, avatar, bio (editable)
  - Stats dashboard: proposals submitted/confirmed, cascades triggered, accuracy rate
  - Reputation tier badge
  - Contribution history (chronological feed)
  - Investigation threads (created, following)
  - Annotations (most upvoted)
  - Saved searches list with alert toggles
  - Bookmarked documents/entities
  - XP/level display (placeholder for Phase 10)
  - "Export My Contributions" button

### Saved Searches & Bookmarks

- [ ] `app/(auth)/saved/page.tsx` — Saved searches and bookmarks
  - Three tabs: Saved Searches, Bookmarks, Investigation Threads
  - Saved searches: list with query, filters, date saved, "Run again" button, alert toggle
  - Bookmarks: list with document/entity/chunk cards, notes, date saved
  - Investigation threads: threads I created or follow
  - Delete/remove actions

### Hooks

- [ ] `lib/hooks/useRedaction.ts` — Redaction state management
  - Fetch redactions (solvable feed, by document)
  - Submit proposal
  - Vote on proposal
- [ ] `lib/hooks/useAnnotations.ts` — Annotation state management
  - Fetch annotations for document
  - Create, vote, reply
- [ ] `lib/hooks/useInvestigation.ts` — Investigation thread state
  - CRUD for threads and items
  - Follow/unfollow
- [ ] `lib/hooks/useNotifications.ts` — Notification state
  - Fetch notifications, unread count
  - Mark as read
- [ ] `lib/hooks/useBounties.ts` — Bounty state
  - Fetch open bounties, claim, complete

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
├── ContributionImpactView.tsx
├── PhotoIdentifier.tsx
├── OCRCorrectionView.tsx
└── OCRDiffView.tsx
components/annotations/
├── AnnotationLayer.tsx
├── AnnotationCard.tsx
└── AnnotationSidebar.tsx
components/investigations/
├── InvestigationCard.tsx
├── InvestigationTimeline.tsx
└── AddItemDialog.tsx
components/bounties/
├── BountyCard.tsx
├── BountyDetail.tsx
└── CreateBountyForm.tsx
components/engagement/
├── DailyChallenge.tsx
├── ThisDayInFiles.tsx
├── GuidedMission.tsx
└── MissionProgress.tsx
components/notifications/
├── NotificationCenter.tsx
├── NotificationItem.tsx
└── NotificationSettings.tsx
components/entity/
└── EntityDisambiguation.tsx
components/document/
├── DocumentDiff.tsx
app/(public)/
├── redactions/
│   └── page.tsx
├── bounties/
│   └── page.tsx
├── compare/
│   └── page.tsx
app/(auth)/
├── contribute/
│   ├── page.tsx
│   ├── unredact/
│   │   └── page.tsx
│   ├── image-match/
│   │   └── page.tsx
│   ├── intelligence/
│   │   └── page.tsx
│   └── ocr-correction/
│       └── page.tsx
├── investigations/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── guided/
│   └── page.tsx
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
├── intelligence/
│   └── route.ts
└── photo-id/
    └── route.ts
lib/hooks/
├── useChat.ts
├── useRedaction.ts
├── useAnnotations.ts
├── useInvestigation.ts
├── useNotifications.ts
└── useBounties.ts
```

## Acceptance Criteria

1. Chat FAB appears on every page (bottom-right corner)
2. ChatPanel slides open (400px from right) with message UI
3. Chat input accepts text and sends (SSE streaming from API)
4. Source citations appear below AI messages as clickable chips
5. Redaction dashboard shows progress bar, solvable feed, and daily challenge
6. Contribution hub displays contribution type cards
7. All contribution forms validate required fields before submission
8. Auth redirect works (unauthenticated users → login → return to page)
9. Proposals page lists pending proposals with voting UI
10. User profile shows stats, contributions, investigation threads, annotations
11. Saved searches support alert toggles
12. All contribution API routes require authentication (401 without)
13. Image matcher shows drag-and-drop upload area
14. Intelligence hint form shows conditional fields based on hint type
15. Annotation layer renders margin notes on document viewer
16. Annotations can be created, voted, and replied to
17. Investigation threads can be created, followed, and items added
18. OCR correction view shows side-by-side original scan vs. OCR text
19. Entity disambiguation shows merge candidates with voting
20. Document comparison view shows side-by-side diff
21. Research bounties are browsable and claimable
22. Daily challenge appears on home page and redaction dashboard
23. Notification bell shows unread count and dropdown
24. Guided investigation mission walks through steps with progress tracking
25. Photo identification interface allows tagging people in images

## Notes

- Chat panel state (open/closed, messages) should persist across page navigations within a session
- The ChatFAB + ChatPanel are rendered in the root layout, not per-page
- Auth route group `(auth)` should have a layout that checks auth and redirects to login
- Contribution forms should use progressive disclosure (show more fields as user fills in earlier ones)
- Image upload uses FormData for file upload to the API route
- Annotations use optimistic updates (show immediately, sync in background)
- Investigation threads are the primary collaborative research tool — prioritize UX
- Daily challenge selection algorithm: highest potential_cascade_count + good surrounding context + not attempted by too many users
- Notification center uses Supabase Realtime for push notifications
- OCR correction queue prioritizes pages with low OCR confidence scores
