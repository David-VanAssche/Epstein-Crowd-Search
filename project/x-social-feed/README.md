# Social Intelligence Feed — Plan

> **Status:** Plan only — not yet approved for implementation
> **Depends on:** Phase 0 data import (complete), pipeline stages operational (in progress)

## Motivation

The archive is a static corpus of DOJ documents, court records, and community-scraped data.
But the Epstein story is *alive* — journalists break revelations on X, researchers share
cross-references, victims' advocates post context, and official accounts announce new releases.

Social posts are the fastest public signal for:

1. **Redaction reveals** — "The name behind the bar on page 47 of the Maxwell deposition is ___"
2. **New document drops** — DOJ/court announcements, FOIA releases, leaked material
3. **Entity context** — Journalist threads connecting people to events, corrections, new testimony
4. **Document screenshots** — People photograph/scan pages and post them before official digital release
5. **Video testimony** — Interview clips, courtroom footage, victim statements, investigative reports

This plan describes two complementary ingestion channels:

- **Channel A: Server-side polling** — automated monitoring of known reputable accounts on X
- **Channel B: User submissions** — people forward posts from *any platform* to a tip line

Neither channel pollutes the primary document corpus or auto-confirms anything.

---

## Core Principle: Separation of Concerns

Social posts are **secondary signals**, not primary evidence. They never mix into the `documents` table.

| Layer | Primary Corpus | Social Signals |
|-------|---------------|----------------|
| Storage | `documents` table (1.38M rows) | `social_submissions` table (separate) |
| Weight | Probative weight 0.1–1.0 | Credibility score 0.0–1.0 (different scale) |
| Pipeline | Full 17-stage enrichment | Lightweight extraction (see below) |
| Trust | DOJ-sourced, court-filed | Unverified until corroborated |
| Display | First-class browse/search | Curated feed + signal badges |

---

## Channel A: Server-Side X Polling

### What it catches
- Text posts from reputable journalists/officials about Epstein developments
- Document screenshots posted by researchers
- Official DOJ/court announcements
- High-engagement threads from verified accounts

### What it misses
- Video content (X API cannot search by transcript)
- Content on Instagram, TikTok, Facebook, YouTube
- Posts from accounts not in the watchlist and below engagement thresholds
- Anything behind private/locked accounts

### Implementation
- X API v2 Basic tier (~$200/month), polling every 10 minutes
- Curated keyword query + account allowlist (see Watched Accounts below)
- Tracks `since_id` for incremental fetching
- Inserts into `social_submissions` with `source = 'x_poll'`

---

## Channel B: User Submissions (The Tip Line)

This is the more powerful channel. Instead of trying to programmatically find every
relevant post across every platform, let users — who are *already watching this content* —
be the filter.

### How It Works

Users can submit social media content through three methods:

#### Method 1: Paste a URL on the site (lowest friction)

On the `/intel` page, a prominent submission box:

```
┌──────────────────────────────────────────────────────────────┐
│  Submit a Tip                                                │
│                                                              │
│  Found something relevant? Paste the URL.                    │
│                                                              │
│  ┌────────────────────────────────────────────┐  [Submit]    │
│  │ https://x.com/journalist/status/123456...  │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  Supports: X/Twitter, Instagram, TikTok, YouTube,            │
│  Facebook, Reddit, Threads, or any public URL                │
│                                                              │
│  ┌─ Optional ──────────────────────────────────────────────┐ │
│  │ Why is this relevant? (helps us process faster)         │ │
│  │ ┌──────────────────────────────────────────────────┐    │ │
│  │ │ "This video names the person behind redaction on  │    │ │
│  │ │  page 47 of the Maxwell deposition"               │    │ │
│  │ └──────────────────────────────────────────────────┘    │ │
│  │                                                         │ │
│  │ Tags: [ ] Redaction claim  [ ] New document             │ │
│  │       [ ] Entity info      [ ] Official release         │ │
│  │       [ ] Interview/testimony                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Requires login (ties submission to user account for attribution + anti-spam)
- User gets XP credit for submissions that pass triage (ties into gamification)
- Optional context note + tags help the extraction pipeline but aren't required
- Dedup: if the same URL was already submitted, show "Already submitted — view it"

#### Method 2: Forward to a dedicated X account

A dedicated account (e.g., `@EpsteinArchiveTips`) that users can interact with:

- **@mention**: User tweets `@EpsteinArchiveTips check this` in a quote tweet or reply
- **DM**: User DMs a link directly to the account

The account monitors its mentions and DMs via X API (same Basic tier).
Extracts the referenced post URL, downloads content, inserts into `social_submissions`
with `source = 'x_forward'`.

The account can auto-reply with a link: "Thanks! Track this submission at
epsteinarchive.org/intel/submission/abc123"

#### Method 3: Email tip line

`tips@epsteinarchive.org` — a simple inbound email processor (Resend, Postmark, or
Cloudflare Email Workers) that:

1. Parses the email body for URLs
2. Downloads the content at those URLs
3. Inserts into `social_submissions` with `source = 'email_tip'`

This catches users who aren't on X or prefer email. Also useful for:
- Forwarding Instagram DMs (which have no public API)
- Sharing content from private groups or messaging apps
- Attaching PDFs/documents directly

### Platform-Specific URL Handling

When a URL is submitted, the backend resolves and extracts content differently per platform:

| Platform | Text | Images | Video | Method |
|----------|------|--------|-------|--------|
| X/Twitter | API fetch (if Basic tier) or scrape | API media expansion | Download mp4 variant | X API v2 or oembed fallback |
| Instagram | oembed → caption | oembed → thumbnail; full via scrape | Download (yt-dlp) | oembed API + yt-dlp |
| TikTok | oembed → description | Thumbnail | Download (yt-dlp) | oembed API + yt-dlp |
| YouTube | oembed → title + description | Thumbnails | Audio track only (Whisper) | oembed + yt-dlp |
| Facebook | oembed (limited) | oembed thumbnail | Download if public (yt-dlp) | oembed API |
| Reddit | JSON API (append .json) | Linked media | v.redd.it download | Reddit JSON API |
| Threads | oembed | oembed thumbnail | Not supported yet | oembed API |
| Generic URL | Fetch + readability extract | og:image | og:video if present | fetch + metadata |

**yt-dlp** handles video download from most platforms. Run server-side, never client-side.

### Video Processing Pipeline

This is where the user-submission model shines — it's the only way to get video content
into the system, since no API supports transcript-based search.

```
Video submitted via URL
  │
  ├─ Download via yt-dlp (mp4, max 720p to save storage)
  │
  ├─ Extract audio track (ffmpeg → wav/mp3)
  │
  ├─ Transcribe via Whisper (Fireworks.ai, ~$0.006/min)
  │   └─ Output: timestamped transcript
  │
  ├─ Frame extraction (1 frame per 10 seconds via ffmpeg)
  │   └─ Vision classifier: "Does this frame show a document page?"
  │       └─ If yes → OCR that frame
  │
  ├─ LLM claim extraction on transcript (same as text posts)
  │   └─ But with richer context — a 5-minute video interview
  │      yields far more claims than a 280-char tweet
  │
  ├─ Entity extraction on transcript
  │   └─ Match named entities to existing graph
  │
  └─ Store:
      - Video file → Supabase Storage: `social-media/videos/{id}.mp4`
      - Transcript → `social_submissions.transcript`
      - Frame OCR results → `social_submissions.media_ocr_results`
      - Claims → `social_submission_claims`
```

**Cost per video**: ~$0.04/min (Whisper) + ~$0.001/claim (LLM) + storage.
A 5-minute clip costs roughly $0.22 to fully process.

---

## Data Model

### `social_submissions` (replaces the earlier `x_posts` concept — platform-agnostic)

```sql
social_submissions
  id                  UUID PK DEFAULT gen_random_uuid()

  -- Source tracking
  source              TEXT NOT NULL     -- 'x_poll', 'x_forward', 'url_submit', 'email_tip'
  platform            TEXT              -- 'x', 'instagram', 'tiktok', 'youtube', 'facebook',
                                        -- 'reddit', 'threads', 'other'
  original_url        TEXT NOT NULL     -- Permalink to the original post
  original_url_hash   TEXT UNIQUE       -- SHA-256 of normalized URL (dedup key)

  -- Author info (from the original post, not the submitter)
  author_handle       TEXT
  author_name         TEXT
  author_verified     BOOLEAN
  author_platform_id  TEXT              -- Platform-specific user ID

  -- Content
  text_content        TEXT              -- Post text, caption, or description
  transcript          TEXT              -- Whisper transcript (for video/audio)
  media_urls          TEXT[]            -- Original media URLs
  media_types         TEXT[]            -- 'photo', 'video', 'audio', 'document_screenshot'
  stored_media_paths  TEXT[]            -- Paths in Supabase Storage after download
  media_ocr_results   JSONB            -- [{frame_index, ocr_text, matched_document_id}]

  -- Metadata from platform
  platform_metrics    JSONB             -- {likes, shares, views, comments} — schema varies by platform
  posted_at           TIMESTAMPTZ       -- When originally posted

  -- Who submitted it to us
  submitted_by        UUID FK → auth.users  -- NULL for server-side poll
  submitted_at        TIMESTAMPTZ DEFAULT now()
  submitter_note      TEXT              -- User's optional context: "This names the person on page 47"
  submitter_tags      TEXT[]            -- User-selected tags: 'redaction_claim', 'new_document', etc.

  -- Processing outputs
  credibility         REAL DEFAULT 0    -- 0.0–1.0 composite score
  signal_type         TEXT              -- 'redaction_claim', 'document_link', 'entity_context',
                                        -- 'official_release', 'interview', 'community_discussion', 'noise'
  processing_status   TEXT DEFAULT 'pending'  -- pending, downloading, transcribing, extracting,
                                              -- processed, failed, noise_filtered
  processing_error    TEXT

  -- Linking to archive
  linked_entity_ids   UUID[]
  linked_document_ids UUID[]
  linked_redaction_ids UUID[]

  -- Moderation
  hidden              BOOLEAN DEFAULT false
  hide_reason         TEXT

  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT now()
  updated_at          TIMESTAMPTZ DEFAULT now()
```

### `social_submission_claims`

```sql
social_submission_claims
  id                  UUID PK DEFAULT gen_random_uuid()
  submission_id       UUID FK → social_submissions ON DELETE CASCADE

  claim_type          TEXT NOT NULL     -- 'redaction_reveal', 'entity_connection', 'event_date',
                                        -- 'document_reference', 'new_evidence', 'correction',
                                        -- 'testimony_quote'
  claim_text          TEXT NOT NULL     -- The specific claim in natural language
  confidence          REAL DEFAULT 0    -- LLM-assessed 0.0–1.0
  timestamp_in_source TEXT              -- For video: "2:34" — where in the video this claim appears

  structured_data     JSONB             -- Type-specific payload:
                                        --   redaction_reveal: {document_ref, page, proposed_text, surrounding_context}
                                        --   entity_connection: {entity_a, entity_b, relationship, evidence}
                                        --   document_reference: {efta_number, filename, url}
                                        --   testimony_quote: {speaker, quote, context, timestamp}

  -- Linking
  matched_redaction_id UUID FK → redactions
  matched_entity_ids  UUID[]
  proposal_id         UUID FK → redaction_proposals  -- if this claim generated a proposal

  status              TEXT DEFAULT 'unverified'  -- unverified, corroborated, applied, rejected
  created_at          TIMESTAMPTZ DEFAULT now()
```

### `watched_accounts` (for Channel A polling + credibility scoring)

```sql
watched_accounts
  id                  UUID PK DEFAULT gen_random_uuid()
  platform            TEXT NOT NULL     -- 'x', 'instagram', 'youtube', etc.
  platform_user_id    TEXT              -- Platform-specific user ID
  handle              TEXT NOT NULL     -- @username or channel name
  display_name        TEXT
  category            TEXT NOT NULL     -- 'journalist', 'official', 'researcher',
                                        -- 'victim_advocate', 'legal', 'news_org', 'community'
  credibility_base    REAL DEFAULT 0.5  -- 0.0–1.0 base credibility score
  notes               TEXT              -- Why we watch this account
  active              BOOLEAN DEFAULT true
  created_at          TIMESTAMPTZ DEFAULT now()

  UNIQUE(platform, handle)
```

---

## Processing Pipeline (applies to both channels)

```
Submission arrives (URL or API-polled post)
  │
  ├─ Step 1: Dedup
  │   Hash the normalized URL. If exists → skip (or merge if new info).
  │
  ├─ Step 2: Content download
  │   Platform-specific fetch (see URL Handling table above).
  │   Download media to Supabase Storage: social-media/{platform}/{id}/
  │   For video: extract audio → Whisper transcription
  │   For images: vision classifier → OCR if document-like
  │
  ├─ Step 3: Triage (rules-based, instant, no LLM)
  │   Inputs: text, transcript, submitter_tags, author info, platform metrics
  │   Output: signal_type, initial credibility estimate
  │   Rules:
  │     - EFTA number or page reference in text → 'document_link'
  │     - "redacted"/"unredacted"/"name is"/"behind the bar" → 'redaction_claim'
  │     - From official DOJ/court account → 'official_release'
  │     - Video with transcript mentioning testimony/interview → 'interview'
  │     - Submitter tagged it → use their tags as initial signal_type
  │     - Nothing matches + low engagement + unknown author → 'noise'
  │
  ├─ Step 4: LLM claim extraction (skip for noise)
  │   Single LLM call (Qwen3-8B for text; Qwen3-235B for long transcripts)
  │   Extracts structured claims → social_submission_claims rows
  │   For video transcripts: includes timestamp references
  │
  ├─ Step 5: Entity + document linking
  │   Match mentioned names → entities table (via name_normalized)
  │   Match document references → documents table (via EFTA number, filename)
  │   Match redaction context → redactions table (via document + page + type)
  │
  ├─ Step 6: Credibility scoring
  │   Apply formula (see Credibility Scoring below)
  │   Factor in submitter reputation if user-submitted
  │
  └─ Step 7: Redaction bridge (if applicable)
      High-confidence redaction claims → create redaction_proposals
      Enter normal community voting flow
```

### What does NOT happen:
- No full 17-stage pipeline on social content
- No embeddings on post text (too short, too noisy)
- No chunking (posts and transcripts are processed whole)
- No relationship mapping (extracted claims are the structured output)
- No automatic confirmation of redactions — always goes through community votes

---

## Credibility Scoring

```
credibility = weighted_sum(
  0.25 × account_score,        -- watched_accounts.credibility_base, or:
                                --   0.2 for unknown verified, 0.05 for unknown unverified
  0.15 × engagement_score,     -- normalized: log(likes + 2*shares + 3*saves) / max_observed
  0.25 × entity_match_score,   -- fraction of mentioned names that resolve to our entity graph
  0.15 × document_match_score, -- 1.0 if references a real EFTA number/document, else 0.0
  0.10 × submitter_score,      -- if user-submitted: submitter's reputation_score from profile
                                --   (0.5 default, grows with accurate past submissions)
  0.10 × content_depth_score,  -- length + specificity: a 5-min video transcript with names
                                --   and dates scores higher than "Epstein is bad" tweet
)
```

Transparent, no ML. Admin can explain any score. Weights tunable.

---

## Redaction Bridge

When a claim with `claim_type = 'redaction_reveal'` matches an existing unsolved redaction:

1. Create a `redaction_proposal` with:
   - `evidence_type = 'media_report'` (existing enum value)
   - `evidence_sources = [submission.original_url]`
   - `evidence_description` = auto-generated from claim context
   - `user_id` = the submitter (if user-submitted) or system user (if polled)
2. The proposal enters the normal community voting flow
3. If the same claim appears from 3+ independent sources, auto-boost `composite_confidence`
   (but still requires community votes to confirm)
4. Cascade engine runs normally if/when the proposal is confirmed

This preserves the existing trust model. Social posts create *proposals*, never *confirmations*.

---

## UI/UX Design

### What Users See

#### A. "Live Intel" Sidebar Widget (global, all pages)

Small card in the sidebar (below the existing FundingSidebarWidget):

```
┌─────────────────────────────┐
│  Live Intel                 │
│                             │
│  3 new signals today        │
│  1 redaction claim pending  │
│                             │
│  Latest:                    │
│  @JulieKBrown · 2h · X     │
│  "New filing reveals..."    │
│  ─────────────────────────  │
│  View all →                 │
└─────────────────────────────┘
```

- Only shows posts with `credibility >= 0.6`
- Links to `/intel`
- Platform icon next to author handle

#### B. `/intel` Page — The Full Feed

New page under "Collaborate" in the sidebar:

```
Sidebar:
  Collaborate
    Redactions
    Contradictions
    Discoveries
    Pinboard
    Live Intel ← NEW
```

**Page layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Live Intel                                                      │
│  Real-time signals from journalists, researchers, and the        │
│  community about the Epstein files.                              │
│                                                                  │
│  ┌─ Submit a Tip ──────────────────────────────────────────────┐ │
│  │ ┌──────────────────────────────────────────┐  [Submit]      │ │
│  │ │ Paste any URL (X, Instagram, TikTok...)  │                │ │
│  │ └──────────────────────────────────────────┘                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [All] [Redaction Claims] [New Docs] [Interviews] [Official]     │
│                                                                  │
│  ┌─ Filters ───────────────────────────────────────────────────┐ │
│  │ Platform: [All ▾]  Confidence: [Medium+ ▾]  Period: [7d ▾] │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ── HIGH CONFIDENCE ──────────────────────────────────────────── │
│                                                                  │
│  ┌─ Signal Card ───────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  [X icon] Julie K. Brown @JulieKBrown · 2h   JOURNALIST    │ │
│  │                                                             │ │
│  │  "The redacted name on page 47 of the Maxwell deposition   │ │
│  │  has been confirmed by court records to be [Name]..."       │ │
│  │                                                             │ │
│  │  234 replies · 1.2K reposts · 5.4K likes                   │ │
│  │                                                             │ │
│  │  ┌─ Linked to Archive ─────────────────────────────────┐   │ │
│  │  │ Doc: Maxwell Deposition Vol. 3, p.47                │   │ │
│  │  │ Redaction: #R-4892 (unsolved, 12 potential cascades)│   │ │
│  │  │ Entity: [Name] (confidence: 0.87)                   │   │ │
│  │  │                                                     │   │ │
│  │  │ [View Document] [View Redaction] [Vote on Claim]    │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │  View original →                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Signal Card (Video) ──────────────────────────────────────┐ │
│  │                                                             │ │
│  │  [YT icon] 60 Minutes · 1d · YouTube          NEWS ORG     │ │
│  │                                                             │ │
│  │  "Former associate reveals details about financial..."      │ │
│  │                                                             │ │
│  │  ┌────────────────────────┐                                 │ │
│  │  │  ▶ [Video thumbnail]   │  5:23 duration                 │ │
│  │  │                        │  Transcript available           │ │
│  │  └────────────────────────┘                                 │ │
│  │                                                             │ │
│  │  3 claims extracted:                                        │ │
│  │  · Entity connection: [A] ↔ [B] via financial transfer     │ │
│  │    at 1:42 in video                                         │ │
│  │  · Testimony quote: "[Speaker] states under oath..."        │ │
│  │    at 3:15 in video                                         │ │
│  │  · Document reference: mentions EFTA01234567                │ │
│  │    at 4:01 in video                                         │ │
│  │                                                             │ │
│  │  ┌─ Linked to Archive ─────────────────────────────────┐   │ │
│  │  │ Entity A — 47 docs, risk 0.72                       │   │ │
│  │  │ Entity B — 12 docs, risk 0.45                       │   │ │
│  │  │ Doc: EFTA01234567 — Financial Record, Dataset 8     │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │  [Read Transcript] [View original →]                        │ │
│  │                                                             │ │
│  │  Submitted by @username · 12 submissions (89% useful)       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ── MEDIUM CONFIDENCE ────────────────────────────────────────── │
│                                                                  │
│  ┌─ Signal Card ───────────────────────────────────────────────┐ │
│  │  [IG icon] @investigator · 6h · Instagram       RESEARCHER │ │
│  │  "Look at this page from the black book — notice the..."    │ │
│  │  [Document screenshot detected — OCR matched to EFTA...]    │ │
│  │  [View Document] [View original →]                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ── COMMUNITY ────────────────────────────────────────────────── │
│                                                                  │
│  ┌─ Collapsed Card ───────────────────────────────────────────┐ │
│  │  [TT icon] @user · 8h · TikTok — "Thread about..." [+]    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─ Collapsed Card ───────────────────────────────────────────┐ │
│  │  [X icon] @user · 12h · X — "New connection between..." [+]│ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

Key UI details:
- **Video cards** show thumbnail + duration + "Transcript available" + timestamped claims
- **Platform icons** (X, Instagram, TikTok, YouTube, Reddit) so users know the source at a glance
- **User-submitted cards** show the submitter's track record ("12 submissions, 89% useful")
- **Claim timestamps** for video: "at 1:42 in video" so users can jump to the relevant moment
- **Grouped by confidence tier** with section headers, not just colored dots

#### C. Transcript Viewer (for video submissions)

When a user clicks "Read Transcript" on a video card:

```
┌──────────────────────────────────────────────────────────────┐
│  Transcript: "Former associate reveals details..."           │
│  Source: 60 Minutes · YouTube · 5:23                         │
│                                                              │
│  ┌─ Claims extracted (highlighted in transcript) ──────────┐ │
│  │  1:42  Entity connection (Entity A ↔ Entity B)          │ │
│  │  3:15  Testimony quote                                  │ │
│  │  4:01  Document reference (EFTA01234567)                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  [0:00] Host: Tonight we examine new evidence in the case    │
│  that has captivated the nation...                           │
│                                                              │
│  [0:15] Host: Our guest today worked directly with...        │
│                                                              │
│  [1:42] Guest: "What people don't understand is that         │
│  ██████████████████████████████████████████████████████████   │
│  [Entity A] transferred approximately $2.3 million through   │
│  a shell company directly to [Entity B]'s foundation..."     │
│  ██████████████████████████████████████████████████████████   │
│     ↳ CLAIM: Entity A → Entity B financial transfer          │
│       [View Entity A] [View Entity B]                        │
│                                                              │
│  [2:30] Host: And this was never disclosed?                  │
│                                                              │
│  [3:15] Guest: "No, and I want to be clear — under oath,     │
│  ██████████████████████████████████████████████████████████   │
│  [Speaker] stated that they had never met Epstein, which     │
│  directly contradicts the flight log from March 2004..."     │
│  ██████████████████████████████████████████████████████████   │
│     ↳ CLAIM: Testimony contradicts flight log                │
│       [View Flight Records] [View Contradictions]            │
│                                                              │
│  [4:01] Guest: "If you look at document EFTA01234567,        │
│  ██████████████████████████████████████████████████████████   │
│  page 3, you'll see the wire transfer receipt..."            │
│  ██████████████████████████████████████████████████████████   │
│     ↳ CLAIM: References EFTA01234567 p.3                     │
│       [View Document]                                        │
│                                                              │
│  [View original video →]                                     │
└──────────────────────────────────────────────────────────────┘
```

Claims are highlighted in the transcript with colored sidebars and inline links
to the archive. The timestamp is clickable (links to that point in the original video).

#### D. Signal Badges on Existing Pages

When social submissions link to entities/documents/redactions, show subtle badges:

**On entity dossier pages** (`/entity/[id]`):
```
3 recent signals  [View →]
```

**On document viewer** (`/document/[id]`):
```
2 signals reference this document  [View →]
```

**On redaction cards** (`/redactions`):
```
┌─ Solvable Redaction ──────────────────────────────┐
│ Maxwell Deposition, p.47 — ████████████ (name)    │
│ Potential cascades: 12                            │
│                                                   │
│ 1 external claim · @JulieKBrown · HIGH · X        │
│ [Propose Solution] [View Claims]                  │
└───────────────────────────────────────────────────┘
```

#### E. Submitter Reputation (ties into existing gamification)

Users who submit tips build a track record:

| Metric | How it's measured |
|--------|------------------|
| Total submissions | Count of their `social_submissions` rows |
| Useful rate | % of submissions with `processing_status = 'processed'` AND `credibility >= 0.4` |
| Claims generated | Count of `social_submission_claims` from their submissions |
| Proposals triggered | Count of `redaction_proposals` generated from their claims |
| Confirmations | Count of proposals that eventually got confirmed |

This feeds into the existing `user_profiles.reputation_score` and XP system.
High-reputation submitters get a `submitter_score` boost in credibility scoring,
creating a virtuous cycle: good submissions → more reputation → their future
submissions get higher initial credibility → faster processing.

### What Users DON'T See

| Hidden | Why |
|--------|-----|
| Submissions with `credibility < 0.3` | Noise — irrelevant or unverifiable |
| Submissions with `signal_type = 'noise'` | Triage rules filtered it |
| Submissions with `hidden = true` | Admin-flagged misinfo, spam, off-topic |
| Claims with `confidence < 0.2` | LLM couldn't extract anything meaningful |
| Failed video downloads/transcriptions | Only successful extractions surface |
| The credibility math | Users see confidence tiers, not numbers |
| Other users' pending submissions in queue | Only processed results shown |
| The polling infrastructure | Appears seamless — just "new signals" |
| Duplicate submission attempts | Silently merged to the existing entry |

### Confidence Tiers (User-Facing)

| Section Header | Criteria | Display |
|----------------|----------|---------|
| HIGH CONFIDENCE | credibility >= 0.7 AND (watched account OR 3+ corroborating sources) | Full card, expanded, highlighted claims |
| MEDIUM CONFIDENCE | credibility >= 0.4 AND (verified account OR engagement > threshold OR good submitter) | Full card, expanded |
| COMMUNITY | credibility >= 0.3 AND signal_type != 'noise' | Collapsed one-liner, click to expand |
| (Hidden) | credibility < 0.3 OR noise OR hidden | Not shown (admin panel only) |

---

## Watched Account Seed List

| Handle | Platform | Category | Base Credibility | Notes |
|--------|----------|----------|-----------------|-------|
| @JulieKBrown | X | Journalist | 0.9 | Miami Herald, broke the story |
| @MiamiHerald | X | News Org | 0.85 | Primary investigative outlet |
| @TheJusticeDept | X | Official | 0.95 | DOJ announcements |
| @SDNYnews | X | Official | 0.95 | Southern District of New York |
| @AP | X | News Org | 0.85 | Wire service |
| @Reuters | X | News Org | 0.85 | Wire service |
| @nytimes | X | News Org | 0.8 | Major developments |
| @washingtonpost | X | News Org | 0.8 | Major developments |
| @BBCNews | X | News Org | 0.8 | International coverage |
| @CNN | X | News Org | 0.75 | Major developments |

Start conservative (~10 accounts). Expand based on what surfaces — if an unknown account
consistently produces accurate claims that match our data, promote them to the watchlist.

Community can nominate accounts (future feature) with admin approval.

---

## What This System Does NOT Do

- **Does not auto-confirm redactions.** Social claims become proposals. Community votes confirm.
- **Does not ingest everything.** Quality over quantity — noise is filtered aggressively.
- **Does not replace primary sources.** A tweet or TikTok saying "the name is X" has zero
  probative weight. It's a *hint*, not *evidence*.
- **Does not show unfiltered social media.** Users see a curated, scored, archive-linked feed.
- **Does not track individual users.** We monitor public posts about a topic, not people.
- **Does not require social media accounts.** The feed is server-side. URL paste works for everyone.
- **Does not store raw video permanently for low-value submissions.** Noise-classified videos
  are deleted after 30 days; transcripts are kept. High-value videos are kept indefinitely.

---

## Anti-Spam / Anti-Abuse

| Vector | Mitigation |
|--------|-----------|
| URL spam (same user submits 100 garbage links) | Rate limit: 10 submissions/day per user. Drops to 3/day if useful rate < 20%. |
| Coordinated misinformation | Multi-source corroboration required for any redaction proposal. Single-source claims stay at LOW confidence. |
| Self-promotion (submitting own content) | No boost for self-submissions. Credibility based on content quality, not submitter. |
| NSFL/illegal content | Vision classifier screens images. Video thumbnails checked. Admin review queue for flagged content. |
| Bot/sockpuppet submissions | Require verified email + minimum account age (7 days) to submit. |
| Flooding the tip X account | Rate-limit DMs. Ignore mentions from accounts < 30 days old. |

---

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| X API Basic tier (Channel A polling) | ~$200 |
| LLM claim extraction (~300 text posts + ~50 transcripts/day) | ~$5 |
| Whisper transcription (~20 videos/day × avg 3 min) | ~$4 |
| Document AI OCR on screenshots (~30 images/day) | ~$2 |
| Video storage (~20 videos/day × avg 50MB, with 30-day cleanup) | ~$5 |
| yt-dlp compute (runs on same server) | ~$0 |
| **Total** | **~$216/month** |

---

## Implementation Phases (when approved)

### Phase A: Schema + URL Submission
- Migration: `social_submissions`, `social_submission_claims`, `watched_accounts`
- `/intel` page with URL paste submission form
- Basic URL resolution (oembed for metadata, no video download yet)
- Rules-based triage (no LLM)
- Admin view of raw submissions

### Phase B: X Polling + Claim Extraction
- X API v2 Basic tier integration
- Polling script (cron every 10 min)
- LLM claim extraction (Qwen3-8B)
- Entity/document/redaction linking
- Credibility scoring

### Phase C: Video Pipeline
- yt-dlp integration for video download
- Whisper transcription via Fireworks.ai
- Transcript viewer UI
- Timestamped claim extraction
- Frame OCR for document screenshots in videos

### Phase D: Full UI + Signals
- Signal cards with platform icons and confidence tiers
- Sidebar widget
- Signal badges on entity/document/redaction pages
- Submitter reputation integration

### Phase E: Redaction Bridge
- Auto-create redaction proposals from high-confidence claims
- Multi-source corroboration
- Cascade engine integration

### Phase F: Dedicated X Tip Account + Email
- @EpsteinArchiveTips account monitoring
- Email inbound processor (tips@epsteinarchive.org)
- Auto-reply with tracking links
