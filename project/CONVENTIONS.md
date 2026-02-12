# Coding Conventions

> **For all Claude agents working on this project.** Follow these conventions strictly for consistency across phases and sessions.

## Language & Runtime

- **TypeScript** everywhere — no plain JavaScript files
- **Strict mode** enabled (`"strict": true` in tsconfig)
- Target **ES2022** / module **ESNext**
- Node.js **20+** for batch scripts

## Package Management

- **pnpm** exclusively — never `npm install` or `yarn add`
- Lock file committed to repo (`pnpm-lock.yaml`)
- Use `pnpm add` for new deps, `pnpm add -D` for dev deps

## Framework Conventions

### Next.js (App Router)

- Use App Router (`app/` directory) — never Pages Router
- Route groups for auth boundaries: `(public)`, `(auth)`, `(researcher)`
- Server Components by default — only add `'use client'` when necessary (state, effects, browser APIs)
- Data fetching in Server Components with `fetch()` or Supabase server client
- Use `loading.tsx` files for Suspense boundaries
- Use `error.tsx` files for error boundaries
- Use `not-found.tsx` for 404 pages
- Metadata exported from `layout.tsx` or `page.tsx` via `generateMetadata()`

### File Naming

```
Components:    PascalCase.tsx     (Header.tsx, SearchBar.tsx)
Pages:         page.tsx           (always lowercase, Next.js convention)
Layouts:       layout.tsx
API routes:    route.ts
Libraries:     kebab-case.ts      (hybrid-search.ts, chat-service.ts)
Types:         kebab-case.ts      (search.ts, entities.ts)
Hooks:         camelCase.ts       (useSearch.ts, useChat.ts)
Scripts:       kebab-case.ts|.sh  (seed-sample-data.ts, download-datasets.sh)
Migrations:    NNNNN_name.sql     (00001_extensions.sql)
Tests:         *.test.ts(x)       (citations.test.ts, SearchBar.test.tsx)
```

### Component Structure

```tsx
// 1. Imports (external → internal → relative → types)
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchBar } from './SearchBar'
import type { SearchResult } from '@/types/search'

// 2. Types/interfaces (if component-local)
interface Props {
  query: string
  onSearch: (q: string) => void
}

// 3. Component (named export preferred for pages, default for components)
export function SearchPage({ query, onSearch }: Props) {
  // hooks first
  // derived state
  // event handlers
  // render
}
```

### Import Aliases

```
@/components/*     → components/*
@/lib/*            → lib/*
@/types/*          → types/*
@/hooks/*          → lib/hooks/*
```

## Styling

### Tailwind CSS

- Use Tailwind utility classes — no raw CSS except in `globals.css` for CSS variables
- Follow the design system tokens defined in `tailwind.config.ts`
- Responsive: mobile-first (`sm:`, `md:`, `lg:`, `xl:`)
- Dark theme tokens via CSS variables (no `dark:` prefix — it's always dark)

### CSS Variable Pattern

```css
/* globals.css */
:root {
  --background: 240 10% 4%;      /* #0a0a0f */
  --surface: 240 10% 8%;         /* #12121a */
  --surface-elevated: 240 15% 14%; /* #1a1a2e */
  --border: 240 15% 20%;         /* #2a2a3e */
  /* ... etc */
}
```

### shadcn/ui

- Install components via `pnpm dlx shadcn-ui@latest add <component>`
- Components live in `components/ui/`
- Customize theme via CSS variables, not component modifications
- Preferred components: Button, Card, Input, Badge, Tabs, Dialog, Sheet, Select, Dropdown, Tooltip, Skeleton

## State Management

### Client State

- **React Query** (`@tanstack/react-query`) for server state (API calls, caching)
- **useState/useReducer** for local component state
- **URL search params** for filter/search state (shareable URLs)
- No Redux or Zustand — keep it simple

### React Query Conventions

```tsx
// Query keys follow [scope, ...params] pattern
const queryKey = ['search', { query, filters }]
const queryKey = ['entity', entityId]
const queryKey = ['redactions', 'solvable', { page }]

// Hooks live in lib/hooks/
export function useSearch(query: string, filters: SearchFilters) {
  return useQuery({
    queryKey: ['search', { query, filters }],
    queryFn: () => searchAPI(query, filters),
    enabled: !!query,
  })
}
```

## API Routes

### Request/Response Pattern

```tsx
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({ /* ... */ }).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = searchSchema.parse(body)
    // ... logic
    return NextResponse.json({ data, meta: { page, total } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Response Shapes

```tsx
// Success
{ data: T, meta?: { page: number, total: number, hasMore: boolean } }

// Error
{ error: string, details?: unknown }

// Streaming (SSE for chat)
// Each line: data: { type: 'token' | 'citation' | 'done', content: string }
```

## Validation

- **Zod** for all runtime validation (API inputs, form data, env vars)
- Define schemas alongside types — derive TypeScript types from Zod schemas
- Validate at system boundaries (API routes, form submissions, env loading)

```tsx
// types/search.ts
import { z } from 'zod'

export const searchRequestSchema = z.object({ /* ... */ })
export type SearchRequest = z.infer<typeof searchRequestSchema>
```

## Error Handling

- Use `ErrorBoundary` component for React component errors
- API routes return structured JSON errors with appropriate HTTP status codes
- Log errors server-side but never expose stack traces to clients
- Supabase errors: check `.error` property, handle gracefully
- Network errors: show user-friendly messages with retry options

## Supabase Conventions

### Client Usage

```tsx
// Browser (client components)
import { createClient } from '@/lib/supabase/client'

// Server components / route handlers
import { createClient } from '@/lib/supabase/server'

// Admin operations (batch scripts, API routes needing service role)
import { createAdminClient } from '@/lib/supabase/admin'
```

### Query Pattern

```tsx
const { data, error } = await supabase
  .from('documents')
  .select('id, filename, classification')
  .eq('dataset_id', datasetId)
  .order('created_at', { ascending: false })
  .range(0, 19)

if (error) throw error
```

## AI Provider Abstraction

See `project/AI_PROVIDER_INTERFACES.md` for detailed interface designs.

Key rule: **Never import a specific AI provider directly in components or API routes.** Always use the factory:

```tsx
// GOOD
import { getEmbeddingProvider } from '@/lib/ai/factory'
const embedder = getEmbeddingProvider()

// BAD
import { GoogleVertexEmbedder } from '@/lib/ai/providers/google-vertex'
```

## Testing

- **Vitest** for unit tests
- **React Testing Library** for component tests
- Test files co-located or in `__tests__/` directories
- Focus on: utility functions, API response shapes, component rendering
- Mock Supabase client in tests

## Git Conventions

### Commit Messages

```
type: short description

Longer explanation if needed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`

### Branch Strategy

- `main` — production-ready code
- `phase-NN-description` — feature branches per phase
- PRs into `main` after phase completion

## Checklist Conventions

When working on phase files:

```markdown
- [ ] Uncompleted item
- [x] Completed item
<!-- NOTE: Deferred because X --> — when something can't be finished
<!-- TODO: Needs Y --> — when something needs follow-up
```

## Performance Guidelines

- Use `React.lazy()` + `Suspense` for heavy components (graph, timeline)
- Use Next.js `Image` component for all images
- Use `loading.tsx` files for route-level loading states
- Keep bundle sizes small — dynamic imports for D3, Framer Motion
- Use React Query `staleTime` and `cacheTime` for appropriate caching
- Paginate all list endpoints (default 20 items)

## Accessibility Baseline

- Semantic HTML elements (`nav`, `main`, `article`, `section`)
- ARIA labels on interactive elements
- Keyboard navigation for all interactive components
- Focus management in modals and slide-outs
- Color contrast meeting WCAG AA on dark background
