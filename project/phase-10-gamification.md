# Phase 10: Gamification (v2)

> **Sessions:** 2 | **Dependencies:** Phase 9 (all polish complete) | **Parallel with:** Nothing (final phase)

## Summary

Implement the full gamification system: XP awarding, level calculation, streak tracking, leaderboards, achievements, cascade impact visualization, research bounty rewards, annotation XP, OCR correction XP, and investigation thread completion bonuses. Weave gamification elements into existing pages (redaction dashboard, search, document viewer, profile). This is the engagement driver that makes solving redactions and building prosecutor-ready evidence feel as compelling as solving puzzles.

## Checklist

### XP System

- [ ] `lib/gamification/xp.ts` — XP calculation and awarding
  - XP award function: action type + multipliers → XP amount
  - Level calculation from total XP (7 levels, thresholds from scaffold)
  - Level title mapping (Observer → Chief Investigator)
  - Create `xp_transactions` record on every award
  - Update `user_profiles.xp`, `.level`, `.level_title`

- [ ] XP award triggers (integrate into existing API routes):
  - Submit proposal: 10 XP × evidence quality (1-3x)
  - Proposal corroborated: 25 XP × corroboration count
  - Proposal confirmed: 100 XP
  - Cascade triggered: 50 XP × depth bonus per downstream solve
  - Submit image match: 15 XP
  - Image match confirmed: 75 XP × revealed entities count
  - Submit intelligence hint: 10 XP
  - Intelligence hint leads to solve: 150 XP × redactions matched
  - Vote/corroborate: 5 XP
  - Daily login streak: 5 XP × streak length (cap 30)
  - First contribution of day: 10 XP

### XP Award Table

| Action | Base XP | Multiplier |
|---|---|---|
| Submit redaction proposal | 10 | × evidence quality (1-3x) |
| Proposal corroborated | 25 | × corroboration count |
| Proposal confirmed correct | 100 | × 1 |
| Cascade triggered (per downstream) | 50 | × cascade depth bonus |
| Submit image match | 15 | × 1 |
| Image match confirmed | 75 | × revealed entities |
| Submit intelligence hint | 10 | × 1 |
| Hint leads to confirmed solve | 150 | × redactions matched |
| Vote/corroborate | 5 | × 1 |
| Daily login streak | 5 | × streak length (max 30) |
| First contribution of day | 10 | × 1 |
| OCR correction approved | 15 | × 1 |
| Document review completed | 10 | × checklist items completed |
| Annotation upvoted (per 5 upvotes) | 5 | × 1 |
| Research bounty completed | varies | × bounty XP value |
| Guided investigation completed | 25 | × difficulty level |
| Photo identification confirmed | 20 | × people identified |
| Investigation thread followed by 10+ users | 15 | × 1 |
| Daily challenge solved | 50 | × 1 (bonus on top of normal solve XP) |
| Fact verified by community | 20 | × 1 |

### Level System

| Level | Title | XP Required | Unlocks |
|---|---|---|---|
| 1 | Observer | 0 | Search, browse, vote |
| 2 | Contributor | 50 | Submit proposals |
| 3 | Investigator | 250 | Submit intel hints, priority review |
| 4 | Analyst | 1,000 | Image matching, bulk export |
| 5 | Senior Analyst | 5,000 | Weighted votes (2x), entity merges |
| 6 | Lead Investigator | 15,000 | Moderate proposals, flag spam |
| 7 | Chief Investigator | 50,000 | Admin dashboard, cascade tuning |

### Streak Tracking

- [ ] `lib/gamification/streaks.ts` — Streak management
  - Check if user has contributed today
  - Increment streak on first daily contribution
  - Reset streak if missed a day
  - Track `current_streak`, `longest_streak`, `last_contribution_date`
  - Award streak XP

### Achievement System

- [ ] `lib/gamification/achievements.ts` — Achievement checking and unlocking
  - Check all achievement conditions after each contribution
  - Unlock achievement → create `user_achievements` record
  - Award bonus XP for achievement unlock
  - Return newly unlocked achievements (for notification)

- [ ] `scripts/seed-achievements.ts` — Seed achievement definitions
  - Discovery badges:
    - "First Blood" — First confirmed proposal
    - "Chain Reaction" — Cascade of 10+ solves
    - "Domino Effect" — Cascade of 50+ solves
    - "Butterfly Effect" — Cascade of 100+ solves
    - "Across the Aisle" — Solved in 5+ datasets
    - "Pattern Recognition" — Same entity in 10+ documents
    - "Cold Case Cracker" — Solved 30+ day old redaction
    - "Deep Diver" — Contributions in all 12 datasets
  - Community badges:
    - "Corroborator" — Corroborated 25 proposals
    - "Eagle Eye" — 90%+ accuracy over 20+ proposals
    - "Early Bird" — Among first 100 contributors
    - "Validator" — Voted on 100+ proposals
    - "Mentor" — 5 proposals used as evidence by others
  - Effort badges:
    - "Streak: 7", "Streak: 30", "Streak: 100", "Streak: 365"
    - "Centurion" — 100 confirmed contributions
    - "Image Sleuth" — 10 confirmed image matches
    - "Intelligence Asset" — 10 hints leading to solves
  - Special badges:
    - "Cascade King/Queen" — Highest single cascade chain
    - "Most Wanted" — Solved #1 most impactful redaction
    - "Founding Investigator" — Contributed in first month
  - Prosecutor Support badges:
    - "Evidence Builder" — 10 documents fully reviewed (all completeness checks)
    - "Case Builder" — Created investigation thread followed by 50+ users
    - "OCR Hero" — 50 OCR corrections approved
    - "Photo Detective" — Identified people in 25 photos
    - "Bounty Hunter" — Completed 10 research bounties
    - "Fact Checker" — 20 verified facts submitted
    - "Daily Grinder" — Completed 30 daily challenges
    - "Annotator" — 100 annotations with positive vote balance

### Leaderboard

- [ ] `app/(public)/leaderboard/page.tsx` — Leaderboard page
  - Three tabs: All-Time, This Week, Cascade Impact
  - All-Time: ranked by total XP, top 100 + user's position
  - This Week: ranked by weekly XP (from materialized view), resets weekly
  - Cascade Impact: ranked by total cascades triggered
  - Each entry: rank, avatar, display name, level badge, XP, achievement count, cascades

- [ ] `components/gamification/Leaderboard.tsx` — Leaderboard table/list
  - Rank column with medal icons (gold/silver/bronze for top 3)
  - User info: avatar, name, level title badge
  - Stats columns: XP, achievements, cascades
  - Current user highlighted
  - "Your rank: #XX" sticky footer

### Achievement Page

- [ ] `app/(public)/achievements/page.tsx` — All achievements
  - Grid of achievement cards
  - Tabs: All, Earned, Locked
  - Category sections: Discovery, Community, Effort, Special
  - Earned: full color with earned date
  - Locked: grayed out with unlock condition
  - Progress indicators for quantitative achievements

### Gamification Components

- [ ] `components/gamification/UserScoreCard.tsx` — Compact user stats
  - Current level + title
  - XP bar (progress to next level)
  - Rank position
  - Streak indicator
  - Used in profile page, sidebar, leaderboard entries

- [ ] `components/gamification/XPProgressBar.tsx` — XP toward next level
  - Current XP / next level threshold
  - Animated fill bar
  - Level title on both sides (current → next)
  - "+X XP" animation on earn (Framer Motion pop)

- [ ] `components/gamification/ContributionStreak.tsx` — Daily streak tracker
  - Flame icon with streak count
  - 7-day calendar showing active days
  - Streak bonus reminder ("Day X: +Y XP bonus!")
  - Warning if about to break streak

- [ ] `components/gamification/AchievementBadge.tsx` — Individual badge display
  - Icon, name, description
  - Earned: full color with glow
  - Locked: grayscale with "?" overlay
  - Hover: shows unlock condition / earned date
  - Rarity indicator (common → legendary, colored ring)

- [ ] `components/gamification/AchievementGrid.tsx` — All achievements grid
  - Responsive grid (3-4 cols desktop, 2 mobile)
  - Category sections with headers
  - Filter: All / Earned / Locked

- [ ] `components/gamification/ImpactRipple.tsx` — Animated impact visualization
  - "Your solve → cascade" ripple animation
  - Shows outward spreading circles from center
  - Numbers counting up at each ripple ring
  - Framer Motion entrance animation

### Gamification Integration into Existing Pages

- [ ] Update `app/(public)/redactions/page.tsx` — Add XP previews
  - "Solving this would earn you ~150 XP and could cascade to 47 others"
  - Show XP amount on each redaction card
  - Daily challenge prominence with XP bonus indicator

- [ ] Update `components/search/ResultCard.tsx` — Attribution
  - When result was unredacted by user: "Uncovered by @username (Cascade: 23 solves)"
  - Small attribution badge

- [ ] Update `components/document/RedactionHighlight.tsx` — Solved attribution
  - Solved redactions: green glow with hover tooltip
  - "Solved by @username on Feb 10, 2026. Triggered 12 cascade matches."

- [ ] Update `components/document/DocumentCompleteness.tsx` — XP for reviews
  - "Complete this review checklist to earn 10 XP per item"
  - Show which review items are still available

- [ ] Update `app/(auth)/profile/page.tsx` — Full gamification stats
  - XP chart over time
  - Level and XP progress bar
  - Achievement grid (earned badges)
  - Cascade impact tree visualization
  - Contribution history with XP earned per action
  - Streak tracker
  - Investigation threads with follower counts
  - Bounties completed
  - OCR corrections made

- [ ] Update `components/chat/ChatMessage.tsx` — Citation attribution
  - When citing unredacted source: mention contributor
  - "This information was uncovered by community contributor @username"

- [ ] Update `app/(public)/bounties/page.tsx` — XP rewards
  - Show XP reward on each bounty card
  - Leaderboard of top bounty hunters

- [ ] Update `components/annotations/AnnotationCard.tsx` — XP on upvotes
  - "+5 XP" indicator when annotation reaches 5 upvote milestones

- [ ] Update `components/engagement/DailyChallenge.tsx` — XP bonus
  - "Daily Challenge Bonus: +50 XP on top of normal solve rewards"
  - Streak bonus: consecutive daily challenges multiply XP

### Gamification API Routes (update stubs from Phase 8)

- [ ] Update `app/api/gamification/leaderboard/route.ts` — Full implementation
  - GET: all-time (from user_profiles), weekly (from materialized view)
  - Query params: type (all_time, weekly, cascade_impact), limit, offset
  - Include current user's rank

- [ ] Update `app/api/gamification/achievements/route.ts` — Full implementation
  - GET: all achievements for current user (earned + locked)
  - Include progress for quantitative achievements

- [ ] `app/api/gamification/xp/route.ts` — XP transaction history
  - GET: paginated XP transactions for current user
  - Summary: total XP, level, rank

### Materialized View Refresh

- [ ] `lib/gamification/refresh-views.ts` — Refresh scheduling
  - `weekly_leaderboard` materialized view refresh (every hour)
  - `corpus_stats` refresh (after batch processing)
  - Can be called via API route or cron job

- [ ] `app/api/admin/refresh-views/route.ts` — Manual refresh trigger
  - POST: trigger materialized view refresh
  - Protected by admin secret

## Files to Create

```
lib/gamification/
├── xp.ts
├── streaks.ts
├── achievements.ts
└── refresh-views.ts
components/gamification/
├── Leaderboard.tsx
├── AchievementBadge.tsx
├── AchievementGrid.tsx
├── UserScoreCard.tsx
├── XPProgressBar.tsx
├── ContributionStreak.tsx
└── ImpactRipple.tsx
app/(public)/
├── leaderboard/
│   └── page.tsx
└── achievements/
    └── page.tsx
app/api/gamification/
├── xp/
│   └── route.ts
└── (update existing leaderboard + achievements routes)
app/api/admin/
└── refresh-views/
    └── route.ts
scripts/
└── seed-achievements.ts
```

## Updates to Existing Files

```
app/(public)/redactions/page.tsx              — XP previews on redaction cards
components/search/ResultCard.tsx              — Contributor attribution
components/document/RedactionHighlight.tsx    — Solved-by tooltip
app/(auth)/profile/page.tsx                   — Full gamification dashboard
components/chat/ChatMessage.tsx               — Citation contributor mentions
app/api/gamification/leaderboard/route.ts     — Full implementation
app/api/gamification/achievements/route.ts    — Full implementation
app/api/redaction/[id]/propose/route.ts       — XP awarding on submission
app/api/redaction/[id]/vote/route.ts          — XP awarding on vote
app/api/contribute/unredact/route.ts          — XP awarding
app/api/contribute/image-match/route.ts       — XP awarding
app/api/contribute/intelligence/route.ts      — XP awarding
```

## Acceptance Criteria

1. XP awarded correctly for each action type with proper multipliers
2. Level calculated correctly from total XP (7 levels with correct thresholds)
3. Streak increments daily, resets on missed days
4. Achievement seed script creates all ~25 achievements
5. Achievements unlock automatically when conditions are met
6. Leaderboard shows ranked users (all-time, weekly, cascade impact tabs)
7. Achievement page shows earned (full color) and locked (gray) badges
8. XPProgressBar animates on XP gain
9. ContributionStreak shows 7-day calendar
10. Profile page shows full gamification dashboard
11. Redaction cards show XP preview ("Solving this earns ~150 XP")
12. Solved redactions in document viewer show contributor attribution
13. Search results show contributor attribution on unredacted content
14. Materialized view refresh works via API endpoint
15. All gamification features degrade gracefully when user is not logged in (show stats but no personal data)

## Notes

- Gamification is intentionally the last phase — all contribution mechanics must work before adding rewards
- The achievement checking logic should be efficient (don't check all achievements on every action)
- Weekly leaderboard view should be refreshed hourly — acceptable staleness for v1
- XP transactions provide a complete audit trail — never modify XP directly, always create transactions
- Achievement badge art: use emoji for v1, custom SVGs for v2
- The "Cascade King/Queen" and "Most Wanted" achievements need periodic recalculation
