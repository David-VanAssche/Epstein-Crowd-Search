# Epstein Document Search Platform Analysis

**Date**: 2026-02-15
**Analyst**: Automated via Playwright screenshots + content extraction

---

## 1. EpsteinExposed.com

**Screenshot**: `screenshots/epsteinexposed.png`
**Title**: "Epstein Exposed - The Most Comprehensive Epstein Files Database"

### Stats
- 1,504 persons, 1,708 flights, 264,418 documents, 75 locations, 916 connections
- Claims 4 million viewers in a single week

### UI Layout
- **Navigation**: Top bar with Persons, Flights, Documents, Network, Connections, Emails, Dossiers, Book vs Flights, Contradictions
- **Hero**: Large search bar with category tabs (All, Persons, Flights, Documents, Locations)
- **Quick access pills**: Ghislaine Maxwell, Flight Logs, Unsealed Docs, Network Graph, "Surprise Me"
- **Stats dashboard**: 4 large stat cards (Persons, Flights, Documents, Locations, Connections)
- **Most Connected Persons**: Card grid ranked by connections, flights, and document appearances. Each person card shows source badges (Flight Logs, Black Book, Court Filing) with numeric counts
- **Key Documents section** with date, source, type

### Key Features
- **Network Graph**: Relationship mapping across 916 connections
- **Flight log integration**: Cross-referenced with persons
- **Black Book vs Flights**: Cross-referencing address book entries with flight records
- **Contradictions tracker**: Identifies conflicting information across documents
- **Dossiers**: Per-person comprehensive profiles
- **"Surprise Me" button**: Random discovery mechanic
- **Search authentication**: Sign in required for full access

### Innovative UX
- The "Book vs Flights" cross-reference feature is unique -- it lets users see who appeared in the address book but NOT in flight logs (and vice versa), highlighting gaps in the record
- "Contradictions" section is genuinely novel -- actively flags inconsistencies
- Person cards with multi-source badge system (Flight Logs, Black Book, Court Filing) with counts is very effective for showing data density
- "Surprise Me" for serendipitous discovery is clever engagement

---

## 2. EpsteinSuite.com

**Screenshot**: `screenshots/epsteinsuite.png`
**Title**: "Epstein Search - Epstein Suite"

### Stats
- 207,253 documents, 4,598 emails, 16,407 photos, 3,004 flights
- 31,665 entities, 188,587 PDFs

### UI Layout
- **Navigation sidebar**: EXPLORE, ANALYSIS, CONNECT, UPLOAD
- **Language selector**: 25+ languages supported
- **Hero search**: Large search bar with trending topics
- **Live processing banner**: "Processing ~3.5M newly released DOJ pages"
- **Content categories**: Documents, Emails, Photos, Flights, Black Book, Orders
- **News feed**: Curated relevant news articles with relevance scores (6/10, 7/10)
- **Most Viewed section**: Popular photos and documents with view counts
- **Recently Added Documents**: Chronological feed of new uploads
- **AI Chat interface**: Right-side AI assistant panel

### Key Features
- **AI Chat ("Ask Epstein AI")**: Natural language Q&A over the archive with suggested prompts
- **Six Degrees of Epstein**: Type two names, find connection paths through emails, flights, documents
- **Multi-language support**: 25+ languages for international accessibility
- **Live News Integration**: Curated news with relevance scoring
- **Photo archive**: 16,407 photos with view counts and browsing
- **Upload capability**: Community document submission
- **View counts on documents**: Social proof / popularity metrics
- **Trending topics**: Real-time trending search terms
- **Live Chat Room**: Community discussion feature

### Innovative UX
- "Six Degrees" connection finder is the standout feature -- lets users explore network paths between any two people, similar to Six Degrees of Kevin Bacon
- News relevance scoring (6/10, 7/10) helps researchers connect current events to archive documents
- The "Live Chat Room" for real-time community discussion while researching is unique
- Multi-language support opens the archive to international researchers
- Document upload feature enables crowdsourced archive expansion
- View counts create a popularity signal helping new researchers find important documents

---

## 3. EFTASearch.com

**Screenshot**: `screenshots/eftasearch.png`
**Title**: "Epstein Files Transparency Archive"

### Stats
- Not prominently displayed on landing page

### UI Layout
- **Minimal, clean design**: Search bar + suggested topics + tabs
- **Navigation tabs**: Search, Metrics, Feedback, Sign In
- **Suggested "DIVE IN" prompts**: Pre-built search queries for common topics
- **Very sparse, Google-like landing page**

### Key Features
- **Journalist-focused design**: Clean, no-nonsense interface
- **Pre-built search queries**: Curated starting points for research
  - "Trump relationship connections"
  - "Bill Clinton flights"
  - "victim witness testimony"
  - "Ghislaine Maxwell finding girls"
  - "Little St James island visitors"
  - "evidence that went missing"
- **Metrics dashboard** (behind tab)
- **Feedback mechanism** built in

### Innovative UX
- The minimalism is the feature -- it is clearly designed for journalists who want to search and get results without distraction
- Pre-built "DIVE IN" queries lower the barrier to entry for new researchers
- The queries are editorially curated to highlight the most important investigative angles
- Deliberately Google-like to feel familiar to non-technical users

---

## 4. Epstein-Files.org (Sifter Labs)

**Screenshot**: `screenshots/sifterlabs.png`
**Title**: "Epstein Document Search - Sifter Labs"

### Stats
- 59,369 documents (header), 33,891 processed with AI (body text)
- 188GB of document files

### UI Layout
- **Transition notice banner**: Prominently announces open-source transition
- **Navigation**: Search, FAQ, Home, Podcasts, Analytics, Theme toggle
- **Popular Searches section**: AI-summarized answers to common questions
- **Research disclaimer**: AI summaries require verification warning
- **About section**: Creator bio (Dr. Andrew Walsh, MD/PhD)
- **Support/donate CTA**

### Key Features
- **Semantic search**: AI-powered vector search over documents
- **AI Summaries**: Pre-generated answers to popular questions
- **Podcasts**: Audio content related to document analysis
- **Analytics dashboard**: Document processing statistics
- **Open-source transition**: Full code, data, database being released publicly
- **Research disclaimer**: Responsible disclosure about AI accuracy limits

### Innovative UX
- The open-source handoff plan is notable -- releasing complete source code, 188GB of document files, processed database with embeddings, and all processing scripts
- AI summaries for popular searches save researchers significant time
- Podcast integration brings the research to audio-first audiences
- The explicit disclaimer about AI summary limitations is responsible design
- Professional portfolio framing (Dr. Walsh) adds credibility

### Status Note
The site announced shutdown by Feb 15, 2025 (one year ago). The site was still serving content at time of capture, suggesting it found a maintainer or the deadline was extended.

---

## 5. EpsteinSecrets.com

**Screenshot**: `screenshots/epsteinsecrets.png`
**Title**: "Epstein Secrets: Search 33K+ Docs & 70K+ Names"

### Stats
- 33,682 documents, 89,660 pages, 70,236 unique entities, 273,976 entity mentions

### UI Layout
- **Dashboard-first design**: Stats cards at top (Documents, Pages, Entities, Mentions)
- **Left sidebar navigation**: Dashboard, Search, Network, People & Entities, Documents, Timeline, Reports
- **Quick Actions**: Search Documents, Browse Documents, View Network
- **Most Mentioned Entities table**: Ranked list with mention counts, entity type, and Wikipedia-sourced descriptions
- **Entity type filters**: All, People, Organizations, Locations
- **Sponsored ad placements** interspersed in entity list

### Key Features
- **Network visualization**: Entity relationship graph (5,500+ nodes mentioned in title)
- **Entity extraction at scale**: 70,236 unique entities automatically extracted
- **Entity typing**: Automatic classification into People, Organizations, Locations
- **Wikipedia integration**: Entity descriptions pulled from Wikipedia
- **Timeline view**: Chronological exploration of events
- **Reports**: Pre-built analytical reports
- **Mention counting**: Quantified importance metric per entity
- **Sign-in system**: User accounts

### Innovative UX
- The entity-first approach is distinctive -- rather than document-first search, this platform centers on *who* and *what* appears most often
- 70,236 entities is the largest entity extraction in this space
- Wikipedia descriptions for entities provide instant context
- The mention count as a ranking metric is simple but effective
- Timeline view enables chronological investigation
- Reports section suggests curated analytical outputs beyond raw search
- Entity type filtering (People/Organizations/Locations) enables focused exploration

### Concerns
- "SPONSORED" ad placements within the entity list may raise credibility questions for serious researchers

---

## 6. SearchTheFiles.com

**Screenshot**: NOT CAPTURED -- site is offline
**Status**: Connection refused (net::ERR_CONNECTION_CLOSED) as of 2026-02-15

### Expected Features (from description)
- Flight log focused search
- Address book / Black Book search
- Likely shut down or migrated

---

## Comparative Matrix

| Feature | EpsteinExposed | EpsteinSuite | EFTASearch | SifterLabs | EpsteinSecrets | SearchTheFiles |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Document count | 264K | 207K | ? | 59K | 33K | OFFLINE |
| Full-text search | Yes | Yes | Yes | Yes | Yes | - |
| AI chat/Q&A | No | Yes | No | No | No | - |
| AI summaries | No | No | No | Yes | No | - |
| Network graph | Yes | Yes (Six Degrees) | No | No | Yes (5,500 nodes) | - |
| Flight logs | 1,708 | 3,004 | ? | No | No | - |
| Entity extraction | 1,504 persons | 31,665 entities | ? | Yes | 70,236 entities | - |
| Photos/media | No | 16,407 photos | No | No | No | - |
| Timeline view | No | No | No | No | Yes | - |
| Multi-language | No | 25+ languages | No | No | No | - |
| News integration | No | Yes | No | No | No | - |
| Community upload | No | Yes | No | No | No | - |
| Open source | No | No | No | Yes (transitioning) | No | - |
| Mobile-friendly | Unknown | Unknown | Yes (minimal) | Unknown | Unknown | - |
| Ads/sponsored | No | No | No | No | Yes | - |

---

## Key Takeaways for EpsteinCrowdResearch

### Features to Emulate
1. **EpsteinExposed's "Contradictions" tracker** -- no other platform does this; flagging conflicting info across documents is high-value investigative tooling
2. **EpsteinSuite's "Six Degrees" connection finder** -- path-finding between two people through documents/flights/emails is extremely compelling
3. **EpsteinSuite's AI chat** -- natural language Q&A over the archive dramatically lowers the barrier to entry
4. **EFTASearch's minimalism** -- a clean, journalist-friendly interface as an alternative view
5. **EpsteinSecrets' entity-first approach** -- 70K entities with type classification and mention counts is a powerful research lens
6. **SifterLabs' open-source commitment** -- releasing embeddings and processing scripts enables community contribution

### Gaps We Can Fill
1. **No platform combines ALL features** -- network graph + AI chat + entity extraction + flight logs + photos in one place does not exist yet
2. **No platform has robust data provenance** -- where each document came from, chain of custody, verification status
3. **No platform has collaborative annotation** -- researchers cannot mark up, tag, or annotate documents for others
4. **No platform has citation export** -- generating proper citations for journalism or legal proceedings
5. **No platform has diff/change tracking** -- when new documents are released, what changed vs. previous releases
6. **No platform has victim-centered design** -- sensitivity to survivor experiences in how content is presented
7. **Cross-platform data reconciliation** -- different platforms have different document counts (33K to 264K), suggesting significant gaps in each

### Architecture Observations
- EpsteinExposed appears to be the most mature and feature-complete
- EpsteinSuite is the most innovative with AI features and community engagement
- EFTASearch is the most accessible for non-technical users
- SifterLabs pioneered the semantic search approach but may not survive
- EpsteinSecrets has the best entity extraction but monetizes with ads
- SearchTheFiles has already gone offline, demonstrating sustainability risk

