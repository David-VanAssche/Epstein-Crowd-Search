# Phase 9: Polish & Deploy

> **Sessions:** 1-2 | **Dependencies:** Phases 1-8 (all features complete) | **Parallel with:** Nothing (comes after all features)

## Summary

Final polish pass: mobile responsive audit, performance optimization, SEO, documentation, deployment configuration, and testing. This phase makes the project production-ready and deployable.

## Checklist

### Mobile Responsive Audit

- [ ] Audit all pages at 320px, 375px, 414px, 768px breakpoints
- [ ] `app/page.tsx` (home) — hero stacks, search bar full width, stats 1-col
- [ ] `app/(public)/search/page.tsx` — sidebar becomes overlay/sheet, results stack
- [ ] `app/(public)/document/[id]/page.tsx` — metadata below viewer, chunk nav collapses
- [ ] `app/(public)/entity/[id]/page.tsx` — tabs stack, connections list instead of mini graph
- [ ] `app/(public)/entities/page.tsx` — grid 1 col, filters collapse
- [ ] `app/(public)/graph/page.tsx` — controls overlay simplified, pinch zoom
- [ ] `app/(public)/timeline/page.tsx` — single column, events full width
- [ ] `app/(public)/redactions/page.tsx` — stats stack, feed full width
- [ ] `app/(public)/funding/page.tsx` — tier cards 1-2 cols, slider full width
- [ ] `app/(public)/stats/page.tsx` — stat cards stack, progress bars full width
- [ ] `app/(auth)/contribute/page.tsx` — 2×2 grid becomes 1-col stack
- [ ] `app/(auth)/profile/page.tsx` — stats stack, contribution list full width
- [ ] `components/chat/ChatPanel.tsx` — full screen on mobile (not 400px)
- [ ] `components/layout/Header.tsx` — hamburger menu works correctly
- [ ] `components/layout/Sidebar.tsx` — full-screen overlay on mobile

### Performance Optimization

- [ ] Add `loading.tsx` files for all route segments
  - `app/(public)/graph/loading.tsx`
  - `app/(public)/timeline/loading.tsx`
  - `app/(public)/funding/loading.tsx`
  - `app/(public)/stats/loading.tsx`
  - `app/(public)/redactions/loading.tsx`
  - `app/(public)/datasets/loading.tsx`
  - `app/(public)/about/loading.tsx`
  - `app/(public)/cascade/[id]/loading.tsx`
  - `app/(auth)/contribute/loading.tsx`
  - `app/(auth)/proposals/loading.tsx`
  - `app/(auth)/profile/loading.tsx`
  - `app/(auth)/saved/loading.tsx`

- [ ] Lazy loading for heavy components
  - `React.lazy()` for RelationshipGraph (D3)
  - `React.lazy()` for CascadeReplay (Framer Motion + D3)
  - `React.lazy()` for TimelineView (if large)
  - `React.lazy()` for DonationImpactCalc (slider + animation)

- [ ] Next.js Image optimization
  - All images use `next/image` with proper width/height
  - Placeholder blur for images
  - Priority loading for above-the-fold images

- [ ] Bundle analysis
  - Run `pnpm build` and check bundle sizes
  - Ensure D3, Framer Motion are tree-shaken / code-split
  - No duplicate dependencies

### SEO

- [ ] `app/layout.tsx` — Root metadata
  - Title template: "%s | The Epstein Archive"
  - Default description, keywords
  - OG image (placeholder)
  - Twitter card metadata

- [ ] Per-page metadata via `generateMetadata()`:
  - Home: "3.5 Million Pages of Truth. Now Searchable."
  - Search: "Search the Epstein Files"
  - Entity: "{Entity Name} — The Epstein Archive"
  - Document: "{Document Name} — The Epstein Archive"
  - Graph: "Entity Relationship Map — The Epstein Archive"
  - Timeline: "Timeline — The Epstein Archive"
  - Cascade: "Impact: {count} connections unlocked — The Epstein Archive"

- [ ] `app/sitemap.ts` — Dynamic sitemap generation
  - Static pages: home, search, entities, graph, timeline, about, funding, stats
  - Dynamic pages: entity/[id], document/[id] (from database)

- [ ] `app/robots.ts` — Robots.txt
  - Allow all crawling
  - Sitemap URL
  - Disallow: /api/, /auth/

- [ ] JSON-LD structured data
  - WebSite schema on home page
  - Dataset schema on datasets page
  - Person schema on entity pages (type=person)

### Documentation

- [ ] `README.md` — Complete project overview
  - Project description and mission
  - Screenshots/GIFs (placeholder paths)
  - Quick start guide (clone, install, env setup, dev)
  - Tech stack summary
  - Architecture overview
  - Contributing link
  - License

- [ ] Update `CLAUDE.md` — Final project instructions
  - Updated directory structure
  - Key file locations
  - Development workflow
  - Testing commands
  - Deployment process
  - Common patterns

- [ ] `CONTRIBUTING.md` — Update with final guidelines
  - Development setup
  - Code style guide (link to CONVENTIONS.md)
  - PR process
  - Phase checklist workflow

### Deployment Configuration

- [ ] `vercel.json` — Vercel deployment config
  - Build command: `pnpm build`
  - Output directory: `.next`
  - Environment variables reference
  - Rewrites/redirects if needed
  - Function timeout configuration

- [ ] `worker/Dockerfile` — Worker container
  - Node.js 20 base image
  - Copy package files, install deps
  - Copy source, build
  - Health check
  - CMD for production start

- [ ] `worker/cloudbuild.yaml` or `worker/deploy.sh` — Cloud Run deploy script
  - Build container image
  - Push to Container Registry
  - Deploy to Cloud Run
  - Set environment variables
  - Configure health check

- [ ] `docker-compose.yml` (optional) — Local development with Redis
  - Redis service
  - Worker service
  - Network configuration

### Testing

#### Unit Tests

- [ ] `lib/utils/__tests__/citations.test.ts` — Citation formatting
  - Test citation string formatting
  - Test citation parsing from text
  - Test edge cases (missing page numbers, long doc names)

- [ ] `lib/utils/__tests__/dates.test.ts` — Date utilities
  - Test various date formats
  - Test precision levels
  - Test date range formatting

- [ ] `lib/search/__tests__/hybrid-search.test.ts` — Search wrapper
  - Test query construction
  - Test filter application
  - Test response mapping

- [ ] `lib/ai/__tests__/factory.test.ts` — Provider factory
  - Test default providers
  - Test env var overrides
  - Test unknown provider error

#### Component Tests

- [ ] `components/shared/__tests__/EmptyState.test.tsx` — EmptyState rendering
- [ ] `components/shared/__tests__/LoadingState.test.tsx` — LoadingState rendering
- [ ] `components/search/__tests__/SearchBar.test.tsx` — Search input behavior
- [ ] `components/chat/__tests__/ChatMessage.test.tsx` — Message rendering

#### Test Configuration

- [ ] `vitest.config.ts` — Vitest configuration
  - React testing setup
  - Path aliases
  - Coverage configuration

- [ ] `vitest.setup.ts` — Test setup file
  - Testing library matchers
  - Mock Supabase client
  - Mock Next.js navigation

### Final Checks

- [ ] `pnpm build` completes with zero errors
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no lint errors
- [ ] TypeScript strict mode passes
- [ ] No unused imports or variables
- [ ] No `console.log` in production code (only `console.error` for actual errors)
- [ ] All env vars documented in `.env.example`
- [ ] All placeholder URLs are clearly marked with `TODO:` comments

## Files to Create

```
app/
├── sitemap.ts
├── robots.ts
├── (public)/graph/loading.tsx
├── (public)/timeline/loading.tsx
├── (public)/funding/loading.tsx
├── (public)/stats/loading.tsx
├── (public)/redactions/loading.tsx
├── (public)/datasets/loading.tsx
├── (public)/about/loading.tsx
├── (public)/cascade/[id]/loading.tsx
├── (auth)/contribute/loading.tsx
├── (auth)/proposals/loading.tsx
├── (auth)/profile/loading.tsx
└── (auth)/saved/loading.tsx
lib/utils/__tests__/
├── citations.test.ts
└── dates.test.ts
lib/search/__tests__/
└── hybrid-search.test.ts
lib/ai/__tests__/
└── factory.test.ts
components/shared/__tests__/
├── EmptyState.test.tsx
└── LoadingState.test.tsx
components/search/__tests__/
└── SearchBar.test.tsx
components/chat/__tests__/
└── ChatMessage.test.tsx
vitest.config.ts
vitest.setup.ts
vercel.json
worker/
├── Dockerfile
└── deploy.sh
README.md            (update)
CLAUDE.md            (update)
CONTRIBUTING.md      (update)
```

## Acceptance Criteria

1. `pnpm build` completes with zero errors and zero warnings
2. `pnpm test` — all unit tests pass
3. `pnpm lint` — no lint errors
4. All pages render correctly at 320px mobile width
5. Chat panel goes full-screen on mobile
6. Header hamburger menu works on mobile
7. D3 graph and Framer Motion cascade are lazy-loaded (not in initial bundle)
8. All pages have appropriate metadata (title, description, OG tags)
9. `sitemap.ts` generates valid XML sitemap
10. `robots.ts` generates valid robots.txt
11. README has clear setup instructions
12. Worker Dockerfile builds successfully
13. Vercel config is valid
14. No `console.log` statements in production code
15. All loading.tsx files show appropriate skeletons

## Notes

- Mobile audit should be done visually in browser DevTools
- Bundle analysis: use `@next/bundle-analyzer` if needed
- Deployment: Vercel deploys automatically from git push, Cloud Run needs manual deploy
- Tests focus on utilities and basic component rendering — not full integration tests
- SEO: OG image should be a real image file (create a simple dark-themed placeholder in public/)
