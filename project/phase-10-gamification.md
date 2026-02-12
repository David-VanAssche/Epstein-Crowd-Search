# Phase 10: Gamification & Community

> **Sessions:** 2 | **Dependencies:** Phase 9 (all polish complete) | **Parallel with:** Nothing (final phase)

## Summary

Implement the full gamification and community engagement system: XP awarding with multipliers, level progression through 7 researcher tiers (Observer through Chief Investigator), contribution streak tracking, achievement/badge unlocking, leaderboards (weekly, monthly, all-time, cascade impact), researcher reputation and trust levels, daily challenges, community challenges with collective goals, social features (follow users, activity feed), and cascade chain visualization showing who triggered discovery cascades. Weave gamification elements into existing pages (redaction dashboard, search, document viewer, profile). This is the engagement driver that makes solving redactions and building prosecutor-ready evidence feel as compelling as solving puzzles. Every contribution earns XP, every milestone unlocks a badge, and every cascade chain shows the real-world impact of crowdsourced research.

## IMPORTANT: Dependencies on Prior Phases

Phase 10 requires all contribution mechanics to be working before adding rewards on top. Specifically:

- Phase 6 (Redaction Engine): Proposal submission, voting, cascade matching
- Phase 7 (Image/Intel): Image matching, intelligence hints
- Phase 8 (Engagement): Bounties, daily challenges, annotations, OCR corrections, investigation threads
- Phase 9 (Polish): All UI polish, performance optimization

The gamification layer wraps around existing API routes. XP is awarded by calling `awardXP()` inside existing route handlers (propose, vote, image-match, etc.). No new contribution mechanics are created here — only the reward/tracking/display layer.

---

## Step-by-Step Execution

### Step 1: Install additional dependencies

```bash
# Animation for XP popups and impact ripples
pnpm add framer-motion
# (Already installed in Phase 1, but verify it's present)

# Date utilities for streak calculations
pnpm add date-fns
```

Verify `framer-motion` and `date-fns` are in `package.json` dependencies.

### Step 2: Create gamification directory structure

```bash
mkdir -p lib/gamification
mkdir -p components/gamification
mkdir -p app/(public)/leaderboard
mkdir -p app/(public)/achievements
mkdir -p app/api/gamification/xp
mkdir -p app/api/gamification/streaks
mkdir -p app/api/gamification/social
mkdir -p app/api/gamification/challenges
mkdir -p app/api/admin/refresh-views
```

### Step 3: XP calculation and awarding engine

File: `lib/gamification/xp.ts`

```ts
// lib/gamification/xp.ts
// Core XP engine: calculates XP for actions, awards XP, updates user level.
// Every XP change creates a transaction record — never modify XP directly.

import { createClient } from '@/lib/supabase/server'

// ─── XP Award Table ───────────────────────────────────────────────
export const XP_TABLE = {
  // Redaction proposals
  submit_proposal: { base: 10, description: 'Submit redaction proposal' },
  proposal_corroborated: { base: 25, description: 'Proposal corroborated by another user' },
  proposal_confirmed: { base: 100, description: 'Proposal confirmed correct' },
  cascade_triggered: { base: 50, description: 'Cascade triggered (per downstream solve)' },

  // Image matching
  submit_image_match: { base: 15, description: 'Submit image match' },
  image_match_confirmed: { base: 75, description: 'Image match confirmed' },

  // Intelligence hints
  submit_intelligence_hint: { base: 10, description: 'Submit intelligence hint' },
  hint_leads_to_solve: { base: 150, description: 'Hint leads to confirmed solve' },

  // Voting & corroboration
  vote_corroborate: { base: 5, description: 'Vote or corroborate on a proposal' },

  // Streaks & daily
  daily_login_streak: { base: 5, description: 'Daily login streak bonus' },
  first_contribution_of_day: { base: 10, description: 'First contribution of the day' },

  // OCR & reviews
  ocr_correction_approved: { base: 15, description: 'OCR correction approved' },
  document_review_completed: { base: 10, description: 'Document review completed' },

  // Annotations
  annotation_upvoted: { base: 5, description: 'Annotation upvoted (per 5 upvotes milestone)' },

  // Bounties & investigations
  research_bounty_completed: { base: 0, description: 'Research bounty completed (variable XP)' },
  guided_investigation_completed: { base: 25, description: 'Guided investigation completed' },

  // Photos & identification
  photo_identification_confirmed: { base: 20, description: 'Photo identification confirmed' },
  investigation_thread_popular: { base: 15, description: 'Investigation thread followed by 10+ users' },

  // Daily challenges & facts
  daily_challenge_solved: { base: 50, description: 'Daily challenge solved (bonus on top of normal XP)' },
  fact_verified: { base: 20, description: 'Fact verified by community' },
} as const

export type XPActionType = keyof typeof XP_TABLE

// ─── Level System ─────────────────────────────────────────────────
export const LEVELS = [
  { level: 1, title: 'Observer', xpRequired: 0, unlocks: 'Search, browse, vote' },
  { level: 2, title: 'Contributor', xpRequired: 50, unlocks: 'Submit proposals' },
  { level: 3, title: 'Investigator', xpRequired: 250, unlocks: 'Submit intel hints, priority review' },
  { level: 4, title: 'Analyst', xpRequired: 1_000, unlocks: 'Image matching, bulk export' },
  { level: 5, title: 'Senior Analyst', xpRequired: 5_000, unlocks: 'Weighted votes (2x), entity merges' },
  { level: 6, title: 'Lead Investigator', xpRequired: 15_000, unlocks: 'Moderate proposals, flag spam' },
  { level: 7, title: 'Chief Investigator', xpRequired: 50_000, unlocks: 'Admin dashboard, cascade tuning' },
] as const

export type LevelTitle = (typeof LEVELS)[number]['title']

/**
 * Calculate level from total XP.
 * Returns the highest level whose xpRequired threshold has been met.
 */
export function calculateLevel(totalXP: number): {
  level: number
  title: LevelTitle
  currentXP: number
  nextLevelXP: number | null
  progressPercent: number
} {
  let currentLevel = LEVELS[0]

  for (const lvl of LEVELS) {
    if (totalXP >= lvl.xpRequired) {
      currentLevel = lvl
    } else {
      break
    }
  }

  const nextLevel = LEVELS.find((l) => l.level === currentLevel.level + 1) ?? null
  const prevThreshold = currentLevel.xpRequired
  const nextThreshold = nextLevel?.xpRequired ?? null

  const progressPercent = nextThreshold
    ? Math.min(100, Math.floor(((totalXP - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    currentXP: totalXP,
    nextLevelXP: nextThreshold,
    progressPercent,
  }
}

/**
 * Calculate XP amount for an action with multiplier.
 * Multiplier defaults to 1 if not provided.
 * For variable-XP actions (bounties), pass the bounty's XP value as overrideBase.
 */
export function calculateXP(
  action: XPActionType,
  multiplier: number = 1,
  overrideBase?: number
): number {
  const base = overrideBase ?? XP_TABLE[action].base
  return Math.floor(base * multiplier)
}

/**
 * Award XP to a user. Creates a transaction record, updates totals, recalculates level.
 * Returns the awarded amount and any level-up info.
 */
export async function awardXP(params: {
  userId: string
  action: XPActionType
  multiplier?: number
  overrideBase?: number
  referenceId?: string
  referenceType?: string
  description?: string
}): Promise<{
  xpAwarded: number
  totalXP: number
  newLevel: number
  newTitle: LevelTitle
  leveledUp: boolean
  previousLevel: number
}> {
  const supabase = await createClient()
  const { userId, action, multiplier = 1, overrideBase, referenceId, referenceType, description } = params

  const xpAmount = calculateXP(action, multiplier, overrideBase)

  if (xpAmount <= 0) {
    // Fetch current state without awarding
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('xp, level')
      .eq('id', userId)
      .single()

    const currentXP = profile?.xp ?? 0
    const currentLevel = profile?.level ?? 1
    const levelInfo = calculateLevel(currentXP)

    return {
      xpAwarded: 0,
      totalXP: currentXP,
      newLevel: levelInfo.level,
      newTitle: levelInfo.title,
      leveledUp: false,
      previousLevel: currentLevel,
    }
  }

  // 1. Create XP transaction record
  const { error: txError } = await supabase.from('xp_transactions').insert({
    user_id: userId,
    action_type: action,
    xp_amount: xpAmount,
    multiplier,
    description: description || XP_TABLE[action].description,
    reference_id: referenceId || null,
    reference_type: referenceType || null,
  })

  if (txError) {
    throw new Error(`Failed to create XP transaction: ${txError.message}`)
  }

  // 2. Fetch current profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('xp, level, level_title')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    throw new Error(`Failed to fetch user profile: ${profileError?.message}`)
  }

  const previousLevel = profile.level
  const newTotalXP = profile.xp + xpAmount
  const levelInfo = calculateLevel(newTotalXP)
  const leveledUp = levelInfo.level > previousLevel

  // 3. Update user profile with new XP and level
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      xp: newTotalXP,
      level: levelInfo.level,
      level_title: levelInfo.title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    throw new Error(`Failed to update user profile: ${updateError.message}`)
  }

  return {
    xpAwarded: xpAmount,
    totalXP: newTotalXP,
    newLevel: levelInfo.level,
    newTitle: levelInfo.title,
    leveledUp,
    previousLevel,
  }
}

/**
 * Get XP transaction history for a user (paginated).
 */
export async function getXPHistory(
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{
  transactions: Array<{
    id: string
    action_type: XPActionType
    xp_amount: number
    multiplier: number
    description: string
    reference_id: string | null
    reference_type: string | null
    created_at: string
  }>
  total: number
  page: number
  pageSize: number
}> {
  const supabase = await createClient()
  const offset = (page - 1) * pageSize

  const { data, error, count } = await supabase
    .from('xp_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    throw new Error(`Failed to fetch XP history: ${error.message}`)
  }

  return {
    transactions: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  }
}
```

### Step 4: Streak tracking system

File: `lib/gamification/streaks.ts`

```ts
// lib/gamification/streaks.ts
// Manages daily contribution streaks.
// A streak increments when the user makes their first contribution each day.
// A streak resets if they miss a calendar day.

import { createClient } from '@/lib/supabase/server'
import { startOfDay, differenceInCalendarDays, subDays, format } from 'date-fns'
import { awardXP } from './xp'

export interface StreakInfo {
  currentStreak: number
  longestStreak: number
  lastContributionDate: string | null
  streakActive: boolean
  contributedToday: boolean
  streakBonusXP: number
  weekHistory: Array<{ date: string; active: boolean }>
}

/**
 * Get current streak info for a user.
 */
export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('current_streak, longest_streak, last_contribution_date')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastContributionDate: null,
      streakActive: false,
      contributedToday: false,
      streakBonusXP: 0,
      weekHistory: buildWeekHistory(null, 0),
    }
  }

  const today = startOfDay(new Date())
  const lastDate = profile.last_contribution_date
    ? startOfDay(new Date(profile.last_contribution_date))
    : null

  const contributedToday = lastDate
    ? differenceInCalendarDays(today, lastDate) === 0
    : false

  const streakActive = lastDate
    ? differenceInCalendarDays(today, lastDate) <= 1
    : false

  const currentStreak = streakActive ? profile.current_streak : 0
  const streakBonusXP = Math.min(currentStreak, 30) * 5

  return {
    currentStreak,
    longestStreak: profile.longest_streak,
    lastContributionDate: profile.last_contribution_date,
    streakActive,
    contributedToday,
    streakBonusXP,
    weekHistory: buildWeekHistory(profile.last_contribution_date, currentStreak),
  }
}

/**
 * Build a 7-day history showing which days were active.
 * Uses the streak count backwards from the last contribution date.
 */
function buildWeekHistory(
  lastContributionDate: string | null,
  currentStreak: number
): Array<{ date: string; active: boolean }> {
  const today = startOfDay(new Date())
  const history: Array<{ date: string; active: boolean }> = []

  // Build set of active dates from streak
  const activeDates = new Set<string>()
  if (lastContributionDate && currentStreak > 0) {
    const lastDate = startOfDay(new Date(lastContributionDate))
    for (let i = 0; i < Math.min(currentStreak, 7); i++) {
      activeDates.add(format(subDays(lastDate, i), 'yyyy-MM-dd'))
    }
  }

  // Build 7-day window (today and 6 days back)
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i)
    const dateStr = format(date, 'yyyy-MM-dd')
    history.push({
      date: dateStr,
      active: activeDates.has(dateStr),
    })
  }

  return history
}

/**
 * Record a contribution and update the streak.
 * Call this on every qualifying contribution (proposal, vote, image match, etc.).
 * Awards streak XP and first-contribution-of-day XP if applicable.
 *
 * Returns whether this was the first contribution of the day (for XP purposes).
 */
export async function recordContribution(userId: string): Promise<{
  isFirstToday: boolean
  newStreak: number
  streakXPAwarded: number
  firstContribXPAwarded: number
}> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('current_streak, longest_streak, last_contribution_date')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    throw new Error(`Failed to fetch user profile for streak: ${error?.message}`)
  }

  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')
  const lastDate = profile.last_contribution_date
    ? startOfDay(new Date(profile.last_contribution_date))
    : null

  const lastDateStr = lastDate ? format(lastDate, 'yyyy-MM-dd') : null

  // Already contributed today — no streak update needed
  if (lastDateStr === todayStr) {
    return {
      isFirstToday: false,
      newStreak: profile.current_streak,
      streakXPAwarded: 0,
      firstContribXPAwarded: 0,
    }
  }

  // Calculate new streak
  let newStreak: number
  if (lastDate && differenceInCalendarDays(today, lastDate) === 1) {
    // Consecutive day — increment streak
    newStreak = profile.current_streak + 1
  } else {
    // Missed a day (or first ever) — reset to 1
    newStreak = 1
  }

  const newLongest = Math.max(profile.longest_streak, newStreak)

  // Update profile
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_contribution_date: todayStr,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    throw new Error(`Failed to update streak: ${updateError.message}`)
  }

  // Award streak XP (capped at 30 days)
  const streakMultiplier = Math.min(newStreak, 30)
  let streakXPAwarded = 0
  if (newStreak > 1) {
    const result = await awardXP({
      userId,
      action: 'daily_login_streak',
      multiplier: streakMultiplier,
      description: `Day ${newStreak} streak bonus`,
    })
    streakXPAwarded = result.xpAwarded
  }

  // Award first-contribution-of-day XP
  const firstResult = await awardXP({
    userId,
    action: 'first_contribution_of_day',
    description: 'First contribution of the day',
  })

  return {
    isFirstToday: true,
    newStreak,
    streakXPAwarded,
    firstContribXPAwarded: firstResult.xpAwarded,
  }
}
```

### Step 5: Achievement system engine

File: `lib/gamification/achievements.ts`

```ts
// lib/gamification/achievements.ts
// Achievement checking and unlocking engine.
// Achievements are stored in the achievements table (seeded by script).
// When conditions are met, a user_achievements record is created.

import { createClient } from '@/lib/supabase/server'
import { awardXP } from './xp'

// ─── Achievement Definitions ──────────────────────────────────────
// These mirror what the seed script creates in the database.
// Used for type-safe checking logic.

export type AchievementCategory = 'discovery' | 'community' | 'effort' | 'special' | 'prosecutor'
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface AchievementDef {
  slug: string
  name: string
  description: string
  category: AchievementCategory
  rarity: AchievementRarity
  icon: string // emoji for v1, SVG path for v2
  bonusXP: number
  condition: string // human-readable unlock condition
  threshold?: number // for quantitative achievements
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Discovery badges ──
  {
    slug: 'first_blood',
    name: 'First Blood',
    description: 'Your first confirmed proposal',
    category: 'discovery',
    rarity: 'common',
    icon: '🎯',
    bonusXP: 50,
    condition: 'Get your first proposal confirmed',
    threshold: 1,
  },
  {
    slug: 'chain_reaction',
    name: 'Chain Reaction',
    description: 'Triggered a cascade of 10+ solves',
    category: 'discovery',
    rarity: 'rare',
    icon: '⚡',
    bonusXP: 200,
    condition: 'Trigger a cascade that solves 10+ redactions',
    threshold: 10,
  },
  {
    slug: 'domino_effect',
    name: 'Domino Effect',
    description: 'Triggered a cascade of 50+ solves',
    category: 'discovery',
    rarity: 'epic',
    icon: '🌊',
    bonusXP: 500,
    condition: 'Trigger a cascade that solves 50+ redactions',
    threshold: 50,
  },
  {
    slug: 'butterfly_effect',
    name: 'Butterfly Effect',
    description: 'Triggered a cascade of 100+ solves',
    category: 'discovery',
    rarity: 'legendary',
    icon: '🦋',
    bonusXP: 1000,
    condition: 'Trigger a cascade that solves 100+ redactions',
    threshold: 100,
  },
  {
    slug: 'across_the_aisle',
    name: 'Across the Aisle',
    description: 'Solved redactions in 5+ datasets',
    category: 'discovery',
    rarity: 'uncommon',
    icon: '🌐',
    bonusXP: 150,
    condition: 'Get confirmed proposals in 5 or more different datasets',
    threshold: 5,
  },
  {
    slug: 'pattern_recognition',
    name: 'Pattern Recognition',
    description: 'Identified the same entity in 10+ documents',
    category: 'discovery',
    rarity: 'rare',
    icon: '🔍',
    bonusXP: 200,
    condition: 'Have confirmed proposals revealing the same entity across 10+ documents',
    threshold: 10,
  },
  {
    slug: 'cold_case_cracker',
    name: 'Cold Case Cracker',
    description: 'Solved a redaction that was unsolved for 30+ days',
    category: 'discovery',
    rarity: 'rare',
    icon: '🧊',
    bonusXP: 200,
    condition: 'Solve a redaction that has been open for 30+ days',
  },
  {
    slug: 'deep_diver',
    name: 'Deep Diver',
    description: 'Made contributions across all 12 datasets',
    category: 'discovery',
    rarity: 'epic',
    icon: '🤿',
    bonusXP: 500,
    condition: 'Submit contributions in all 12 DOJ datasets',
    threshold: 12,
  },

  // ── Community badges ──
  {
    slug: 'corroborator',
    name: 'Corroborator',
    description: 'Corroborated 25 proposals from other users',
    category: 'community',
    rarity: 'uncommon',
    icon: '🤝',
    bonusXP: 100,
    condition: 'Corroborate 25 proposals',
    threshold: 25,
  },
  {
    slug: 'eagle_eye',
    name: 'Eagle Eye',
    description: '90%+ accuracy over 20+ proposals',
    category: 'community',
    rarity: 'rare',
    icon: '🦅',
    bonusXP: 300,
    condition: 'Maintain 90%+ accuracy rate across 20 or more proposals',
    threshold: 20,
  },
  {
    slug: 'early_bird',
    name: 'Early Bird',
    description: 'Among the first 100 contributors',
    category: 'community',
    rarity: 'rare',
    icon: '🐦',
    bonusXP: 200,
    condition: 'Be among the first 100 users to submit a contribution',
  },
  {
    slug: 'validator',
    name: 'Validator',
    description: 'Voted on 100+ proposals',
    category: 'community',
    rarity: 'uncommon',
    icon: '✅',
    bonusXP: 100,
    condition: 'Cast votes on 100 or more proposals',
    threshold: 100,
  },
  {
    slug: 'mentor',
    name: 'Mentor',
    description: '5 of your proposals were cited as evidence by others',
    category: 'community',
    rarity: 'rare',
    icon: '🎓',
    bonusXP: 250,
    condition: 'Have 5 of your proposals referenced as evidence by other users',
    threshold: 5,
  },

  // ── Effort badges ──
  {
    slug: 'streak_7',
    name: 'Week Warrior',
    description: '7-day contribution streak',
    category: 'effort',
    rarity: 'common',
    icon: '🔥',
    bonusXP: 50,
    condition: 'Maintain a 7-day contribution streak',
    threshold: 7,
  },
  {
    slug: 'streak_30',
    name: 'Monthly Machine',
    description: '30-day contribution streak',
    category: 'effort',
    rarity: 'uncommon',
    icon: '🔥',
    bonusXP: 200,
    condition: 'Maintain a 30-day contribution streak',
    threshold: 30,
  },
  {
    slug: 'streak_100',
    name: 'Hundred Days',
    description: '100-day contribution streak',
    category: 'effort',
    rarity: 'epic',
    icon: '🔥',
    bonusXP: 500,
    condition: 'Maintain a 100-day contribution streak',
    threshold: 100,
  },
  {
    slug: 'streak_365',
    name: 'Year of Truth',
    description: '365-day contribution streak',
    category: 'effort',
    rarity: 'legendary',
    icon: '🔥',
    bonusXP: 2000,
    condition: 'Maintain a 365-day contribution streak',
    threshold: 365,
  },
  {
    slug: 'centurion',
    name: 'Centurion',
    description: '100 confirmed contributions',
    category: 'effort',
    rarity: 'rare',
    icon: '💯',
    bonusXP: 300,
    condition: 'Have 100 confirmed contributions across all types',
    threshold: 100,
  },
  {
    slug: 'image_sleuth',
    name: 'Image Sleuth',
    description: '10 confirmed image matches',
    category: 'effort',
    rarity: 'uncommon',
    icon: '📷',
    bonusXP: 150,
    condition: 'Have 10 confirmed image matches',
    threshold: 10,
  },
  {
    slug: 'intelligence_asset',
    name: 'Intelligence Asset',
    description: '10 hints that led to confirmed solves',
    category: 'effort',
    rarity: 'rare',
    icon: '🕵️',
    bonusXP: 300,
    condition: 'Submit 10 intelligence hints that lead to confirmed solves',
    threshold: 10,
  },

  // ── Special badges ──
  {
    slug: 'cascade_monarch',
    name: 'Cascade Monarch',
    description: 'Holds the record for the highest single cascade chain',
    category: 'special',
    rarity: 'legendary',
    icon: '👑',
    bonusXP: 1000,
    condition: 'Hold the record for the largest single cascade chain',
  },
  {
    slug: 'most_wanted',
    name: 'Most Wanted',
    description: 'Solved the #1 most impactful redaction',
    category: 'special',
    rarity: 'legendary',
    icon: '🏆',
    bonusXP: 1000,
    condition: 'Solve the redaction with the highest impact score',
  },
  {
    slug: 'founding_investigator',
    name: 'Founding Investigator',
    description: 'Contributed during the first month of the platform',
    category: 'special',
    rarity: 'epic',
    icon: '⭐',
    bonusXP: 500,
    condition: 'Make a contribution within the first 30 days of the platform launch',
  },

  // ── Prosecutor Support badges ──
  {
    slug: 'evidence_builder',
    name: 'Evidence Builder',
    description: '10 documents fully reviewed (all completeness checks)',
    category: 'prosecutor',
    rarity: 'uncommon',
    icon: '📋',
    bonusXP: 150,
    condition: 'Complete all review checklist items for 10 documents',
    threshold: 10,
  },
  {
    slug: 'case_builder',
    name: 'Case Builder',
    description: 'Created an investigation thread followed by 50+ users',
    category: 'prosecutor',
    rarity: 'rare',
    icon: '🏗️',
    bonusXP: 250,
    condition: 'Create an investigation thread that attracts 50+ followers',
    threshold: 50,
  },
  {
    slug: 'ocr_hero',
    name: 'OCR Hero',
    description: '50 OCR corrections approved',
    category: 'prosecutor',
    rarity: 'uncommon',
    icon: '📝',
    bonusXP: 150,
    condition: 'Have 50 OCR corrections approved',
    threshold: 50,
  },
  {
    slug: 'photo_detective',
    name: 'Photo Detective',
    description: 'Identified people in 25 photos',
    category: 'prosecutor',
    rarity: 'rare',
    icon: '🔎',
    bonusXP: 200,
    condition: 'Confirm identification of people in 25 photos',
    threshold: 25,
  },
  {
    slug: 'bounty_hunter',
    name: 'Bounty Hunter',
    description: 'Completed 10 research bounties',
    category: 'prosecutor',
    rarity: 'uncommon',
    icon: '🎯',
    bonusXP: 150,
    condition: 'Complete 10 research bounties',
    threshold: 10,
  },
  {
    slug: 'fact_checker',
    name: 'Fact Checker',
    description: '20 verified facts submitted',
    category: 'prosecutor',
    rarity: 'uncommon',
    icon: '✔️',
    bonusXP: 100,
    condition: 'Have 20 facts verified by the community',
    threshold: 20,
  },
  {
    slug: 'daily_grinder',
    name: 'Daily Grinder',
    description: 'Completed 30 daily challenges',
    category: 'prosecutor',
    rarity: 'rare',
    icon: '📆',
    bonusXP: 200,
    condition: 'Complete 30 daily challenges',
    threshold: 30,
  },
  {
    slug: 'annotator',
    name: 'Annotator',
    description: '100 annotations with positive vote balance',
    category: 'prosecutor',
    rarity: 'uncommon',
    icon: '📌',
    bonusXP: 150,
    condition: 'Create 100 annotations that have a positive vote balance',
    threshold: 100,
  },
]

/**
 * Check all relevant achievements after a contribution.
 * Only checks achievements in categories relevant to the action type to avoid
 * unnecessary queries. Returns newly unlocked achievements.
 */
export async function checkAchievements(
  userId: string,
  context: {
    actionType: string
    cascadeCount?: number
    streakLength?: number
    datasetCount?: number
    proposalCount?: number
    voteCount?: number
    imageMatchCount?: number
    hintSolveCount?: number
    ocrCorrectionCount?: number
    bountyCount?: number
    challengeCount?: number
    annotationCount?: number
    documentReviewCount?: number
    photoIdCount?: number
    threadFollowerCount?: number
    factCount?: number
    accuracy?: number
    totalContributors?: number
    redactionAgeDays?: number
  }
): Promise<Array<{ slug: string; name: string; bonusXP: number }>> {
  const supabase = await createClient()

  // Fetch already-earned achievements for this user
  const { data: earned } = await supabase
    .from('user_achievements')
    .select('achievement_slug')
    .eq('user_id', userId)

  const earnedSlugs = new Set((earned ?? []).map((a) => a.achievement_slug))
  const newlyUnlocked: Array<{ slug: string; name: string; bonusXP: number }> = []

  // Check each achievement definition
  for (const def of ACHIEVEMENT_DEFS) {
    if (earnedSlugs.has(def.slug)) continue // Already earned

    const isUnlocked = checkSingleAchievement(def, context)

    if (isUnlocked) {
      // Create user_achievements record
      const { error } = await supabase.from('user_achievements').insert({
        user_id: userId,
        achievement_slug: def.slug,
        earned_at: new Date().toISOString(),
      })

      if (!error) {
        // Award bonus XP for achievement
        await awardXP({
          userId,
          action: 'daily_challenge_solved', // Generic action — overrideBase sets the real amount
          overrideBase: def.bonusXP,
          multiplier: 1,
          referenceType: 'achievement',
          referenceId: def.slug,
          description: `Achievement unlocked: ${def.name}`,
        })

        newlyUnlocked.push({
          slug: def.slug,
          name: def.name,
          bonusXP: def.bonusXP,
        })
      }
    }
  }

  return newlyUnlocked
}

/**
 * Check if a single achievement's conditions are met.
 */
function checkSingleAchievement(
  def: AchievementDef,
  ctx: Parameters<typeof checkAchievements>[1]
): boolean {
  switch (def.slug) {
    // Discovery
    case 'first_blood':
      return (ctx.proposalCount ?? 0) >= 1
    case 'chain_reaction':
      return (ctx.cascadeCount ?? 0) >= 10
    case 'domino_effect':
      return (ctx.cascadeCount ?? 0) >= 50
    case 'butterfly_effect':
      return (ctx.cascadeCount ?? 0) >= 100
    case 'across_the_aisle':
      return (ctx.datasetCount ?? 0) >= 5
    case 'pattern_recognition':
      return false // Requires complex query — handled in periodic recalculation
    case 'cold_case_cracker':
      return (ctx.redactionAgeDays ?? 0) >= 30
    case 'deep_diver':
      return (ctx.datasetCount ?? 0) >= 12

    // Community
    case 'corroborator':
      return (ctx.voteCount ?? 0) >= 25
    case 'eagle_eye':
      return (ctx.proposalCount ?? 0) >= 20 && (ctx.accuracy ?? 0) >= 0.9
    case 'early_bird':
      return (ctx.totalContributors ?? Infinity) <= 100
    case 'validator':
      return (ctx.voteCount ?? 0) >= 100
    case 'mentor':
      return false // Requires complex query — handled in periodic recalculation

    // Effort
    case 'streak_7':
      return (ctx.streakLength ?? 0) >= 7
    case 'streak_30':
      return (ctx.streakLength ?? 0) >= 30
    case 'streak_100':
      return (ctx.streakLength ?? 0) >= 100
    case 'streak_365':
      return (ctx.streakLength ?? 0) >= 365
    case 'centurion':
      return (ctx.proposalCount ?? 0) >= 100
    case 'image_sleuth':
      return (ctx.imageMatchCount ?? 0) >= 10
    case 'intelligence_asset':
      return (ctx.hintSolveCount ?? 0) >= 10

    // Special — handled in periodic recalculation
    case 'cascade_monarch':
    case 'most_wanted':
    case 'founding_investigator':
      return false

    // Prosecutor
    case 'evidence_builder':
      return (ctx.documentReviewCount ?? 0) >= 10
    case 'case_builder':
      return (ctx.threadFollowerCount ?? 0) >= 50
    case 'ocr_hero':
      return (ctx.ocrCorrectionCount ?? 0) >= 50
    case 'photo_detective':
      return (ctx.photoIdCount ?? 0) >= 25
    case 'bounty_hunter':
      return (ctx.bountyCount ?? 0) >= 10
    case 'fact_checker':
      return (ctx.factCount ?? 0) >= 20
    case 'daily_grinder':
      return (ctx.challengeCount ?? 0) >= 30
    case 'annotator':
      return (ctx.annotationCount ?? 0) >= 100

    default:
      return false
  }
}

/**
 * Get all achievements for a user (earned + locked with progress).
 */
export async function getUserAchievements(userId: string): Promise<
  Array<{
    slug: string
    name: string
    description: string
    category: AchievementCategory
    rarity: AchievementRarity
    icon: string
    bonusXP: number
    condition: string
    earned: boolean
    earnedAt: string | null
    progress: number | null
    threshold: number | null
  }>
> {
  const supabase = await createClient()

  // Fetch earned achievements
  const { data: earned } = await supabase
    .from('user_achievements')
    .select('achievement_slug, earned_at')
    .eq('user_id', userId)

  const earnedMap = new Map(
    (earned ?? []).map((a) => [a.achievement_slug, a.earned_at])
  )

  return ACHIEVEMENT_DEFS.map((def) => ({
    slug: def.slug,
    name: def.name,
    description: def.description,
    category: def.category,
    rarity: def.rarity,
    icon: def.icon,
    bonusXP: def.bonusXP,
    condition: def.condition,
    earned: earnedMap.has(def.slug),
    earnedAt: earnedMap.get(def.slug) ?? null,
    progress: null, // Will be populated with real counts in session 2
    threshold: def.threshold ?? null,
  }))
}
```

### Step 6: Achievement seed script

File: `scripts/seed-achievements.ts`

```ts
// scripts/seed-achievements.ts
// Seeds all achievement definitions into the achievements table.
// Run with: npx tsx scripts/seed-achievements.ts
//
// This is idempotent — it upserts by slug, so re-running is safe.

import { createClient } from '@supabase/supabase-js'
import { ACHIEVEMENT_DEFS } from '../lib/gamification/achievements'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function seedAchievements() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`Seeding ${ACHIEVEMENT_DEFS.length} achievements...`)

  const rows = ACHIEVEMENT_DEFS.map((def) => ({
    slug: def.slug,
    name: def.name,
    description: def.description,
    category: def.category,
    rarity: def.rarity,
    icon: def.icon,
    bonus_xp: def.bonusXP,
    unlock_condition: def.condition,
    threshold: def.threshold ?? null,
  }))

  const { data, error } = await supabase
    .from('achievements')
    .upsert(rows, { onConflict: 'slug' })

  if (error) {
    console.error('Failed to seed achievements:', error.message)
    process.exit(1)
  }

  console.log(`Successfully seeded ${ACHIEVEMENT_DEFS.length} achievements.`)

  // Print summary by category
  const byCat = ACHIEVEMENT_DEFS.reduce(
    (acc, d) => {
      acc[d.category] = (acc[d.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  console.log('\nBy category:')
  for (const [cat, count] of Object.entries(byCat)) {
    console.log(`  ${cat}: ${count}`)
  }

  // Print summary by rarity
  const byRarity = ACHIEVEMENT_DEFS.reduce(
    (acc, d) => {
      acc[d.rarity] = (acc[d.rarity] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  console.log('\nBy rarity:')
  for (const [rarity, count] of Object.entries(byRarity)) {
    console.log(`  ${rarity}: ${count}`)
  }
}

seedAchievements()
```

### Step 7: Cascade chain tracking

File: `lib/gamification/cascades.ts`

```ts
// lib/gamification/cascades.ts
// Tracks cascade chains — when one solve triggers downstream solves.
// A "cascade chain" is a tree: root solve -> first-order matches -> second-order matches -> ...
// This module provides queries for cascade visualization and impact scoring.

import { createClient } from '@/lib/supabase/server'

export interface CascadeNode {
  redactionId: string
  solvedBy: string
  solvedByName: string
  solvedAt: string
  depth: number
  documentId: string
  documentFilename: string
  childCount: number
}

export interface CascadeChain {
  rootRedactionId: string
  rootSolvedBy: string
  rootSolvedByName: string
  rootSolvedAt: string
  totalSolves: number
  maxDepth: number
  nodes: CascadeNode[]
}

/**
 * Get the cascade chain originating from a specific solve.
 * Uses the cascade_matches table to walk the tree.
 */
export async function getCascadeChain(rootRedactionId: string): Promise<CascadeChain | null> {
  const supabase = await createClient()

  // Fetch the root redaction
  const { data: root, error: rootError } = await supabase
    .from('redactions')
    .select(`
      id,
      resolved_text,
      confirmed_by,
      confirmed_at,
      document_id,
      documents!inner(filename)
    `)
    .eq('id', rootRedactionId)
    .single()

  if (rootError || !root) return null

  // Fetch all cascade matches downstream from this root
  const { data: cascades, error: cascadeError } = await supabase
    .from('cascade_matches')
    .select(`
      id,
      source_redaction_id,
      target_redaction_id,
      cascade_depth,
      target_redaction:redactions!target_redaction_id(
        id,
        confirmed_by,
        confirmed_at,
        document_id,
        documents!inner(filename)
      )
    `)
    .eq('root_redaction_id', rootRedactionId)
    .order('cascade_depth', { ascending: true })

  if (cascadeError) return null

  // Get user display names
  const userIds = new Set<string>()
  if (root.confirmed_by) userIds.add(root.confirmed_by)
  for (const c of cascades ?? []) {
    const target = c.target_redaction as any
    if (target?.confirmed_by) userIds.add(target.confirmed_by)
  }

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .in('id', Array.from(userIds))

  const userMap = new Map((users ?? []).map((u) => [u.id, u.display_name || 'Anonymous']))

  // Build nodes
  const nodes: CascadeNode[] = (cascades ?? []).map((c) => {
    const target = c.target_redaction as any
    return {
      redactionId: c.target_redaction_id,
      solvedBy: target?.confirmed_by || '',
      solvedByName: userMap.get(target?.confirmed_by) || 'Anonymous',
      solvedAt: target?.confirmed_at || '',
      depth: c.cascade_depth,
      documentId: target?.document_id || '',
      documentFilename: target?.documents?.filename || 'Unknown',
      childCount: 0,
    }
  })

  const maxDepth = nodes.length > 0 ? Math.max(...nodes.map((n) => n.depth)) : 0

  return {
    rootRedactionId,
    rootSolvedBy: root.confirmed_by || '',
    rootSolvedByName: userMap.get(root.confirmed_by) || 'Anonymous',
    rootSolvedAt: root.confirmed_at || '',
    totalSolves: nodes.length,
    maxDepth,
    nodes,
  }
}

/**
 * Get cascade impact stats for a user (total cascades triggered, largest chain, etc.).
 */
export async function getUserCascadeStats(userId: string): Promise<{
  totalCascadesTriggered: number
  totalDownstreamSolves: number
  largestChainSize: number
  largestChainId: string | null
  averageChainDepth: number
}> {
  const supabase = await createClient()

  const { data: roots, error } = await supabase
    .from('cascade_matches')
    .select('root_redaction_id, cascade_depth')
    .eq('root_confirmed_by', userId)

  if (error || !roots || roots.length === 0) {
    return {
      totalCascadesTriggered: 0,
      totalDownstreamSolves: 0,
      largestChainSize: 0,
      largestChainId: null,
      averageChainDepth: 0,
    }
  }

  // Group by root redaction
  const chainMap = new Map<string, number[]>()
  for (const r of roots) {
    const depths = chainMap.get(r.root_redaction_id) || []
    depths.push(r.cascade_depth)
    chainMap.set(r.root_redaction_id, depths)
  }

  let largestChainSize = 0
  let largestChainId: string | null = null
  let totalDownstream = 0
  let totalDepth = 0

  for (const [rootId, depths] of chainMap) {
    totalDownstream += depths.length
    totalDepth += Math.max(...depths)
    if (depths.length > largestChainSize) {
      largestChainSize = depths.length
      largestChainId = rootId
    }
  }

  return {
    totalCascadesTriggered: chainMap.size,
    totalDownstreamSolves: totalDownstream,
    largestChainSize,
    largestChainId,
    averageChainDepth: chainMap.size > 0 ? totalDepth / chainMap.size : 0,
  }
}

/**
 * Get the cascade leaderboard (users ranked by total downstream solves).
 */
export async function getCascadeLeaderboard(limit: number = 50): Promise<
  Array<{
    userId: string
    displayName: string
    level: number
    levelTitle: string
    totalCascades: number
    totalDownstreamSolves: number
    largestChain: number
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('get_cascade_leaderboard', { result_limit: limit })

  if (error || !data) return []

  return data.map((row: any) => ({
    userId: row.user_id,
    displayName: row.display_name || 'Anonymous',
    level: row.level,
    levelTitle: row.level_title,
    totalCascades: row.total_cascades,
    totalDownstreamSolves: row.total_downstream_solves,
    largestChain: row.largest_chain,
  }))
}
```

### Step 8: Social features — follow system and activity feed

File: `lib/gamification/social.ts`

```ts
// lib/gamification/social.ts
// Social features: follow users, activity feed, researcher profiles.
// Follows are stored in the user_follows table.
// Activity feed aggregates XP transactions and achievements from followed users.

import { createClient } from '@/lib/supabase/server'

export interface UserFollowInfo {
  followingCount: number
  followersCount: number
  isFollowing: boolean
}

/**
 * Follow a user.
 */
export async function followUser(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) {
    throw new Error('Cannot follow yourself')
  }

  const supabase = await createClient()

  const { error } = await supabase.from('user_follows').insert({
    follower_id: followerId,
    followee_id: followeeId,
  })

  if (error && error.code !== '23505') {
    throw new Error(`Failed to follow user: ${error.message}`)
  }
}

/**
 * Unfollow a user.
 */
export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)

  if (error) {
    throw new Error(`Failed to unfollow user: ${error.message}`)
  }
}

/**
 * Get follow info for a user profile (from the perspective of the viewing user).
 */
export async function getFollowInfo(
  profileUserId: string,
  viewerUserId: string | null
): Promise<UserFollowInfo> {
  const supabase = await createClient()

  const [
    { count: followingCount },
    { count: followersCount },
    isFollowingResult,
  ] = await Promise.all([
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileUserId),
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('followee_id', profileUserId),
    viewerUserId
      ? supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', viewerUserId)
          .eq('followee_id', profileUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    followingCount: followingCount ?? 0,
    followersCount: followersCount ?? 0,
    isFollowing: !!isFollowingResult.data,
  }
}

/**
 * Get activity feed for a user (actions from people they follow).
 */
export async function getActivityFeed(
  userId: string,
  page: number = 1,
  pageSize: number = 30
): Promise<{
  items: Array<{
    id: string
    userId: string
    displayName: string
    avatarUrl: string | null
    level: number
    levelTitle: string
    actionType: string
    description: string
    xpAmount: number
    referenceId: string | null
    referenceType: string | null
    createdAt: string
  }>
  total: number
}> {
  const supabase = await createClient()
  const offset = (page - 1) * pageSize

  // Get list of followed user IDs
  const { data: follows } = await supabase
    .from('user_follows')
    .select('followee_id')
    .eq('follower_id', userId)

  const followedIds = (follows ?? []).map((f) => f.followee_id)

  if (followedIds.length === 0) {
    return { items: [], total: 0 }
  }

  // Fetch recent XP transactions from followed users
  const { data, error, count } = await supabase
    .from('xp_transactions')
    .select(
      `
      id,
      user_id,
      action_type,
      description,
      xp_amount,
      reference_id,
      reference_type,
      created_at,
      user_profiles!inner(display_name, avatar_url, level, level_title)
    `,
      { count: 'exact' }
    )
    .in('user_id', followedIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    throw new Error(`Failed to fetch activity feed: ${error.message}`)
  }

  const items = (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.user_profiles?.display_name || 'Anonymous',
    avatarUrl: row.user_profiles?.avatar_url || null,
    level: row.user_profiles?.level || 1,
    levelTitle: row.user_profiles?.level_title || 'Observer',
    actionType: row.action_type,
    description: row.description,
    xpAmount: row.xp_amount,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    createdAt: row.created_at,
  }))

  return { items, total: count ?? 0 }
}

/**
 * Get followers list for a user.
 */
export async function getFollowers(
  userId: string,
  limit: number = 20
): Promise<
  Array<{
    userId: string
    displayName: string
    avatarUrl: string | null
    level: number
    levelTitle: string
    xp: number
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_follows')
    .select(
      `
      follower_id,
      follower:user_profiles!follower_id(
        id, display_name, avatar_url, level, level_title, xp
      )
    `
    )
    .eq('followee_id', userId)
    .limit(limit)

  if (error || !data) return []

  return data.map((row: any) => ({
    userId: row.follower?.id || row.follower_id,
    displayName: row.follower?.display_name || 'Anonymous',
    avatarUrl: row.follower?.avatar_url || null,
    level: row.follower?.level || 1,
    levelTitle: row.follower?.level_title || 'Observer',
    xp: row.follower?.xp || 0,
  }))
}
```

### Step 9: Materialized view refresh utility

File: `lib/gamification/refresh-views.ts`

```ts
// lib/gamification/refresh-views.ts
// Refreshes materialized views used by leaderboards and stats.
// Call via API route or cron job.

import { createClient } from '@/lib/supabase/server'

/**
 * Refresh the weekly leaderboard materialized view.
 * Should be called hourly (acceptable staleness for v1).
 */
export async function refreshWeeklyLeaderboard(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('refresh_weekly_leaderboard')
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Refresh the corpus stats materialized view.
 * Should be called after batch processing completes.
 */
export async function refreshCorpusStats(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('refresh_corpus_stats')
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Refresh the cascade leaderboard materialized view.
 * Should be called after cascade processing or hourly.
 */
export async function refreshCascadeLeaderboard(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('refresh_cascade_leaderboard')
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Refresh all materialized views.
 */
export async function refreshAllViews(): Promise<{
  results: Array<{ view: string; success: boolean; error?: string }>
}> {
  const results = await Promise.all([
    refreshWeeklyLeaderboard().then((r) => ({ view: 'weekly_leaderboard', ...r })),
    refreshCorpusStats().then((r) => ({ view: 'corpus_stats', ...r })),
    refreshCascadeLeaderboard().then((r) => ({ view: 'cascade_leaderboard', ...r })),
  ])
  return { results }
}
```

### Step 10: Community challenges system

File: `lib/gamification/challenges.ts`

```ts
// lib/gamification/challenges.ts
// Community challenges: collective goals that the entire user base works toward.
// Example: "Solve 500 redactions this week" or "Review 100 documents by Friday."

import { createClient } from '@/lib/supabase/server'

export type ChallengeStatus = 'active' | 'completed' | 'expired'
export type ChallengeMetric = 'redactions_solved' | 'documents_reviewed' | 'proposals_submitted'
  | 'cascades_triggered' | 'ocr_corrections' | 'bounties_completed' | 'new_contributors'

export interface CommunityChallenge {
  id: string
  title: string
  description: string
  metric: ChallengeMetric
  targetValue: number
  currentValue: number
  progressPercent: number
  status: ChallengeStatus
  rewardXP: number
  rewardBadgeSlug: string | null
  startsAt: string
  endsAt: string
  participantCount: number
}

/**
 * Get active community challenges.
 */
export async function getActiveChallenges(): Promise<CommunityChallenge[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('community_challenges')
    .select('*')
    .eq('status', 'active')
    .order('ends_at', { ascending: true })

  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    metric: row.metric,
    targetValue: row.target_value,
    currentValue: row.current_value,
    progressPercent: Math.min(100, Math.floor((row.current_value / row.target_value) * 100)),
    status: row.status,
    rewardXP: row.reward_xp,
    rewardBadgeSlug: row.reward_badge_slug,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    participantCount: row.participant_count,
  }))
}

/**
 * Increment the metric for a community challenge.
 * Called from contribution API routes when the matching action occurs.
 */
export async function incrementChallengeProgress(
  metric: ChallengeMetric,
  incrementBy: number = 1
): Promise<void> {
  const supabase = await createClient()

  const { data: challenges } = await supabase
    .from('community_challenges')
    .select('id, current_value, target_value')
    .eq('metric', metric)
    .eq('status', 'active')

  if (!challenges || challenges.length === 0) return

  for (const challenge of challenges) {
    const newValue = challenge.current_value + incrementBy
    const isComplete = newValue >= challenge.target_value

    await supabase
      .from('community_challenges')
      .update({
        current_value: newValue,
        status: isComplete ? 'completed' : 'active',
        completed_at: isComplete ? new Date().toISOString() : null,
      })
      .eq('id', challenge.id)
  }
}

/**
 * Get recently completed community challenges.
 */
export async function getCompletedChallenges(limit: number = 5): Promise<CommunityChallenge[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('community_challenges')
    .select('*')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    metric: row.metric,
    targetValue: row.target_value,
    currentValue: row.current_value,
    progressPercent: 100,
    status: 'completed' as const,
    rewardXP: row.reward_xp,
    rewardBadgeSlug: row.reward_badge_slug,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    participantCount: row.participant_count,
  }))
}
```

### Step 11: Gamification React hooks

File: `lib/hooks/useGamification.ts`

```ts
// lib/hooks/useGamification.ts
// React hooks for gamification data: XP, level, streaks, achievements, leaderboards.

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── User Gamification Profile ────────────────────────────────────
export function useGamificationProfile(userId?: string) {
  return useQuery({
    queryKey: ['gamification', 'profile', userId],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/xp?userId=${userId}`)
      if (!res.ok) throw new Error('Failed to fetch gamification profile')
      return res.json()
    },
    enabled: !!userId,
  })
}

// ─── XP Transaction History ───────────────────────────────────────
export function useXPHistory(page: number = 1) {
  return useQuery({
    queryKey: ['gamification', 'xp-history', page],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/xp?page=${page}`)
      if (!res.ok) throw new Error('Failed to fetch XP history')
      return res.json()
    },
  })
}

// ─── Streak Info ──────────────────────────────────────────────────
export function useStreak() {
  return useQuery({
    queryKey: ['gamification', 'streak'],
    queryFn: async () => {
      const res = await fetch('/api/gamification/streaks')
      if (!res.ok) throw new Error('Failed to fetch streak')
      return res.json()
    },
  })
}

// ─── Achievements ─────────────────────────────────────────────────
export function useAchievements(userId?: string) {
  return useQuery({
    queryKey: ['gamification', 'achievements', userId],
    queryFn: async () => {
      const url = userId
        ? `/api/gamification/achievements?userId=${userId}`
        : '/api/gamification/achievements'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch achievements')
      return res.json()
    },
  })
}

// ─── Leaderboard ──────────────────────────────────────────────────
export type LeaderboardType = 'all_time' | 'weekly' | 'monthly' | 'cascade_impact'

export function useLeaderboard(type: LeaderboardType = 'all_time', limit: number = 50) {
  return useQuery({
    queryKey: ['gamification', 'leaderboard', type, limit],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/leaderboard?type=${type}&limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch leaderboard')
      return res.json()
    },
  })
}

// ─── Activity Feed (Social) ──────────────────────────────────────
export function useActivityFeed(page: number = 1) {
  return useQuery({
    queryKey: ['gamification', 'activity-feed', page],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/social/feed?page=${page}`)
      if (!res.ok) throw new Error('Failed to fetch activity feed')
      return res.json()
    },
  })
}

// ─── Follow/Unfollow ─────────────────────────────────────────────
export function useFollow() {
  const queryClient = useQueryClient()

  const follow = useMutation({
    mutationFn: async (followeeId: string) => {
      const res = await fetch('/api/gamification/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followeeId }),
      })
      if (!res.ok) throw new Error('Failed to follow user')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification', 'activity-feed'] })
    },
  })

  const unfollow = useMutation({
    mutationFn: async (followeeId: string) => {
      const res = await fetch('/api/gamification/social/follow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followeeId }),
      })
      if (!res.ok) throw new Error('Failed to unfollow user')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification', 'activity-feed'] })
    },
  })

  return { follow, unfollow }
}

// ─── Community Challenges ────────────────────────────────────────
export function useCommunityChallenge() {
  return useQuery({
    queryKey: ['gamification', 'community-challenges'],
    queryFn: async () => {
      const res = await fetch('/api/gamification/challenges')
      if (!res.ok) throw new Error('Failed to fetch community challenges')
      return res.json()
    },
  })
}
```

### Step 12: API Routes — Session 1 (XP, Streaks, Achievements, Leaderboard)

#### XP API Route — `app/api/gamification/xp/route.ts`

```ts
// app/api/gamification/xp/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getXPHistory, calculateLevel } from '@/lib/gamification/xp'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const searchParams = request.nextUrl.searchParams
  const targetUserId = searchParams.get('userId') || user?.id
  const page = parseInt(searchParams.get('page') || '1', 10)

  if (!targetUserId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Fetch profile summary
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('xp, level, level_title, current_streak, longest_streak')
    .eq('id', targetUserId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const levelInfo = calculateLevel(profile.xp)

  // Fetch XP history if requesting own profile
  let history = null
  if (targetUserId === user?.id) {
    history = await getXPHistory(targetUserId, page)
  }

  return NextResponse.json({
    profile: {
      xp: profile.xp,
      level: profile.level,
      levelTitle: profile.level_title,
      nextLevelXP: levelInfo.nextLevelXP,
      progressPercent: levelInfo.progressPercent,
      currentStreak: profile.current_streak,
      longestStreak: profile.longest_streak,
    },
    history,
  })
}
```

#### Streaks API Route — `app/api/gamification/streaks/route.ts`

```ts
// app/api/gamification/streaks/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStreakInfo } from '@/lib/gamification/streaks'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const streakInfo = await getStreakInfo(user.id)
  return NextResponse.json(streakInfo)
}
```

#### Achievements API Route — `app/api/gamification/achievements/route.ts`

```ts
// app/api/gamification/achievements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAchievements } from '@/lib/gamification/achievements'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const searchParams = request.nextUrl.searchParams
  const targetUserId = searchParams.get('userId') || user?.id

  if (!targetUserId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const achievements = await getUserAchievements(targetUserId)

  const earned = achievements.filter((a) => a.earned)
  const locked = achievements.filter((a) => !a.earned)

  return NextResponse.json({
    achievements,
    summary: {
      total: achievements.length,
      earned: earned.length,
      locked: locked.length,
      byCategory: {
        discovery: achievements.filter((a) => a.category === 'discovery'),
        community: achievements.filter((a) => a.category === 'community'),
        effort: achievements.filter((a) => a.category === 'effort'),
        special: achievements.filter((a) => a.category === 'special'),
        prosecutor: achievements.filter((a) => a.category === 'prosecutor'),
      },
    },
  })
}
```

#### Leaderboard API Route — `app/api/gamification/leaderboard/route.ts`

```ts
// app/api/gamification/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCascadeLeaderboard } from '@/lib/gamification/cascades'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') || 'all_time'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  let entries: any[] = []
  let userRank: number | null = null

  if (type === 'all_time') {
    // All-time: ranked by total XP from user_profiles
    const { data } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url, xp, level, level_title')
      .order('xp', { ascending: false })
      .limit(limit)

    entries = (data ?? []).map((row: any, i: number) => ({
      rank: i + 1,
      userId: row.id,
      displayName: row.display_name || 'Anonymous',
      avatarUrl: row.avatar_url,
      xp: row.xp,
      level: row.level,
      levelTitle: row.level_title,
    }))

    // Find current user's rank
    if (user) {
      const { count } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gt('xp', (await supabase.from('user_profiles').select('xp').eq('id', user.id).single()).data?.xp ?? 0)
      userRank = (count ?? 0) + 1
    }

  } else if (type === 'weekly') {
    // Weekly: from materialized view (refreshed hourly)
    const { data } = await supabase
      .from('weekly_leaderboard')
      .select('*')
      .order('weekly_xp', { ascending: false })
      .limit(limit)

    entries = (data ?? []).map((row: any, i: number) => ({
      rank: i + 1,
      userId: row.user_id,
      displayName: row.display_name || 'Anonymous',
      avatarUrl: row.avatar_url,
      xp: row.weekly_xp,
      level: row.level,
      levelTitle: row.level_title,
    }))

  } else if (type === 'monthly') {
    // Monthly: aggregate XP transactions from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .rpc('get_monthly_leaderboard', { since_date: thirtyDaysAgo, result_limit: limit })

    entries = (data ?? []).map((row: any, i: number) => ({
      rank: i + 1,
      userId: row.user_id,
      displayName: row.display_name || 'Anonymous',
      avatarUrl: row.avatar_url,
      xp: row.monthly_xp,
      level: row.level,
      levelTitle: row.level_title,
    }))

  } else if (type === 'cascade_impact') {
    const cascadeEntries = await getCascadeLeaderboard(limit)
    entries = cascadeEntries.map((row, i) => ({
      rank: i + 1,
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: null,
      xp: row.totalDownstreamSolves,
      level: row.level,
      levelTitle: row.levelTitle,
      cascades: row.totalCascades,
      largestChain: row.largestChain,
    }))
  }

  return NextResponse.json({ entries, userRank, type })
}
```

#### Social API Routes

File: `app/api/gamification/social/follow/route.ts`

```ts
// app/api/gamification/social/follow/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { followUser, unfollowUser } from '@/lib/gamification/social'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { followeeId } = await request.json()

  if (!followeeId) {
    return NextResponse.json({ error: 'followeeId is required' }, { status: 400 })
  }

  await followUser(user.id, followeeId)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { followeeId } = await request.json()

  if (!followeeId) {
    return NextResponse.json({ error: 'followeeId is required' }, { status: 400 })
  }

  await unfollowUser(user.id, followeeId)
  return NextResponse.json({ success: true })
}
```

File: `app/api/gamification/social/feed/route.ts`

```ts
// app/api/gamification/social/feed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActivityFeed } from '@/lib/gamification/social'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10)
  const feed = await getActivityFeed(user.id, page)

  return NextResponse.json(feed)
}
```

#### Community Challenges API Route — `app/api/gamification/challenges/route.ts`

```ts
// app/api/gamification/challenges/route.ts
import { NextResponse } from 'next/server'
import { getActiveChallenges, getCompletedChallenges } from '@/lib/gamification/challenges'

export async function GET() {
  const [active, completed] = await Promise.all([
    getActiveChallenges(),
    getCompletedChallenges(5),
  ])

  return NextResponse.json({ active, completed })
}
```

#### Admin Refresh Views API Route — `app/api/admin/refresh-views/route.ts`

```ts
// app/api/admin/refresh-views/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { refreshAllViews } from '@/lib/gamification/refresh-views'

export async function POST(request: NextRequest) {
  // Protected by admin secret
  const authHeader = request.headers.get('authorization')
  const adminSecret = process.env.ADMIN_SECRET

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { results } = await refreshAllViews()

  const allSuccess = results.every((r) => r.success)
  return NextResponse.json(
    { results },
    { status: allSuccess ? 200 : 207 }
  )
}
```

### Step 13: Gamification UI Components — Session 2

#### XP Progress Bar — `components/gamification/XPProgressBar.tsx`

```tsx
// components/gamification/XPProgressBar.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'

interface XPProgressBarProps {
  currentXP: number
  nextLevelXP: number | null
  currentLevelTitle: string
  nextLevelTitle: string | null
  progressPercent: number
  recentXPGain?: number // Shows "+X XP" animation when set
}

export function XPProgressBar({
  currentXP,
  nextLevelXP,
  currentLevelTitle,
  nextLevelTitle,
  progressPercent,
  recentXPGain,
}: XPProgressBarProps) {
  const [showGain, setShowGain] = useState(false)

  useEffect(() => {
    if (recentXPGain && recentXPGain > 0) {
      setShowGain(true)
      const timer = setTimeout(() => setShowGain(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [recentXPGain])

  return (
    <div className="relative space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-primary">{currentLevelTitle}</span>
        {nextLevelTitle && (
          <span className="text-muted-foreground">{nextLevelTitle}</span>
        )}
      </div>

      <div className="relative">
        <Progress value={progressPercent} className="h-3" />
        <AnimatePresence>
          {showGain && recentXPGain && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -20 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute -right-2 -top-6 text-sm font-bold text-green-400"
            >
              +{recentXPGain} XP
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{currentXP.toLocaleString()} XP</span>
        {nextLevelXP && (
          <span>{nextLevelXP.toLocaleString()} XP</span>
        )}
      </div>
    </div>
  )
}
```

#### User Score Card — `components/gamification/UserScoreCard.tsx`

```tsx
// components/gamification/UserScoreCard.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { XPProgressBar } from './XPProgressBar'

interface UserScoreCardProps {
  displayName: string
  avatarUrl: string | null
  level: number
  levelTitle: string
  xp: number
  nextLevelXP: number | null
  progressPercent: number
  rank: number | null
  currentStreak: number
  recentXPGain?: number
  compact?: boolean // For sidebar/inline use
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-zinc-600 text-zinc-200',
  2: 'bg-blue-600 text-blue-100',
  3: 'bg-green-600 text-green-100',
  4: 'bg-purple-600 text-purple-100',
  5: 'bg-amber-600 text-amber-100',
  6: 'bg-orange-600 text-orange-100',
  7: 'bg-red-600 text-red-100',
}

const NEXT_TITLE: Record<string, string> = {
  Observer: 'Contributor',
  Contributor: 'Investigator',
  Investigator: 'Analyst',
  Analyst: 'Senior Analyst',
  'Senior Analyst': 'Lead Investigator',
  'Lead Investigator': 'Chief Investigator',
  'Chief Investigator': '',
}

export function UserScoreCard({
  displayName,
  avatarUrl,
  level,
  levelTitle,
  xp,
  nextLevelXP,
  progressPercent,
  rank,
  currentStreak,
  recentXPGain,
  compact = false,
}: UserScoreCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{displayName}</span>
            <Badge className={`text-[10px] ${LEVEL_COLORS[level] || LEVEL_COLORS[1]}`}>
              Lv.{level}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{xp.toLocaleString()} XP</span>
            {currentStreak > 0 && <span>🔥 {currentStreak}</span>}
            {rank && <span>#{rank}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="border-border bg-surface">
      <CardContent className="pt-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated text-lg font-bold">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h3 className="font-semibold">{displayName}</h3>
            <div className="flex items-center gap-2">
              <Badge className={LEVEL_COLORS[level] || LEVEL_COLORS[1]}>
                Lv.{level} {levelTitle}
              </Badge>
              {currentStreak > 0 && (
                <span className="text-xs text-amber-400">🔥 {currentStreak} day streak</span>
              )}
            </div>
          </div>
        </div>

        <XPProgressBar
          currentXP={xp}
          nextLevelXP={nextLevelXP}
          currentLevelTitle={levelTitle}
          nextLevelTitle={NEXT_TITLE[levelTitle] || null}
          progressPercent={progressPercent}
          recentXPGain={recentXPGain}
        />

        {rank && (
          <div className="mt-3 text-center text-xs text-muted-foreground">
            Global Rank: <span className="font-semibold text-primary">#{rank}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

#### Contribution Streak — `components/gamification/ContributionStreak.tsx`

```tsx
// components/gamification/ContributionStreak.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

interface ContributionStreakProps {
  currentStreak: number
  longestStreak: number
  streakActive: boolean
  contributedToday: boolean
  streakBonusXP: number
  weekHistory: Array<{ date: string; active: boolean }>
}

export function ContributionStreak({
  currentStreak,
  longestStreak,
  streakActive,
  contributedToday,
  streakBonusXP,
  weekHistory,
}: ContributionStreakProps) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className={cn('text-xl', streakActive ? 'animate-pulse' : 'grayscale')}>
            🔥
          </span>
          <span>
            {currentStreak > 0
              ? `${currentStreak}-Day Streak`
              : 'No Active Streak'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 7-Day Calendar */}
        <div className="mb-4 flex justify-between gap-1">
          {weekHistory.map((day) => (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">
                {format(parseISO(day.date), 'EEE').charAt(0)}
              </span>
              <div
                className={cn(
                  'h-6 w-6 rounded-sm',
                  day.active
                    ? 'bg-green-500/80'
                    : 'bg-surface-elevated'
                )}
              />
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Longest: {longestStreak} days</span>
          {streakBonusXP > 0 && (
            <span className="text-green-400">+{streakBonusXP} XP bonus</span>
          )}
        </div>

        {/* Warning / CTA */}
        {!contributedToday && streakActive && currentStreak > 0 && (
          <p className="mt-2 text-xs text-amber-400">
            Contribute today to keep your streak alive!
          </p>
        )}
        {!streakActive && (
          <p className="mt-2 text-xs text-muted-foreground">
            Start a streak by contributing something today.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

#### Achievement Badge — `components/gamification/AchievementBadge.tsx`

```tsx
// components/gamification/AchievementBadge.tsx
'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AchievementRarity } from '@/lib/gamification/achievements'

interface AchievementBadgeProps {
  icon: string
  name: string
  description: string
  condition: string
  rarity: AchievementRarity
  earned: boolean
  earnedAt: string | null
  progress: number | null // 0-100 for quantitative achievements
  size?: 'sm' | 'md' | 'lg'
}

const RARITY_RING: Record<AchievementRarity, string> = {
  common: 'ring-zinc-500',
  uncommon: 'ring-green-500',
  rare: 'ring-blue-500',
  epic: 'ring-purple-500',
  legendary: 'ring-amber-500',
}

const RARITY_GLOW: Record<AchievementRarity, string> = {
  common: '',
  uncommon: 'shadow-green-500/20',
  rare: 'shadow-blue-500/20',
  epic: 'shadow-purple-500/30',
  legendary: 'shadow-amber-500/40',
}

const SIZE_MAP = {
  sm: 'h-10 w-10 text-lg',
  md: 'h-14 w-14 text-2xl',
  lg: 'h-20 w-20 text-4xl',
}

export function AchievementBadge({
  icon,
  name,
  description,
  condition,
  rarity,
  earned,
  earnedAt,
  progress,
  size = 'md',
}: AchievementBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={cn(
              'flex items-center justify-center rounded-full ring-2',
              SIZE_MAP[size],
              earned
                ? cn(RARITY_RING[rarity], RARITY_GLOW[rarity], 'shadow-lg')
                : 'grayscale opacity-40 ring-zinc-700',
              earned && 'bg-surface-elevated' ,
              !earned && 'bg-surface'
            )}
          >
            {earned ? icon : '?'}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {earned && earnedAt ? (
            <p className="mt-1 text-xs text-green-400">
              Earned {new Date(earnedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{condition}</p>
          )}
          {!earned && progress !== null && (
            <div className="mt-1">
              <div className="h-1 w-full rounded bg-surface-elevated">
                <div
                  className="h-1 rounded bg-primary"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{progress}%</span>
            </div>
          )}
          <p className="mt-1 text-[10px] capitalize text-muted-foreground">
            {rarity}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

#### Achievement Grid — `components/gamification/AchievementGrid.tsx`

```tsx
// components/gamification/AchievementGrid.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AchievementBadge } from './AchievementBadge'
import type { AchievementCategory, AchievementRarity } from '@/lib/gamification/achievements'

interface Achievement {
  slug: string
  name: string
  description: string
  category: AchievementCategory
  rarity: AchievementRarity
  icon: string
  bonusXP: number
  condition: string
  earned: boolean
  earnedAt: string | null
  progress: number | null
  threshold: number | null
}

interface AchievementGridProps {
  achievements: Achievement[]
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  discovery: 'Discovery',
  community: 'Community',
  effort: 'Effort',
  special: 'Special',
  prosecutor: 'Prosecutor Support',
}

export function AchievementGrid({ achievements }: AchievementGridProps) {
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all')

  const filtered = achievements.filter((a) => {
    if (filter === 'earned') return a.earned
    if (filter === 'locked') return !a.earned
    return true
  })

  // Group by category
  const byCategory = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
    category: cat as AchievementCategory,
    label,
    achievements: filtered.filter((a) => a.category === cat),
  })).filter((g) => g.achievements.length > 0)

  return (
    <div>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All ({achievements.length})</TabsTrigger>
          <TabsTrigger value="earned">
            Earned ({achievements.filter((a) => a.earned).length})
          </TabsTrigger>
          <TabsTrigger value="locked">
            Locked ({achievements.filter((a) => !a.earned).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {byCategory.map((group) => (
            <div key={group.category} className="mb-8">
              <h3 className="mb-4 text-lg font-semibold">{group.label}</h3>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {group.achievements.map((a) => (
                  <div key={a.slug} className="flex flex-col items-center gap-1">
                    <AchievementBadge
                      icon={a.icon}
                      name={a.name}
                      description={a.description}
                      condition={a.condition}
                      rarity={a.rarity}
                      earned={a.earned}
                      earnedAt={a.earnedAt}
                      progress={a.progress}
                    />
                    <span className="text-center text-[10px] text-muted-foreground line-clamp-1">
                      {a.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

#### Impact Ripple — `components/gamification/ImpactRipple.tsx`

```tsx
// components/gamification/ImpactRipple.tsx
'use client'

import { motion } from 'framer-motion'

interface ImpactRippleProps {
  totalSolves: number
  maxDepth: number
  rootSolvedByName: string
}

export function ImpactRipple({ totalSolves, maxDepth, rootSolvedByName }: ImpactRippleProps) {
  const rings = Array.from({ length: Math.min(maxDepth, 5) }, (_, i) => i + 1)

  return (
    <div className="relative flex h-64 w-64 items-center justify-center">
      {/* Ripple rings */}
      {rings.map((depth) => (
        <motion.div
          key={depth}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{
            duration: 1.5,
            delay: depth * 0.3,
            ease: 'easeOut',
          }}
          className="absolute rounded-full border border-accent/30"
          style={{
            width: `${depth * 80}px`,
            height: `${depth * 80}px`,
          }}
        />
      ))}

      {/* Center dot */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
        className="relative z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-accent text-xs font-bold text-white"
      >
        <span className="text-lg">{totalSolves}</span>
        <span className="text-[8px]">solves</span>
      </motion.div>

      {/* Depth labels on rings */}
      {rings.map((depth) => (
        <motion.span
          key={`label-${depth}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: depth * 0.3 + 1 }}
          className="absolute text-[10px] text-muted-foreground"
          style={{
            top: `calc(50% - ${depth * 40}px - 8px)`,
          }}
        >
          Depth {depth}
        </motion.span>
      ))}

      {/* Attribution */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute -bottom-8 text-center text-xs text-muted-foreground"
      >
        Cascade started by @{rootSolvedByName}
      </motion.p>
    </div>
  )
}
```

#### Leaderboard Table — `components/gamification/Leaderboard.tsx`

```tsx
// components/gamification/Leaderboard.tsx
'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  xp: number
  level: number
  levelTitle: string
  cascades?: number
  largestChain?: number
}

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  currentUserId?: string
  currentUserRank?: number | null
  type: 'all_time' | 'weekly' | 'monthly' | 'cascade_impact'
}

const MEDAL_ICONS = ['🥇', '🥈', '🥉']

export function Leaderboard({ entries, currentUserId, currentUserRank, type }: LeaderboardProps) {
  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const isCurrentUser = entry.userId === currentUserId
        const medal = entry.rank <= 3 ? MEDAL_ICONS[entry.rank - 1] : null

        return (
          <div
            key={entry.userId}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
              isCurrentUser
                ? 'border border-accent/30 bg-accent/5'
                : 'hover:bg-surface-elevated'
            )}
          >
            {/* Rank */}
            <div className="w-8 text-center">
              {medal ? (
                <span className="text-lg">{medal}</span>
              ) : (
                <span className="text-sm text-muted-foreground">#{entry.rank}</span>
              )}
            </div>

            {/* Avatar + Name */}
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-surface-elevated text-xs">
                {entry.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', isCurrentUser && 'text-accent')}>
                  {entry.displayName}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Lv.{entry.level} {entry.levelTitle}
                </Badge>
              </div>
            </div>

            {/* Stats */}
            <div className="text-right">
              <span className="text-sm font-semibold">
                {type === 'cascade_impact'
                  ? `${entry.xp} solves`
                  : `${entry.xp.toLocaleString()} XP`}
              </span>
              {type === 'cascade_impact' && entry.cascades !== undefined && (
                <p className="text-[10px] text-muted-foreground">
                  {entry.cascades} cascades
                </p>
              )}
            </div>
          </div>
        )
      })}

      {/* Current user's rank (sticky footer) */}
      {currentUserRank && !entries.find((e) => e.userId === currentUserId) && (
        <div className="sticky bottom-0 border-t border-border bg-surface px-3 py-2 text-center text-sm text-muted-foreground">
          Your rank: <span className="font-semibold text-accent">#{currentUserRank}</span>
        </div>
      )}
    </div>
  )
}
```

#### Community Challenge Card — `components/gamification/CommunityChallengeCard.tsx`

```tsx
// components/gamification/CommunityChallengeCard.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { CommunityChallenge } from '@/lib/gamification/challenges'

interface CommunityChallengeCardProps {
  challenge: CommunityChallenge
}

export function CommunityChallengeCard({ challenge }: CommunityChallengeCardProps) {
  const timeLeft = new Date(challenge.endsAt).getTime() - Date.now()
  const daysLeft = Math.max(0, Math.ceil(timeLeft / (1000 * 60 * 60 * 24)))

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{challenge.title}</CardTitle>
          <Badge variant={challenge.status === 'completed' ? 'default' : 'outline'}>
            {challenge.status === 'completed' ? 'Completed!' : `${daysLeft}d left`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">{challenge.description}</p>

        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>{challenge.currentValue.toLocaleString()} / {challenge.targetValue.toLocaleString()}</span>
          <span>{challenge.progressPercent}%</span>
        </div>
        <Progress value={challenge.progressPercent} className="h-2" />

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{challenge.participantCount} participants</span>
          <span className="text-green-400">+{challenge.rewardXP} XP reward</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Activity Feed Item — `components/gamification/ActivityFeedItem.tsx`

```tsx
// components/gamification/ActivityFeedItem.tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface ActivityFeedItemProps {
  userId: string
  displayName: string
  avatarUrl: string | null
  level: number
  levelTitle: string
  actionType: string
  description: string
  xpAmount: number
  createdAt: string
}

export function ActivityFeedItem({
  userId,
  displayName,
  avatarUrl,
  level,
  levelTitle,
  actionType,
  description,
  xpAmount,
  createdAt,
}: ActivityFeedItemProps) {
  const timeAgo = getTimeAgo(new Date(createdAt))

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-surface-elevated">
      <Link href={`/profile/${userId}`}>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-surface-elevated text-xs">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1">
        <p className="text-sm">
          <Link href={`/profile/${userId}`} className="font-medium hover:underline">
            {displayName}
          </Link>{' '}
          <span className="text-muted-foreground">{description}</span>
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            Lv.{level}
          </Badge>
          <span className="text-green-400">+{xpAmount} XP</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
```

### Step 14: Page Components — Leaderboard and Achievements

#### Leaderboard Page — `app/(public)/leaderboard/page.tsx`

```tsx
// app/(public)/leaderboard/page.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Leaderboard } from '@/components/gamification/Leaderboard'
import { useLeaderboard, type LeaderboardType } from '@/lib/hooks/useGamification'
import { EmptyState } from '@/components/shared/EmptyState'

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('all_time')
  const { data, isLoading } = useLeaderboard(activeTab)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
      <p className="mb-6 text-muted-foreground">
        Top contributors ranked by XP, weekly activity, and cascade impact.
        Every redaction solved, every connection found, and every evidence chain built earns XP.
      </p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeaderboardType)}>
        <TabsList>
          <TabsTrigger value="all_time">All-Time</TabsTrigger>
          <TabsTrigger value="weekly">This Week</TabsTrigger>
          <TabsTrigger value="monthly">This Month</TabsTrigger>
          <TabsTrigger value="cascade_impact">Cascade Impact</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
              ))}
            </div>
          ) : data?.entries?.length > 0 ? (
            <Leaderboard
              entries={data.entries}
              currentUserRank={data.userRank}
              type={activeTab}
            />
          ) : (
            <EmptyState
              variant="not-processed"
              title="No Rankings Yet"
              description="Rankings will appear as contributors begin solving redactions and earning XP."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

#### Achievements Page — `app/(public)/achievements/page.tsx`

```tsx
// app/(public)/achievements/page.tsx
'use client'

import { AchievementGrid } from '@/components/gamification/AchievementGrid'
import { useAchievements } from '@/lib/hooks/useGamification'
import { EmptyState } from '@/components/shared/EmptyState'

export default function AchievementsPage() {
  const { data, isLoading } = useAchievements()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Achievements</h1>
      <p className="mb-6 text-muted-foreground">
        Earn badges by contributing to the investigation. From your first proposal
        to triggering massive cascade chains, every milestone is recognized.
      </p>

      {data?.summary && (
        <div className="mb-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-accent">{data.summary.earned}</div>
            <div className="text-xs text-muted-foreground">Earned</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.summary.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted-foreground">{data.summary.locked}</div>
            <div className="text-xs text-muted-foreground">Locked</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 animate-pulse rounded-full bg-surface" />
              <div className="h-3 w-12 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      ) : data?.achievements?.length > 0 ? (
        <AchievementGrid achievements={data.achievements} />
      ) : (
        <EmptyState
          variant="not-processed"
          title="Achievements Loading"
          description="Achievement definitions are being loaded. Sign in to start earning badges."
        />
      )}
    </div>
  )
}
```

### Step 15: Gamification Integration into Existing Pages

These updates add gamification elements into pages built in earlier phases. Each update is a targeted modification — not a full rewrite of the page.

#### Update `app/(public)/redactions/page.tsx` — XP previews on redaction cards

Add the following to each redaction card in the list:

```tsx
// Add to each redaction card's content area:
<div className="mt-2 flex items-center gap-2 text-xs text-green-400">
  <span>~{estimatedXP} XP</span>
  {cascadePotential > 0 && (
    <span className="text-muted-foreground">
      Could cascade to {cascadePotential} others
    </span>
  )}
</div>

// For the daily challenge redaction, add prominence:
{isDailyChallenge && (
  <Badge className="bg-amber-600 text-white">
    Daily Challenge: +50 XP bonus
  </Badge>
)}
```

#### Update `components/search/ResultCard.tsx` — Contributor attribution

Add below the result snippet when the result was unredacted by a user:

```tsx
// Add after the snippet/description area:
{result.unredactedBy && (
  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
    <span>Uncovered by</span>
    <Link href={`/profile/${result.unredactedBy.userId}`} className="text-blue-400 hover:underline">
      @{result.unredactedBy.displayName}
    </Link>
    {result.cascadeCount > 0 && (
      <span>(Cascade: {result.cascadeCount} solves)</span>
    )}
  </div>
)}
```

#### Update `components/document/RedactionHighlight.tsx` — Solved attribution

Update the tooltip content for solved redactions:

```tsx
// Replace the existing solved tooltip content with:
{isSolved ? (
  <div>
    <p>Solved{solvedBy ? ` by @${solvedBy}` : ''}</p>
    {solvedAt && <p className="text-[10px]">{new Date(solvedAt).toLocaleDateString()}</p>}
    {cascadeCount > 0 && (
      <p className="text-[10px] text-green-400">
        Triggered {cascadeCount} cascade matches
      </p>
    )}
  </div>
) : (
  <p>Redacted — Help solve this</p>
)}
```

#### Update `components/document/DocumentCompleteness.tsx` — XP for reviews

Add XP incentive text:

```tsx
// Add below the completeness checklist:
<p className="mt-3 text-xs text-green-400">
  Complete this review checklist to earn 10 XP per item checked.
</p>
```

#### Update `app/(auth)/profile/page.tsx` — Full gamification dashboard

Add the following sections to the profile page:

```tsx
// Import gamification components
import { UserScoreCard } from '@/components/gamification/UserScoreCard'
import { ContributionStreak } from '@/components/gamification/ContributionStreak'
import { AchievementGrid } from '@/components/gamification/AchievementGrid'
import { ImpactRipple } from '@/components/gamification/ImpactRipple'
import { useGamificationProfile, useStreak, useAchievements } from '@/lib/hooks/useGamification'

// Add these sections after the existing profile content:

{/* Gamification Dashboard */}
<section className="mt-8 space-y-6">
  <h2 className="text-2xl font-bold">Research Stats</h2>

  <div className="grid gap-6 md:grid-cols-2">
    {/* Score Card */}
    <UserScoreCard
      displayName={profile.display_name}
      avatarUrl={profile.avatar_url}
      level={gamificationData.profile.level}
      levelTitle={gamificationData.profile.levelTitle}
      xp={gamificationData.profile.xp}
      nextLevelXP={gamificationData.profile.nextLevelXP}
      progressPercent={gamificationData.profile.progressPercent}
      rank={null}
      currentStreak={gamificationData.profile.currentStreak}
    />

    {/* Streak Tracker */}
    <ContributionStreak
      currentStreak={streakData.currentStreak}
      longestStreak={streakData.longestStreak}
      streakActive={streakData.streakActive}
      contributedToday={streakData.contributedToday}
      streakBonusXP={streakData.streakBonusXP}
      weekHistory={streakData.weekHistory}
    />
  </div>

  {/* Achievement Grid (earned badges) */}
  <div>
    <h3 className="mb-4 text-xl font-semibold">Achievements</h3>
    <AchievementGrid achievements={achievementData.achievements} />
  </div>

  {/* Cascade Impact Visualization */}
  {cascadeStats.totalCascadesTriggered > 0 && (
    <div>
      <h3 className="mb-4 text-xl font-semibold">Your Cascade Impact</h3>
      <div className="flex items-center justify-center">
        <ImpactRipple
          totalSolves={cascadeStats.totalDownstreamSolves}
          maxDepth={3}
          rootSolvedByName={profile.display_name}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
        <div>
          <div className="font-bold">{cascadeStats.totalCascadesTriggered}</div>
          <div className="text-xs text-muted-foreground">Cascades Started</div>
        </div>
        <div>
          <div className="font-bold">{cascadeStats.totalDownstreamSolves}</div>
          <div className="text-xs text-muted-foreground">Downstream Solves</div>
        </div>
        <div>
          <div className="font-bold">{cascadeStats.largestChainSize}</div>
          <div className="text-xs text-muted-foreground">Largest Chain</div>
        </div>
      </div>
    </div>
  )}
</section>
```

#### Update `components/chat/ChatMessage.tsx` — Citation attribution

When citing an unredacted source, add contributor mention:

```tsx
// After the citation/source link:
{citation.unredactedBy && (
  <span className="ml-1 text-[10px] text-muted-foreground">
    (uncovered by @{citation.unredactedBy})
  </span>
)}
```

#### Update `app/(public)/bounties/page.tsx` — XP rewards on bounty cards

```tsx
// Add to each bounty card:
<div className="mt-2 flex items-center gap-2">
  <Badge variant="outline" className="text-green-400 border-green-400/30">
    +{bounty.xpReward} XP
  </Badge>
</div>
```

#### Update `components/annotations/AnnotationCard.tsx` — XP on upvotes

```tsx
// Add after the upvote count display:
{annotation.upvoteCount > 0 && annotation.upvoteCount % 5 === 0 && (
  <span className="text-[10px] text-green-400">+5 XP</span>
)}
```

#### Update `components/engagement/DailyChallenge.tsx` — XP bonus indicator

```tsx
// Add to the daily challenge card:
<div className="mt-2 rounded-md bg-amber-950/20 border border-amber-600/30 px-3 py-2">
  <p className="text-xs text-amber-400">
    Daily Challenge Bonus: +50 XP on top of normal solve rewards
  </p>
  {streakData.consecutiveDailyChallenges > 1 && (
    <p className="text-[10px] text-amber-300">
      {streakData.consecutiveDailyChallenges}-day challenge streak!
    </p>
  )}
</div>
```

### Step 16: XP Award Integration into Existing API Routes

Add `awardXP()` and `recordContribution()` calls to each existing contribution API route. These are targeted additions — not rewrites.

#### `app/api/redaction/[id]/propose/route.ts`

```ts
// Add at the top:
import { awardXP } from '@/lib/gamification/xp'
import { recordContribution } from '@/lib/gamification/streaks'
import { checkAchievements } from '@/lib/gamification/achievements'
import { incrementChallengeProgress } from '@/lib/gamification/challenges'

// Add after successful proposal insertion:
const streakResult = await recordContribution(user.id)
const xpResult = await awardXP({
  userId: user.id,
  action: 'submit_proposal',
  multiplier: evidenceQuality, // 1-3 based on evidence strength
  referenceId: proposal.id,
  referenceType: 'redaction_proposal',
})
await incrementChallengeProgress('proposals_submitted')

// After proposal is confirmed (in the confirmation handler):
await awardXP({
  userId: proposal.submitted_by,
  action: 'proposal_confirmed',
  referenceId: proposal.id,
  referenceType: 'redaction_proposal',
})
await incrementChallengeProgress('redactions_solved')
```

#### `app/api/redaction/[id]/vote/route.ts`

```ts
// Add after successful vote:
await recordContribution(user.id)
await awardXP({
  userId: user.id,
  action: 'vote_corroborate',
  referenceId: voteId,
  referenceType: 'proposal_vote',
})
```

#### `app/api/contribute/image-match/route.ts`

```ts
// Add after successful submission:
await recordContribution(user.id)
await awardXP({
  userId: user.id,
  action: 'submit_image_match',
  referenceId: match.id,
  referenceType: 'image_match',
})

// After confirmation:
await awardXP({
  userId: match.submitted_by,
  action: 'image_match_confirmed',
  multiplier: revealedEntitiesCount,
  referenceId: match.id,
  referenceType: 'image_match',
})
```

#### `app/api/contribute/intelligence/route.ts`

```ts
// Add after successful submission:
await recordContribution(user.id)
await awardXP({
  userId: user.id,
  action: 'submit_intelligence_hint',
  referenceId: hint.id,
  referenceType: 'intelligence_hint',
})

// After hint leads to solve:
await awardXP({
  userId: hint.submitted_by,
  action: 'hint_leads_to_solve',
  multiplier: matchedRedactionsCount,
  referenceId: hint.id,
  referenceType: 'intelligence_hint',
})
```

### Step 17: Verify build

```bash
pnpm build
```

Fix any TypeScript errors. The most common will be:

1. Missing imports for gamification types
2. Type mismatches between hook return data and component props
3. Missing shadcn/ui components (ensure `progress`, `avatar`, `tooltip` are installed)

---

## Gotchas

1. **XP transactions are the source of truth.** Never modify `user_profiles.xp` directly. Always create an `xp_transactions` record first, then update the profile total. This provides a complete audit trail and makes recalculation possible.

2. **Achievement checking must be efficient.** Do not check all 32 achievements on every single action. The `checkAchievements` function should only be called with the relevant context for the action type. Some achievements (Cascade Monarch, Most Wanted, Pattern Recognition) require expensive queries and should only be checked in periodic recalculation jobs, not on every request.

3. **Streak timezone handling.** Streaks use calendar days in UTC. A user in UTC-8 who contributes at 11pm their time (7am UTC next day) and then at 1am their time (9am UTC same day) would see inconsistent behavior if you use local time. Always use `startOfDay()` with UTC dates.

4. **Weekly leaderboard staleness.** The `weekly_leaderboard` materialized view is refreshed hourly. This means the weekly rankings can be up to 1 hour stale. This is acceptable for v1. The refresh is triggered by the admin API route or a cron job — it does not happen automatically.

5. **Level-up race condition.** If two XP awards happen concurrently for the same user, both might read the same `xp` value and one update could be lost. For v1, this is acceptable because the `xp_transactions` table has the real data and a recalculation job can fix discrepancies. For v2, use a Postgres function with `FOR UPDATE` row locking.

6. **Cascade chain depth performance.** Walking deep cascade trees can be expensive. The `getCascadeChain` function fetches all descendants in a single query using `root_redaction_id`, not recursive CTEs. If performance is an issue, pre-compute cascade stats in a materialized view.

7. **Social feed pagination.** The activity feed joins `xp_transactions` with `user_profiles` for all followed users. For users following many people, this query can be slow. For v1, limit to the most recent 30 items per page. For v2, consider a denormalized feed table.

8. **Achievement badge art.** For v1, achievements use emoji icons. Custom SVG badge art is deferred to v2. The `icon` field in the achievement definition can hold either an emoji string or an SVG path — components should handle both.

9. **Community challenge expiration.** Challenges that pass their `ends_at` date without being completed need a periodic job to mark them as `expired`. This is not handled automatically — add a check in the admin refresh-views cron job.

10. **Framer Motion bundle size.** Framer Motion adds ~30KB to the client bundle. All gamification components that use animations (`ImpactRipple`, `XPProgressBar`) are client components and should be lazy-loaded where possible using `next/dynamic`.

---

## Files to Create

```
lib/gamification/
├── xp.ts                          — XP calculation, awarding, history
├── streaks.ts                     — Streak tracking, contribution recording
├── achievements.ts                — Achievement definitions, checking, unlocking
├── cascades.ts                    — Cascade chain queries, impact stats
├── social.ts                      — Follow system, activity feed
├── challenges.ts                  — Community challenges
└── refresh-views.ts               — Materialized view refresh utilities
components/gamification/
├── XPProgressBar.tsx              — Animated XP bar with gain popup
├── UserScoreCard.tsx              — Compact user stats card (full + compact)
├── ContributionStreak.tsx         — 7-day streak calendar
├── AchievementBadge.tsx           — Single badge with tooltip
├── AchievementGrid.tsx            — Full grid with category sections
├── ImpactRipple.tsx               — Animated cascade visualization
├── Leaderboard.tsx                — Ranked user list with medals
├── CommunityChallengeCard.tsx     — Challenge progress card
└── ActivityFeedItem.tsx           — Social activity feed item
app/(public)/
├── leaderboard/
│   └── page.tsx                   — Leaderboard page with 4 tabs
└── achievements/
    └── page.tsx                   — All achievements grid page
app/api/gamification/
├── xp/
│   └── route.ts                   — XP profile + history
├── streaks/
│   └── route.ts                   — Streak info
├── achievements/
│   └── route.ts                   — Achievements list
├── leaderboard/
│   └── route.ts                   — Leaderboard queries
├── challenges/
│   └── route.ts                   — Community challenges
└── social/
    ├── follow/
    │   └── route.ts               — Follow / unfollow
    └── feed/
        └── route.ts               — Activity feed
app/api/admin/
└── refresh-views/
    └── route.ts                   — Manual materialized view refresh
lib/hooks/
└── useGamification.ts             — All gamification React hooks
scripts/
└── seed-achievements.ts           — Achievement seeding script
```

## Updates to Existing Files

```
app/(public)/redactions/page.tsx              — XP previews on redaction cards
components/search/ResultCard.tsx              — Contributor attribution
components/document/RedactionHighlight.tsx    — Solved-by tooltip with cascade info
components/document/DocumentCompleteness.tsx  — XP incentive text
app/(auth)/profile/page.tsx                   — Full gamification dashboard
components/chat/ChatMessage.tsx               — Citation contributor mentions
app/(public)/bounties/page.tsx                — XP rewards on bounty cards
components/annotations/AnnotationCard.tsx     — XP on upvote milestones
components/engagement/DailyChallenge.tsx      — XP bonus indicator
app/api/redaction/[id]/propose/route.ts       — XP awarding on submission
app/api/redaction/[id]/vote/route.ts          — XP awarding on vote
app/api/contribute/unredact/route.ts          — XP awarding
app/api/contribute/image-match/route.ts       — XP awarding
app/api/contribute/intelligence/route.ts      — XP awarding
```

## Acceptance Criteria

1. XP awarded correctly for each action type with proper multipliers (verified via XP transaction records)
2. Level calculated correctly from total XP (7 levels with correct thresholds: 0, 50, 250, 1000, 5000, 15000, 50000)
3. Streak increments on first daily contribution, resets on missed calendar day
4. Achievement seed script creates all 32 achievements (idempotent via upsert)
5. Achievements unlock automatically when conditions are met after each contribution
6. Leaderboard shows ranked users across all 4 tabs (all-time, weekly, monthly, cascade impact)
7. Achievement page shows earned badges (full color) and locked badges (grayed out) with category sections
8. XPProgressBar animates "+X XP" on recent gain with Framer Motion
9. ContributionStreak shows 7-day calendar with active day highlighting
10. Profile page shows full gamification dashboard (score card, streak, achievements, cascade impact)
11. Redaction cards show XP preview ("~150 XP") and cascade potential
12. Solved redactions in document viewer show contributor attribution with cascade count
13. Search results show contributor attribution on unredacted content
14. Community challenges show progress bars with target/current values
15. Activity feed shows actions from followed users with XP amounts
16. Follow/unfollow works via API and invalidates activity feed cache
17. Materialized view refresh works via admin API endpoint (protected by secret)
18. All gamification features degrade gracefully when user is not logged in (show public stats, hide personal data)
19. `pnpm build` succeeds with zero errors

## XP Award Table (Reference)

| Action | Base XP | Multiplier |
|---|---|---|
| Submit redaction proposal | 10 | x evidence quality (1-3x) |
| Proposal corroborated | 25 | x corroboration count |
| Proposal confirmed correct | 100 | x 1 |
| Cascade triggered (per downstream) | 50 | x cascade depth bonus |
| Submit image match | 15 | x 1 |
| Image match confirmed | 75 | x revealed entities |
| Submit intelligence hint | 10 | x 1 |
| Hint leads to confirmed solve | 150 | x redactions matched |
| Vote/corroborate | 5 | x 1 |
| Daily login streak | 5 | x streak length (max 30) |
| First contribution of day | 10 | x 1 |
| OCR correction approved | 15 | x 1 |
| Document review completed | 10 | x checklist items completed |
| Annotation upvoted (per 5 upvotes) | 5 | x 1 |
| Research bounty completed | varies | x bounty XP value |
| Guided investigation completed | 25 | x difficulty level |
| Photo identification confirmed | 20 | x people identified |
| Investigation thread followed by 10+ users | 15 | x 1 |
| Daily challenge solved | 50 | x 1 (bonus on top of normal solve XP) |
| Fact verified by community | 20 | x 1 |

## Level System (Reference)

| Level | Title | XP Required | Unlocks |
|---|---|---|---|
| 1 | Observer | 0 | Search, browse, vote |
| 2 | Contributor | 50 | Submit proposals |
| 3 | Investigator | 250 | Submit intel hints, priority review |
| 4 | Analyst | 1,000 | Image matching, bulk export |
| 5 | Senior Analyst | 5,000 | Weighted votes (2x), entity merges |
| 6 | Lead Investigator | 15,000 | Moderate proposals, flag spam |
| 7 | Chief Investigator | 50,000 | Admin dashboard, cascade tuning |

## Design Notes

- Level badge colors: Lv1=zinc, Lv2=blue, Lv3=green, Lv4=purple, Lv5=amber, Lv6=orange, Lv7=red
- Achievement rarity ring colors: common=zinc, uncommon=green, rare=blue, epic=purple, legendary=amber
- Earned achievements: full color with category-colored ring glow; locked achievements: grayscale with "?" overlay
- XP gain animation: green "+X XP" text that floats upward and fades out over 1.5s (Framer Motion)
- Impact ripple: concentric circles expanding outward from center with delay, red/accent colored
- Streak calendar: 7-day row of squares, active=green-500, inactive=surface-elevated
- Leaderboard medals: gold/silver/bronze emoji for ranks 1-3, numeric "#N" for rank 4+
- Current user highlighted in leaderboard with accent border glow
- Community challenge progress bars use the standard Progress component with percentage label
- Activity feed items use relative time ("2h ago", "3d ago") — not absolute timestamps
