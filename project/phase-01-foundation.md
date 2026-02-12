# Phase 1: Foundation

> **Sessions:** 1 | **Dependencies:** None | **Parallel with:** Nothing (must be first)

## Summary

Bootstrap the Next.js application with all dependencies, dark theme design system, root layout, shared components, CI/CD, and the `project/` planning directory. This is the scaffold everything else builds on.

## Checklist

### Project Initialization

- [ ] Run `pnpm create next-app` with TypeScript, Tailwind, App Router, src=no, import-alias=@/*
- [ ] Verify `pnpm dev` starts successfully
- [ ] Configure `tsconfig.json` (strict mode, path aliases)
- [ ] Configure `next.config.js` (images domains, experimental features)
- [ ] Configure `postcss.config.js`

### Dependencies

- [ ] Install core deps: `@supabase/supabase-js`, `@supabase/ssr`
- [ ] Install UI deps: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- [ ] Install shadcn/ui: `pnpm dlx shadcn-ui@latest init` (New York style, zinc, CSS variables)
- [ ] Install data deps: `@tanstack/react-query`, `zod`
- [ ] Install animation deps: `framer-motion`
- [ ] Install visualization deps: `d3`, `@types/d3`
- [ ] Install dev deps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`

### shadcn/ui Components

- [ ] Button
- [ ] Card (Card, CardHeader, CardTitle, CardContent, CardFooter)
- [ ] Input
- [ ] Badge
- [ ] Tabs (Tabs, TabsList, TabsTrigger, TabsContent)
- [ ] Dialog
- [ ] Sheet (for slide-out panels)
- [ ] Select
- [ ] Dropdown Menu
- [ ] Tooltip
- [ ] Skeleton
- [ ] Separator
- [ ] ScrollArea
- [ ] Avatar
- [ ] Progress
- [ ] Textarea

### Design System

- [ ] `tailwind.config.ts` — extend with custom colors, fonts, spacing
  - Colors: background, surface, surface-elevated, border, border-accent, text-primary, text-secondary, text-muted, accent, accent-hover, accent-muted, info, success, warning, code-document
  - Fonts: Inter (sans), JetBrains Mono (mono)
  - Max-width: 1400px content width
- [ ] `app/globals.css` — CSS variables for all theme tokens
  - HSL color variables matching Tailwind config
  - Font imports (Inter, JetBrains Mono via Google Fonts or next/font)
  - Base styles (html, body: dark background, text color)
  - Scrollbar styling (thin, dark)
  - Selection color (accent)

### Root Layout

- [ ] `app/layout.tsx` — Root layout
  - Dark theme `<html>` with `className="dark"`
  - Font loading (Inter + JetBrains Mono via `next/font/google`)
  - `<Header />` component
  - `<main>` content area
  - `<Footer />` component
  - React Query provider wrapper
  - Metadata (title, description, OG tags with placeholder image)

### Layout Components

- [ ] `components/layout/Header.tsx`
  - Logo/brand ("The Epstein Archive")
  - Navigation links (Search, Entities, Graph, Timeline, Redactions, Datasets)
  - Mini search bar (routes to /search)
  - Auth button (Login / user avatar)
  - Mobile hamburger menu
  - Subtle funding banner ("XX% processed — [Support →]")
- [ ] `components/layout/Footer.tsx`
  - About link, GitHub repo link, GoFundMe link (placeholder URL)
  - MIT license notice
  - "Source code" link
  - Processing progress indicator
- [ ] `components/layout/Sidebar.tsx`
  - 280px collapsible panel
  - Used by search page for filters
  - Mobile: full-screen overlay

### Shared Components

- [ ] `components/shared/EmptyState.tsx`
  - Icon, title, description, optional CTA button
  - Variants: "not yet processed", "no results", "coming soon"
  - Funding CTA option ("Help us process more →")
- [ ] `components/shared/LoadingState.tsx`
  - Skeleton loader variants (card, list, page)
  - Consistent animation timing
- [ ] `components/shared/ErrorBoundary.tsx`
  - React error boundary wrapper
  - Fallback UI with retry button
  - Error logging (console for now)

### Configuration Files

- [ ] `.env.example` — all env vars documented with descriptions
- [ ] `.gitignore` — Node, Next.js, env, OS files, .vercel
- [ ] `CLAUDE.md` — project instructions for Claude Code agents
- [ ] `CONTRIBUTING.md` — contribution guidelines
- [ ] `LICENSE` — MIT license text

### CI/CD

- [ ] `.github/workflows/ci.yml`
  - Trigger: push to main, PRs
  - Steps: checkout, pnpm install, TypeScript check, lint, test
- [ ] `.github/workflows/deploy.yml`
  - Trigger: push to main
  - Steps: Vercel preview (PR) / production (main) deploy
- [ ] `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] `.github/ISSUE_TEMPLATE/feature_request.md`

### Project Planning (this phase creates these)

- [ ] `project/MASTER_PLAN.md`
- [ ] `project/CONVENTIONS.md`
- [ ] `project/AI_PROVIDER_INTERFACES.md`
- [ ] `project/phase-01-foundation.md` through `project/phase-10-gamification.md`

## Files to Create

```
app/
├── layout.tsx
├── page.tsx              (minimal — "Coming soon" or redirect, built properly in Phase 3)
├── globals.css
components/
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── Sidebar.tsx
├── shared/
│   ├── EmptyState.tsx
│   ├── LoadingState.tsx
│   └── ErrorBoundary.tsx
├── ui/                   (shadcn/ui auto-generated — ~15 components)
.github/
├── workflows/
│   ├── ci.yml
│   └── deploy.yml
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   └── feature_request.md
project/
├── MASTER_PLAN.md
├── CONVENTIONS.md
├── AI_PROVIDER_INTERFACES.md
├── phase-01-foundation.md ... phase-10-gamification.md
.env.example
.gitignore
CLAUDE.md
CONTRIBUTING.md
LICENSE
tailwind.config.ts
next.config.js
postcss.config.js
tsconfig.json
package.json
```

## Acceptance Criteria

1. `pnpm dev` starts and renders a dark-themed page with Header and Footer
2. `pnpm build` completes with zero errors
3. All shadcn/ui components importable without errors
4. Design system colors render correctly (background #0a0a0f, accent red)
5. Header navigation links are visible (even if pages don't exist yet)
6. Footer shows GitHub and GoFundMe placeholder links
7. EmptyState, LoadingState, and ErrorBoundary render properly
8. Mobile hamburger menu toggles on small screens
9. All project/ planning files exist and are well-structured
10. CI workflow file is valid YAML
