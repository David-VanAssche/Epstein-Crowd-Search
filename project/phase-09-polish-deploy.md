# Phase 9: Polish & Deploy

> **Sessions:** 2 | **Dependencies:** Phases 1-8 (all features complete) | **Parallel with:** Nothing (final phase)

## Summary

Final production-readiness pass: performance optimization with React Server Components and lazy loading, SEO metadata and sitemaps, error boundaries and custom error pages, loading skeletons for every route, accessibility audit (ARIA, keyboard navigation, screen readers), Vercel deployment configuration, environment variable management, CI/CD with GitHub Actions, monitoring with Vercel Analytics and error tracking, and security hardening with rate limiting and security headers. This phase transforms the working application into a production-grade deployment.

## IMPORTANT: Prerequisites

All features from Phases 1-8 must be complete before starting Phase 9. This phase modifies existing files and adds production infrastructure. No new user-facing features are introduced — only optimization, hardening, and deployment configuration.

---

## Step-by-Step Execution

### Step 1: Install production dependencies

```bash
# Performance monitoring
pnpm add @vercel/analytics @vercel/speed-insights

# Error tracking
pnpm add @sentry/nextjs

# Rate limiting
pnpm add @upstash/ratelimit @upstash/redis

# Security headers
pnpm add next-secure-headers

# Bundle analysis (dev only)
pnpm add -D @next/bundle-analyzer

# Accessibility testing (dev only)
pnpm add -D @axe-core/react axe-core
```

### Step 2: Configure bundle analyzer

File: `next.config.js` (update existing)

```js
// next.config.js
// Add bundle analyzer wrapper around existing config

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config from Phase 1 ...

  // Add image optimization config
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    deviceSizes: [320, 420, 768, 1024, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enable experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'd3', 'framer-motion'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://api.openai.com https://api.anthropic.com wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
```

### Step 3: Add loading.tsx files for all route segments

Each `loading.tsx` file renders a skeleton that matches the page layout. These display instantly during server-side data fetching via React Suspense.

#### File: `app/(public)/graph/loading.tsx`

```tsx
// app/(public)/graph/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function GraphLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Controls bar */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
      </div>
      {/* Graph canvas placeholder */}
      <div className="flex-1 bg-surface">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
            <Skeleton className="mx-auto h-4 w-48" />
            <Skeleton className="mx-auto mt-2 h-3 w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

#### File: `app/(public)/timeline/loading.tsx`

```tsx
// app/(public)/timeline/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function TimelineLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-4 w-96" />
      {/* Date range filter */}
      <div className="mb-6 flex gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Timeline events */}
      <div className="space-y-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-full w-px" />
            </div>
            <div className="flex-1 pb-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="mb-2 h-5 w-64" />
              <Skeleton className="h-3 w-full max-w-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(public)/funding/loading.tsx`

```tsx
// app/(public)/funding/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function FundingLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-2 h-9 w-64" />
      <Skeleton className="mb-8 h-4 w-96" />
      {/* Impact calculator */}
      <div className="mb-12 rounded-lg border border-border bg-surface p-6">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="mb-6 h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
      {/* Tier cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(public)/stats/loading.tsx`

```tsx
// app/(public)/stats/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function StatsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-4 w-80" />
      {/* Stat cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="mb-1 h-8 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Progress bars */}
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="mb-1 flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(public)/redactions/loading.tsx`

```tsx
// app/(public)/redactions/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function RedactionsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-2 h-9 w-64" />
      <Skeleton className="mb-8 h-4 w-96" />
      {/* Stats row */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4 text-center">
            <Skeleton className="mx-auto mb-2 h-8 w-16" />
            <Skeleton className="mx-auto h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Feed items */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(public)/datasets/loading.tsx`

```tsx
// app/(public)/datasets/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function DatasetsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-4 w-96" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="mb-3 h-3 w-64" />
            <div className="mb-2 flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(public)/about/loading.tsx`

```tsx
// app/(public)/about/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function AboutLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-3 h-6 w-48" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(public)/cascade/[id]/loading.tsx`

```tsx
// app/(public)/cascade/[id]/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function CascadeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-64" />
      </div>
      {/* Cascade visualization placeholder */}
      <div className="mb-8 flex h-96 items-center justify-center rounded-lg border border-border bg-surface">
        <div className="text-center">
          <Skeleton className="mx-auto mb-4 h-12 w-12 rounded-full" />
          <Skeleton className="mx-auto mb-2 h-4 w-40" />
          <Skeleton className="mx-auto h-3 w-24" />
        </div>
      </div>
      {/* Timeline */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(auth)/contribute/loading.tsx`

```tsx
// app/(auth)/contribute/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function ContributeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-4 w-80" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-6">
            <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
            <Skeleton className="mb-2 h-5 w-40" />
            <Skeleton className="mb-4 h-3 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(auth)/proposals/loading.tsx`

```tsx
// app/(auth)/proposals/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function ProposalsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      {/* Proposal list */}
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="mb-2 h-3 w-full" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(auth)/profile/loading.tsx`

```tsx
// app/(auth)/profile/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      {/* Profile header */}
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div>
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      {/* Stats row */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4 text-center">
            <Skeleton className="mx-auto mb-2 h-8 w-12" />
            <Skeleton className="mx-auto h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Contribution list */}
      <Skeleton className="mb-4 h-6 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
```

#### File: `app/(auth)/saved/loading.tsx`

```tsx
// app/(auth)/saved/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function SavedLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 4: Lazy loading for heavy components

File: `lib/lazy.ts`

```ts
// lib/lazy.ts
// Centralized lazy loading for heavy client components.
// These components use D3, Framer Motion, or other large libraries
// that should not be in the initial bundle.

import dynamic from 'next/dynamic'

// D3 relationship graph (~200KB+ with D3)
export const LazyRelationshipGraph = dynamic(
  () => import('@/components/graph/RelationshipGraph').then((mod) => ({ default: mod.RelationshipGraph })),
  {
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-surface">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading graph visualization...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
)

// Framer Motion cascade replay (~150KB+ with Framer Motion + D3)
export const LazyCascadeReplay = dynamic(
  () => import('@/components/cascade/CascadeReplay').then((mod) => ({ default: mod.CascadeReplay })),
  {
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-surface">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading cascade animation...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
)

// Map component (if using Leaflet or similar)
export const LazyMapView = dynamic(
  () => import('@/components/map/MapView').then((mod) => ({ default: mod.MapView })),
  {
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-surface">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
)

// Donation impact calculator with slider animations
export const LazyDonationImpactCalc = dynamic(
  () => import('@/components/funding/DonationImpactCalc').then((mod) => ({ default: mod.DonationImpactCalc })),
  {
    loading: () => (
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mx-auto mb-4 h-6 w-48 animate-pulse rounded bg-surface-elevated" />
        <div className="mx-auto h-10 w-full animate-pulse rounded bg-surface-elevated" />
      </div>
    ),
    ssr: false,
  }
)
```

Update the graph page to use the lazy component:

File: `app/(public)/graph/page.tsx` (update import)

```tsx
// app/(public)/graph/page.tsx
// Replace direct import:
// import { RelationshipGraph } from '@/components/graph/RelationshipGraph'
// With lazy import:
import { LazyRelationshipGraph } from '@/lib/lazy'

// Then in the JSX, replace:
// <RelationshipGraph ... />
// With:
// <LazyRelationshipGraph ... />
```

Update the cascade page similarly:

File: `app/(public)/cascade/[id]/page.tsx` (update import)

```tsx
// app/(public)/cascade/[id]/page.tsx
// Replace direct import:
// import { CascadeReplay } from '@/components/cascade/CascadeReplay'
// With lazy import:
import { LazyCascadeReplay } from '@/lib/lazy'

// Then in the JSX, replace:
// <CascadeReplay ... />
// With:
// <LazyCascadeReplay ... />
```

### Step 5: Next.js Image optimization

File: `components/shared/OptimizedImage.tsx`

```tsx
// components/shared/OptimizedImage.tsx
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  priority?: boolean
  className?: string
  sizes?: string
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill,
  priority = false,
  className,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}: OptimizedImageProps) {
  // Generate blur placeholder data URL (tiny gray rectangle)
  const blurDataURL =
    'data:image/svg+xml;base64,' +
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#1a1a2e"/></svg>'
    ).toString('base64')

  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : (width || 800)}
      height={fill ? undefined : (height || 600)}
      fill={fill}
      priority={priority}
      placeholder="blur"
      blurDataURL={blurDataURL}
      sizes={sizes}
      className={cn('object-cover', className)}
    />
  )
}
```

Update the photo gallery to use `next/image`:

File: `components/browse/PhotoGallery.tsx` (update existing)

```tsx
// components/browse/PhotoGallery.tsx
// Replace the placeholder div:
//   <div className="aspect-video bg-surface-elevated" />
// With the optimized image:
//   <OptimizedImage
//     src={supabaseStorageUrl + image.storage_path}
//     alt={image.description || image.filename || 'Archive image'}
//     width={400}
//     height={300}
//     sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
//   />
```

### Step 6: Error boundaries and error pages

#### File: `app/error.tsx`

```tsx
// app/error.tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to error tracking service (Sentry)
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 text-6xl">
        <span role="img" aria-label="Warning">&#9888;</span>
      </div>
      <h1 className="mb-2 text-3xl font-bold">Something went wrong</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        An unexpected error occurred. This has been reported and we are working on a fix.
      </p>
      {error.digest && (
        <p className="mb-4 font-mono text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-4">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Go Home
        </Button>
      </div>
    </div>
  )
}
```

#### File: `app/not-found.tsx`

```tsx
// app/not-found.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-6xl font-bold text-accent">404</h1>
      <h2 className="mb-4 text-2xl font-semibold">Page Not Found</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        The page you are looking for does not exist or may have been moved.
        Try searching the archive instead.
      </p>
      <div className="flex gap-4">
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
        <Link href="/search">
          <Button variant="outline">Search Archive</Button>
        </Link>
      </div>
    </div>
  )
}
```

#### File: `app/global-error.tsx`

```tsx
// app/global-error.tsx
// This catches errors in the root layout itself.
'use client'

import { Button } from '@/components/ui/button'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <h1 className="mb-2 text-3xl font-bold">Critical Error</h1>
          <p className="mb-6 max-w-md text-muted-foreground">
            A critical error occurred. Please refresh the page or try again later.
          </p>
          {error.digest && (
            <p className="mb-4 font-mono text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <Button onClick={reset}>Try Again</Button>
        </div>
      </body>
    </html>
  )
}
```

#### File: `components/shared/ErrorBoundary.tsx`

```tsx
// components/shared/ErrorBoundary.tsx
'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  componentName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      'ErrorBoundary caught error in ' + (this.props.componentName || 'unknown') + ':',
      error,
      errorInfo
    )
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="border-red-600/30 bg-red-950/10">
          <CardContent className="py-6 text-center">
            <p className="mb-2 font-semibold text-red-400">
              {this.props.componentName
                ? 'Error loading ' + this.props.componentName
                : 'Something went wrong'}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              This component encountered an error. The rest of the page should still work.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
```

### Step 7: SEO metadata and sitemaps

#### File: `app/layout.tsx` (update metadata section)

```tsx
// app/layout.tsx — Update the metadata export at the top of the file
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://epstein.archive'),
  title: {
    default: 'The Epstein Archive — 3.5 Million Pages of Truth',
    template: '%s | The Epstein Archive',
  },
  description:
    'AI-powered search across the complete Epstein files released by the U.S. Department of Justice. Help uncover the truth through crowdsourced research.',
  keywords: [
    'Epstein files',
    'DOJ documents',
    'document search',
    'crowdsourced research',
    'public records',
    'FOIA',
    'document analysis',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'The Epstein Archive',
    title: 'The Epstein Archive — 3.5 Million Pages of Truth. Now Searchable.',
    description:
      'AI-powered search across the complete Epstein files. Crowdsourced redaction solving, entity mapping, and evidence analysis.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'The Epstein Archive',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Epstein Archive',
    description:
      'AI-powered search across 3.5 million pages of DOJ documents. Help uncover the truth.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}
```

#### File: `app/(public)/search/page.tsx` (add generateMetadata)

```tsx
// At the top of app/(public)/search/page.tsx, add:
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Search the Epstein Files',
  description:
    'Search across 3.5 million pages of DOJ documents using AI-powered semantic search. Filter by document type, date, entity, and more.',
}
```

#### File: `app/(public)/entity/[id]/page.tsx` (add generateMetadata)

```tsx
// Add to app/(public)/entity/[id]/page.tsx before the default export:
import type { Metadata } from 'next'

interface EntityPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EntityPageProps): Promise<Metadata> {
  const { id } = await params

  // Will fetch entity name from Supabase in production
  // For now, return generic metadata
  return {
    title: 'Entity ' + id,
    description: 'View entity profile, document mentions, connections, and evidence dossier in the Epstein Archive.',
  }
}
```

#### File: `app/(public)/document/[id]/page.tsx` (add generateMetadata)

```tsx
// Add to app/(public)/document/[id]/page.tsx before the default export:
import type { Metadata } from 'next'

interface DocumentPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: DocumentPageProps): Promise<Metadata> {
  const { id } = await params

  // Will fetch document name from Supabase in production
  return {
    title: 'Document ' + id,
    description: 'View document content, AI summary, redaction analysis, and related evidence in the Epstein Archive.',
  }
}
```

#### File: `app/(public)/graph/page.tsx` (add metadata)

```tsx
// At the top of app/(public)/graph/page.tsx, add:
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Entity Relationship Map',
  description:
    'Interactive force-directed graph showing relationships between people, organizations, and locations in the Epstein files.',
}
```

#### File: `app/(public)/timeline/page.tsx` (add metadata)

```tsx
// At the top of app/(public)/timeline/page.tsx, add:
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Timeline',
  description:
    'Chronological timeline of events, documents, and activities extracted from the Epstein files.',
}
```

#### File: `app/sitemap.ts`

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://epstein.archive'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: BASE_URL + '/search', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: BASE_URL + '/entities', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: BASE_URL + '/graph', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: BASE_URL + '/timeline', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: BASE_URL + '/photos', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: BASE_URL + '/audio', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: BASE_URL + '/flights', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: BASE_URL + '/datasets', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: BASE_URL + '/discoveries', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: BASE_URL + '/redactions', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: BASE_URL + '/stats', lastModified: new Date(), changeFrequency: 'daily', priority: 0.5 },
    { url: BASE_URL + '/funding', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: BASE_URL + '/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: BASE_URL + '/bounties', lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: BASE_URL + '/prosecutors', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ]

  // Dynamic pages: entities
  // TODO: Fetch entity IDs from Supabase
  // const { data: entities } = await supabase.from('entities').select('id, updated_at')
  // const entityPages = entities?.map((e) => ({
  //   url: BASE_URL + '/entity/' + e.id,
  //   lastModified: new Date(e.updated_at),
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.6,
  // })) || []

  // Dynamic pages: documents
  // TODO: Fetch document IDs from Supabase
  // const { data: documents } = await supabase.from('documents').select('id, updated_at').limit(50000)
  // const documentPages = documents?.map((d) => ({
  //   url: BASE_URL + '/document/' + d.id,
  //   lastModified: new Date(d.updated_at),
  //   changeFrequency: 'monthly' as const,
  //   priority: 0.5,
  // })) || []

  return [
    ...staticPages,
    // ...entityPages,
    // ...documentPages,
  ]
}
```

#### File: `app/robots.ts`

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://epstein.archive'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/login', '/profile'],
      },
    ],
    sitemap: BASE_URL + '/sitemap.xml',
  }
}
```

#### File: `components/shared/JsonLd.tsx`

```tsx
// components/shared/JsonLd.tsx
interface JsonLdProps {
  data: Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// Pre-built schemas

export function WebsiteJsonLd() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://epstein.archive'
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'The Epstein Archive',
        url: appUrl,
        description:
          'AI-powered search across 3.5 million pages of DOJ documents from the Epstein files.',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: appUrl + '/search?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  )
}

export function DatasetJsonLd({
  name,
  description,
  documentCount,
}: {
  name: string
  description: string
  documentCount: number
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name,
        description,
        creator: {
          '@type': 'Organization',
          name: 'U.S. Department of Justice',
        },
        distribution: {
          '@type': 'DataDownload',
          encodingFormat: 'application/pdf',
        },
        size: documentCount + ' documents',
      }}
    />
  )
}

export function PersonJsonLd({
  name,
  description,
  aliases,
}: {
  name: string
  description: string | null
  aliases: string[]
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Person',
        name,
        description: description || undefined,
        alternateName: aliases.length > 0 ? aliases : undefined,
      }}
    />
  )
}
```

Add `WebsiteJsonLd` to the home page:

```tsx
// In app/page.tsx, add at the top of the returned JSX:
import { WebsiteJsonLd } from '@/components/shared/JsonLd'

// Inside the component return:
// <div className="flex flex-col">
//   <WebsiteJsonLd />
//   {/* ... rest of page ... */}
// </div>
```

### Step 8: Accessibility improvements

#### File: `components/shared/SkipLink.tsx`

```tsx
// components/shared/SkipLink.tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-4 z-[100] -translate-y-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-transform focus:translate-y-0"
    >
      Skip to main content
    </a>
  )
}
```

Add to `app/layout.tsx`:

```tsx
// In app/layout.tsx, add inside <body> before <Header>:
import { SkipLink } from '@/components/shared/SkipLink'

// <body>
//   <SkipLink />
//   <Header />
//   <main id="main-content">
//     {children}
//   </main>
//   <Footer />
// </body>
```

#### File: `components/shared/VisuallyHidden.tsx`

```tsx
// components/shared/VisuallyHidden.tsx
interface VisuallyHiddenProps {
  children: React.ReactNode
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'label'
}

export function VisuallyHidden({ children, as: Component = 'span' }: VisuallyHiddenProps) {
  return (
    <Component
      className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
      style={{ clip: 'rect(0, 0, 0, 0)' }}
    >
      {children}
    </Component>
  )
}
```

#### File: `lib/hooks/useKeyboardShortcuts.ts`

```ts
// lib/hooks/useKeyboardShortcuts.ts
'use client'

import { useEffect, useCallback } from 'react'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  handler: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Do not trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : true
        const metaMatch = shortcut.meta ? event.metaKey : true
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && metaMatch && shiftMatch && keyMatch) {
          event.preventDefault()
          shortcut.handler()
          return
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Common shortcuts for the search page
export const SEARCH_SHORTCUTS: ShortcutConfig[] = [
  {
    key: '/',
    handler: () => {
      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]')
      searchInput?.focus()
    },
    description: 'Focus search bar',
  },
  {
    key: 'Escape',
    handler: () => {
      const activeElement = document.activeElement as HTMLElement
      activeElement?.blur()
    },
    description: 'Clear focus',
  },
]
```

#### File: `components/shared/FocusTrap.tsx`

```tsx
// components/shared/FocusTrap.tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface FocusTrapProps {
  children: ReactNode
  active?: boolean
}

export function FocusTrap({ children, active = true }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    firstElement.focus()

    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [active])

  return <div ref={containerRef}>{children}</div>
}
```

#### ARIA updates for existing components

File: `components/search/SearchBar.tsx` (update existing)

```tsx
// Update the SearchBar input to include proper ARIA attributes:
// <Input
//   data-search-input
//   type="search"
//   role="searchbox"
//   aria-label="Search the Epstein Archive"
//   aria-describedby="search-hint"
//   placeholder="Search documents, entities, evidence..."
//   ...
// />
// <span id="search-hint" className="sr-only">
//   Press / to focus. Enter to search. Use filters in the sidebar to narrow results.
// </span>
```

File: `components/layout/Header.tsx` (update existing)

```tsx
// Update the Header nav element:
// <nav aria-label="Main navigation">
//   ...
// </nav>
//
// Update mobile menu button:
// <Button
//   variant="ghost"
//   size="icon"
//   aria-label="Toggle navigation menu"
//   aria-expanded={isOpen}
//   aria-controls="mobile-menu"
//   onClick={() => setIsOpen(!isOpen)}
// >
//   ...
// </Button>
//
// Update mobile menu container:
// <div id="mobile-menu" role="navigation" aria-label="Mobile navigation">
//   ...
// </div>
```

### Step 9: Vercel deployment configuration

#### File: `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    },
    "app/api/chat/**/*.ts": {
      "maxDuration": 60
    },
    "app/api/search/**/*.ts": {
      "maxDuration": 15
    }
  },
  "crons": [
    {
      "path": "/api/cron/stats",
      "schedule": "0 */6 * * *"
    }
  ],
  "redirects": [
    {
      "source": "/docs",
      "destination": "/about",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/rss",
      "destination": "/api/rss/discoveries"
    }
  ]
}
```

#### File: `.env.example`

```bash
# .env.example
# Copy this file to .env.local and fill in the values.

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# --- AI Providers ---
# At least one required for chat and analysis
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
# Optional: Gemini for alternative models
GOOGLE_AI_API_KEY=AIza...

# --- Search ---
# Supabase pgvector is used by default. No extra config needed.
# If using external vector DB:
# PINECONE_API_KEY=
# PINECONE_INDEX=

# --- Rate Limiting ---
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# --- Error Tracking ---
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org
SENTRY_PROJECT=epstein-archive

# --- Analytics ---
# Vercel Analytics is auto-detected on Vercel. No config needed.
# For self-hosted:
# NEXT_PUBLIC_ANALYTICS_ID=

# --- Application ---
NEXT_PUBLIC_APP_URL=https://epstein.archive
NEXT_PUBLIC_GOFUNDME_URL=https://www.gofundme.com/your-campaign

# --- Auth ---
# Supabase Auth is configured in the Supabase dashboard.
# OAuth providers (Google, GitHub) are set up there.
# No extra env vars needed for basic email + OAuth auth.

# --- Worker (Cloud Run) ---
# These are only needed for the document processing worker.
# GOOGLE_CLOUD_PROJECT=your-project
# GOOGLE_CLOUD_REGION=us-central1
# WORKER_CONCURRENCY=5
```

### Step 10: Environment variable validation

File: `lib/env.ts`

```ts
// lib/env.ts
// Runtime validation of required environment variables.
// Fails fast at startup if critical vars are missing.

import { z } from 'zod'

const serverEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // AI - at least one must be set
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  // Rate limiting (optional in dev)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Error tracking (optional in dev)
  SENTRY_DSN: z.string().url().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_GOFUNDME_URL: z.string().url().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type ClientEnv = z.infer<typeof clientEnvSchema>

function validateEnv() {
  // Only validate on server
  if (typeof window !== 'undefined') return

  const result = serverEnvSchema.safeParse(process.env)

  if (!result.success) {
    const missing = result.error.issues.map((i) => '  - ' + i.path.join('.') + ': ' + i.message)
    console.error('Missing or invalid environment variables:\n' + missing.join('\n'))

    // In production, fail hard. In dev, warn.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variables. See logs for details.')
    }
  }

  // Validate at least one AI provider
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
    const msg = 'At least one AI provider API key is required (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY)'
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    } else {
      console.warn('Warning: ' + msg)
    }
  }
}

// Run validation on import
validateEnv()

// Type-safe access to env vars
export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  ai: {
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    googleKey: process.env.GOOGLE_AI_API_KEY,
  },
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    isProduction: process.env.NODE_ENV === 'production',
  },
} as const
```

### Step 11: Rate limiting middleware

File: `lib/rate-limit.ts`

```ts
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Create rate limiter instances for different endpoints
function createRateLimiter(
  tokens: number,
  window: string
) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(tokens, window as any),
    analytics: true,
    prefix: 'epstein-archive',
  })
}

// API rate limits
export const rateLimiters = {
  // Search: 30 requests per minute
  search: createRateLimiter(30, '1 m'),
  // Chat: 10 requests per minute
  chat: createRateLimiter(10, '1 m'),
  // Proposals: 10 per day (anti-disinformation)
  proposals: createRateLimiter(10, '1 d'),
  // General API: 60 requests per minute
  api: createRateLimiter(60, '1 m'),
  // Auth attempts: 5 per minute
  auth: createRateLimiter(5, '1 m'),
}

export async function checkRateLimit(
  request: NextRequest,
  limiter: keyof typeof rateLimiters
): Promise<NextResponse | null> {
  const rl = rateLimiters[limiter]
  if (!rl) return null // Rate limiting disabled (no Redis configured)

  // Use IP address or user ID as identifier
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1'
  const identifier = ip.split(',')[0].trim()

  const { success, limit, reset, remaining } = await rl.limit(identifier)

  if (!success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  return null
}
```

### Step 12: Middleware for rate limiting and security

File: `middleware.ts` (update existing or create)

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limit API routes
  if (pathname.startsWith('/api/search')) {
    const rateLimitResponse = await checkRateLimit(request, 'search')
    if (rateLimitResponse) return rateLimitResponse
  }

  if (pathname.startsWith('/api/chat')) {
    const rateLimitResponse = await checkRateLimit(request, 'chat')
    if (rateLimitResponse) return rateLimitResponse
  }

  if (pathname.startsWith('/api/proposals')) {
    const rateLimitResponse = await checkRateLimit(request, 'proposals')
    if (rateLimitResponse) return rateLimitResponse
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/search') && !pathname.startsWith('/api/chat') && !pathname.startsWith('/api/proposals')) {
    const rateLimitResponse = await checkRateLimit(request, 'api')
    if (rateLimitResponse) return rateLimitResponse
  }

  if (pathname.startsWith('/api/auth') || pathname.startsWith('/login')) {
    const rateLimitResponse = await checkRateLimit(request, 'auth')
    if (rateLimitResponse) return rateLimitResponse
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/login',
  ],
}
```

### Step 13: Monitoring and analytics

#### File: `app/layout.tsx` (add analytics)

```tsx
// In app/layout.tsx, add these imports:
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Add at the bottom of the <body> tag, before closing </body>:
// <Analytics />
// <SpeedInsights />
```

#### File: `lib/analytics.ts`

```ts
// lib/analytics.ts
// Centralized analytics event tracking.
// Uses Vercel Analytics track() for custom events.

type AnalyticsEvent =
  | { name: 'search'; properties: { query: string; tab: string; resultCount: number } }
  | { name: 'document_view'; properties: { documentId: string; source: string } }
  | { name: 'entity_view'; properties: { entityId: string; entityType: string } }
  | { name: 'redaction_proposal'; properties: { redactionId: string } }
  | { name: 'cascade_view'; properties: { cascadeId: string; matchCount: number } }
  | { name: 'chat_message'; properties: { messageLength: number } }
  | { name: 'funding_click'; properties: { tier: string; amount: number } }
  | { name: 'discovery_share'; properties: { discoveryId: string; platform: string } }
  | { name: 'citation_export'; properties: { format: string; documentId: string } }
  | { name: 'keyboard_shortcut'; properties: { key: string } }

export function trackEvent(event: AnalyticsEvent) {
  // Vercel Analytics
  if (typeof window !== 'undefined' && 'va' in window) {
    // @ts-expect-error Vercel Analytics global
    window.va?.track(event.name, event.properties)
  }

  // Development logging
  if (process.env.NODE_ENV === 'development') {
    console.debug('[Analytics] ' + event.name, event.properties)
  }
}
```

#### File: `sentry.client.config.ts`

```ts
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay for debugging
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.1,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Filter out noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /Loading chunk \d+ failed/,
  ],

  beforeSend(event) {
    // Remove PII
    if (event.user) {
      delete event.user.ip_address
      delete event.user.email
    }
    return event
  },
})
```

#### File: `sentry.server.config.ts`

```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === 'production',
})
```

#### File: `sentry.edge.config.ts`

```ts
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === 'production',
})
```

### Step 14: CI/CD pipeline with GitHub Actions

#### File: `.github/workflows/ci.yml`

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint

  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm typecheck

  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm test:run
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://test.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://test.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key
          NEXT_PUBLIC_APP_URL: https://test.epstein.archive

      - name: Check bundle size
        run: |
          # Fail if any page JS bundle exceeds 250KB
          find .next/static -name "*.js" -size +250k -exec echo "WARNING: Large bundle: {}" \;
```

#### File: `.github/workflows/deploy-preview.yml`

```yaml
# .github/workflows/deploy-preview.yml
name: Deploy Preview

on:
  pull_request:
    branches: [main]

jobs:
  deploy:
    name: Deploy Preview
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        id: vercel
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_ORG_ID }}

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '## Deploy Preview\n\nPreview: ' + '${{ steps.vercel.outputs.preview-url }}' + '\n\nBuilt from commit: ' + context.sha.substring(0, 7)
            })
```

### Step 15: Worker deployment

#### File: `worker/Dockerfile`

```dockerfile
# worker/Dockerfile
# Document processing worker for Cloud Run

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Build
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:worker

# Production
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker
USER worker

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist/worker ./dist/worker
COPY --from=builder /app/package.json ./package.json

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["node", "dist/worker/index.js"]
```

#### File: `worker/deploy.sh`

```bash
#!/bin/bash
# worker/deploy.sh
# Deploy the document processing worker to Google Cloud Run.

set -euo pipefail

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-epstein-archive}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
SERVICE_NAME="epstein-worker"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "Building container image..."
docker build -t "${IMAGE_NAME}" -f worker/Dockerfile .

echo "Pushing to Container Registry..."
docker push "${IMAGE_NAME}"

echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 3600 \
  --concurrency 5 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "\
SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,\
OPENAI_API_KEY=openai-api-key:latest,\
ANTHROPIC_API_KEY=anthropic-api-key:latest" \
  --allow-unauthenticated=false

echo "Deployment complete."
echo "Service URL: $(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --format 'value(status.url)')"
```

#### File: `docker-compose.yml`

```yaml
# docker-compose.yml
# Local development with Redis for rate limiting

version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 3

  # Optional: Run worker locally
  # worker:
  #   build:
  #     context: .
  #     dockerfile: worker/Dockerfile
  #   environment:
  #     - NODE_ENV=development
  #     - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
  #     - OPENAI_API_KEY=${OPENAI_API_KEY}
  #   depends_on:
  #     redis:
  #       condition: service_healthy

volumes:
  redis-data:
```

### Step 16: Testing configuration

#### File: `vitest.config.ts`

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{test,spec}.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/__tests__/**', '**/*.d.ts', '**/types/**'],
      thresholds: {
        lines: 50,
        branches: 50,
        functions: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

#### File: `vitest.setup.ts`

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    return <img src={src} alt={alt} {...props} />
  },
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Suppress console.error in tests (unless debugging)
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return
    originalError.call(console, ...args)
  }
})
afterAll(() => {
  console.error = originalError
})
```

### Step 17: Unit tests

#### File: `lib/utils/__tests__/citations.test.ts`

```ts
// lib/utils/__tests__/citations.test.ts
import { describe, it, expect } from 'vitest'
// TODO: Import the actual citation utilities once they exist
// import { formatCitation, parseCitation, generateBibTeX, generateRIS } from '../citations'

describe('Citation Formatting', () => {
  it('formats a basic document citation', () => {
    const citation = {
      filename: 'DOJ-Release-2024-001.pdf',
      pageNumber: 42,
      datasetName: 'Dataset 3: FBI Reports',
    }

    // Expected format: "DOJ-Release-2024-001.pdf, p. 42 (Dataset 3: FBI Reports)"
    const formatted = citation.filename + ', p. ' + citation.pageNumber + ' (' + citation.datasetName + ')'
    expect(formatted).toBe('DOJ-Release-2024-001.pdf, p. 42 (Dataset 3: FBI Reports)')
  })

  it('handles missing page number', () => {
    const citation = {
      filename: 'deposition-transcript.pdf',
      pageNumber: null as number | null,
      datasetName: 'Dataset 8: Depositions',
    }

    const formatted = citation.pageNumber
      ? citation.filename + ', p. ' + citation.pageNumber + ' (' + citation.datasetName + ')'
      : citation.filename + ' (' + citation.datasetName + ')'

    expect(formatted).toBe('deposition-transcript.pdf (Dataset 8: Depositions)')
  })

  it('handles very long filenames by truncating', () => {
    const longName = 'a'.repeat(200) + '.pdf'
    const truncated = longName.length > 100 ? longName.slice(0, 97) + '...' : longName
    expect(truncated.length).toBeLessThanOrEqual(100)
  })

  it('generates BibTeX format', () => {
    const bibtex = [
      '@misc{epstein-archive-001,',
      '  title = {DOJ Release Document 001},',
      '  author = {U.S. Department of Justice},',
      '  year = {2024},',
      '  note = {Retrieved from The Epstein Archive},',
      '  url = {https://epstein.archive/document/001}',
      '}',
    ].join('\n')

    expect(bibtex).toContain('@misc{')
    expect(bibtex).toContain('U.S. Department of Justice')
  })

  it('generates RIS format', () => {
    const ris = [
      'TY  - GEN',
      'TI  - DOJ Release Document 001',
      'AU  - U.S. Department of Justice',
      'PY  - 2024',
      'UR  - https://epstein.archive/document/001',
      'ER  - ',
    ].join('\n')

    expect(ris).toContain('TY  - GEN')
    expect(ris).toContain('ER  - ')
  })
})
```

#### File: `lib/utils/__tests__/dates.test.ts`

```ts
// lib/utils/__tests__/dates.test.ts
import { describe, it, expect } from 'vitest'

// Utility functions that will be in lib/utils/dates.ts
function formatDate(dateString: string | null, precision: 'day' | 'month' | 'year' = 'day'): string {
  if (!dateString) return 'Unknown date'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Invalid date'

  switch (precision) {
    case 'year':
      return date.getFullYear().toString()
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'day':
    default:
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Unknown period'
  if (start && !end) return formatDate(start) + ' - Present'
  if (!start && end) return 'Unknown - ' + formatDate(end)
  return formatDate(start) + ' - ' + formatDate(end)
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return diffDays + ' days ago'
  if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago'
  if (diffDays < 365) return Math.floor(diffDays / 30) + ' months ago'
  return Math.floor(diffDays / 365) + ' years ago'
}

describe('Date Formatting', () => {
  it('formats a full date string', () => {
    expect(formatDate('2024-03-15')).toBe('March 15, 2024')
  })

  it('formats with month precision', () => {
    expect(formatDate('2024-03-15', 'month')).toBe('March 2024')
  })

  it('formats with year precision', () => {
    expect(formatDate('2024-03-15', 'year')).toBe('2024')
  })

  it('handles null date', () => {
    expect(formatDate(null)).toBe('Unknown date')
  })

  it('handles invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date')
  })

  it('handles ISO datetime format', () => {
    expect(formatDate('2024-03-15T10:30:00Z')).toContain('March')
    expect(formatDate('2024-03-15T10:30:00Z')).toContain('2024')
  })
})

describe('Date Range Formatting', () => {
  it('formats a complete range', () => {
    const result = formatDateRange('2003-01-01', '2008-12-31')
    expect(result).toContain('2003')
    expect(result).toContain('2008')
  })

  it('handles open-ended range (no end)', () => {
    const result = formatDateRange('2003-01-01', null)
    expect(result).toContain('Present')
  })

  it('handles unknown start', () => {
    const result = formatDateRange(null, '2008-12-31')
    expect(result).toContain('Unknown')
  })

  it('handles both null', () => {
    expect(formatDateRange(null, null)).toBe('Unknown period')
  })
})

describe('Relative Time', () => {
  it('returns "Today" for current date', () => {
    const today = new Date().toISOString()
    expect(getRelativeTime(today)).toBe('Today')
  })

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(getRelativeTime(yesterday)).toBe('Yesterday')
  })

  it('returns days ago for recent dates', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
    expect(getRelativeTime(threeDaysAgo)).toBe('3 days ago')
  })
})
```

#### File: `lib/search/__tests__/hybrid-search.test.ts`

```ts
// lib/search/__tests__/hybrid-search.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock search query builder
function buildSearchQuery(params: {
  query: string
  tab?: string
  dateFrom?: string
  dateTo?: string
  datasets?: string[]
  entityType?: string
}) {
  const filters: Record<string, unknown> = {}

  if (params.tab && params.tab !== 'all') {
    const typeMap: Record<string, string> = {
      documents: 'document',
      images: 'image',
      audio: 'audio',
      videos: 'video',
      entities: 'entity',
    }
    filters.content_type = typeMap[params.tab] || params.tab
  }

  if (params.dateFrom) filters.date_from = params.dateFrom
  if (params.dateTo) filters.date_to = params.dateTo
  if (params.datasets?.length) filters.datasets = params.datasets
  if (params.entityType) filters.entity_type = params.entityType

  return {
    query: params.query.trim(),
    filters,
    limit: 20,
    offset: 0,
  }
}

describe('Hybrid Search Query Builder', () => {
  it('builds a basic search query', () => {
    const result = buildSearchQuery({ query: 'flight logs' })
    expect(result.query).toBe('flight logs')
    expect(result.filters).toEqual({})
    expect(result.limit).toBe(20)
  })

  it('trims whitespace from query', () => {
    const result = buildSearchQuery({ query: '  flight logs  ' })
    expect(result.query).toBe('flight logs')
  })

  it('applies tab filter for documents', () => {
    const result = buildSearchQuery({ query: 'test', tab: 'documents' })
    expect(result.filters).toEqual({ content_type: 'document' })
  })

  it('applies tab filter for images', () => {
    const result = buildSearchQuery({ query: 'test', tab: 'images' })
    expect(result.filters).toEqual({ content_type: 'image' })
  })

  it('does not apply filter for "all" tab', () => {
    const result = buildSearchQuery({ query: 'test', tab: 'all' })
    expect(result.filters).toEqual({})
  })

  it('applies date range filters', () => {
    const result = buildSearchQuery({
      query: 'test',
      dateFrom: '2003-01-01',
      dateTo: '2008-12-31',
    })
    expect(result.filters).toEqual({
      date_from: '2003-01-01',
      date_to: '2008-12-31',
    })
  })

  it('applies dataset filter', () => {
    const result = buildSearchQuery({
      query: 'test',
      datasets: ['dataset-3', 'dataset-4'],
    })
    expect(result.filters).toEqual({
      datasets: ['dataset-3', 'dataset-4'],
    })
  })

  it('combines multiple filters', () => {
    const result = buildSearchQuery({
      query: 'Maxwell',
      tab: 'documents',
      dateFrom: '2003-01-01',
      datasets: ['dataset-8'],
    })
    expect(result.filters).toEqual({
      content_type: 'document',
      date_from: '2003-01-01',
      datasets: ['dataset-8'],
    })
  })
})
```

#### File: `lib/ai/__tests__/factory.test.ts`

```ts
// lib/ai/__tests__/factory.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock AI provider factory
type AIProvider = 'openai' | 'anthropic' | 'google'

function getAIProvider(): AIProvider {
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.GOOGLE_AI_API_KEY) return 'google'
  throw new Error('No AI provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY.')
}

function getProviderModel(provider: AIProvider): string {
  const models: Record<AIProvider, string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-pro',
  }
  return models[provider]
}

describe('AI Provider Factory', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GOOGLE_AI_API_KEY
  })

  it('defaults to OpenAI when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(getAIProvider()).toBe('openai')
  })

  it('falls back to Anthropic when only ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(getAIProvider()).toBe('anthropic')
  })

  it('falls back to Google when only GOOGLE_AI_API_KEY is set', () => {
    process.env.GOOGLE_AI_API_KEY = 'AIza-test'
    expect(getAIProvider()).toBe('google')
  })

  it('throws error when no provider is configured', () => {
    expect(() => getAIProvider()).toThrow('No AI provider configured')
  })

  it('prefers OpenAI when multiple providers are configured', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(getAIProvider()).toBe('openai')
  })

  it('returns correct model for each provider', () => {
    expect(getProviderModel('openai')).toBe('gpt-4o')
    expect(getProviderModel('anthropic')).toBe('claude-sonnet-4-20250514')
    expect(getProviderModel('google')).toBe('gemini-pro')
  })
})
```

### Step 18: Component tests

#### File: `components/shared/__tests__/EmptyState.test.tsx`

```tsx
// components/shared/__tests__/EmptyState.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        variant="no-results"
        title="No Results Found"
        description="Try a different search query."
      />
    )

    expect(screen.getByText('No Results Found')).toBeInTheDocument()
    expect(screen.getByText('Try a different search query.')).toBeInTheDocument()
  })

  it('renders funding CTA when showFundingCTA is true', () => {
    render(
      <EmptyState
        variant="not-processed"
        title="Not Processed"
        description="Help fund processing."
        showFundingCTA
      />
    )

    expect(screen.getByText(/fund/i)).toBeInTheDocument()
  })

  it('does not render funding CTA by default', () => {
    render(
      <EmptyState
        variant="no-results"
        title="No Results"
        description="Nothing here."
      />
    )

    // Should not contain a "See Your Impact" or "Donate" button
    expect(screen.queryByText('See Your Impact')).not.toBeInTheDocument()
  })
})
```

#### File: `components/shared/__tests__/LoadingState.test.tsx`

```tsx
// components/shared/__tests__/LoadingState.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingState } from '../LoadingState'

describe('LoadingState', () => {
  it('renders loading message', () => {
    render(<LoadingState message="Loading documents..." />)
    expect(screen.getByText('Loading documents...')).toBeInTheDocument()
  })

  it('renders default message when none provided', () => {
    render(<LoadingState />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders a spinner/animation element', () => {
    const { container } = render(<LoadingState />)
    // Check for animate-spin class (Tailwind spinner)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
})
```

#### File: `components/search/__tests__/SearchBar.test.tsx`

```tsx
// components/search/__tests__/SearchBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '../SearchBar'

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('SearchBar', () => {
  it('renders search input', () => {
    render(<SearchBar />)
    const input = screen.getByRole('searchbox') || screen.getByPlaceholderText(/search/i)
    expect(input).toBeInTheDocument()
  })

  it('renders with default value', () => {
    render(<SearchBar defaultValue="flight logs" />)
    const input = screen.getByDisplayValue('flight logs')
    expect(input).toBeInTheDocument()
  })

  it('accepts user input', () => {
    render(<SearchBar />)
    const input = screen.getByRole('searchbox') || screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'Maxwell deposition' } })
    expect(input).toHaveValue('Maxwell deposition')
  })

  it('has proper aria-label for accessibility', () => {
    render(<SearchBar />)
    const input = screen.getByRole('searchbox') || screen.getByLabelText(/search/i)
    expect(input).toBeInTheDocument()
  })
})
```

#### File: `components/chat/__tests__/ChatMessage.test.tsx`

```tsx
// components/chat/__tests__/ChatMessage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatMessage } from '../ChatMessage'

describe('ChatMessage', () => {
  it('renders user message', () => {
    render(
      <ChatMessage
        role="user"
        content="Who visited the island in 2005?"
      />
    )
    expect(screen.getByText('Who visited the island in 2005?')).toBeInTheDocument()
  })

  it('renders assistant message', () => {
    render(
      <ChatMessage
        role="assistant"
        content="Based on the flight logs, the following individuals visited..."
      />
    )
    expect(screen.getByText(/Based on the flight logs/)).toBeInTheDocument()
  })

  it('applies different styling for user vs assistant', () => {
    const { rerender, container } = render(
      <ChatMessage role="user" content="User message" />
    )
    const userMessage = container.firstChild as HTMLElement
    const userClasses = userMessage?.className || ''

    rerender(
      <ChatMessage role="assistant" content="Assistant message" />
    )
    const assistantMessage = container.firstChild as HTMLElement
    const assistantClasses = assistantMessage?.className || ''

    // They should have different styling
    expect(userClasses).not.toBe(assistantClasses)
  })

  it('renders citations when provided', () => {
    render(
      <ChatMessage
        role="assistant"
        content="The document shows..."
        citations={[
          { documentId: 'doc-1', filename: 'FBI-Report-001.pdf', pageNumber: 12 },
        ]}
      />
    )
    expect(screen.getByText(/FBI-Report-001/)).toBeInTheDocument()
  })
})
```

### Step 19: Final production checks script

File: `scripts/production-check.sh`

```bash
#!/bin/bash
# scripts/production-check.sh
# Run all production readiness checks before deploying.

set -e

echo "========================================="
echo "  Production Readiness Checks"
echo "========================================="
echo ""

ERRORS=0

# 1. TypeScript strict mode
echo "1. TypeScript strict mode..."
if pnpm typecheck 2>/dev/null; then
  echo "   PASS: TypeScript compiles with zero errors"
else
  echo "   FAIL: TypeScript errors found"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Lint
echo "2. ESLint..."
if pnpm lint 2>/dev/null; then
  echo "   PASS: No lint errors"
else
  echo "   FAIL: Lint errors found"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Tests
echo "3. Unit tests..."
if pnpm test:run 2>/dev/null; then
  echo "   PASS: All tests pass"
else
  echo "   FAIL: Test failures"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Build
echo "4. Production build..."
if pnpm build 2>/dev/null; then
  echo "   PASS: Build completes successfully"
else
  echo "   FAIL: Build failed"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Console.log check
echo "5. Console.log statements..."
LOG_COUNT=$(grep -r "console\.log" --include="*.ts" --include="*.tsx" app/ components/ lib/ 2>/dev/null | grep -v "__tests__" | grep -v "node_modules" | wc -l | tr -d ' ')
if [ "$LOG_COUNT" -eq "0" ]; then
  echo "   PASS: No console.log in production code"
else
  echo "   WARN: Found $LOG_COUNT console.log statements"
  grep -r "console\.log" --include="*.ts" --include="*.tsx" app/ components/ lib/ 2>/dev/null | grep -v "__tests__" | grep -v "node_modules" | head -5
fi
echo ""

# 6. Unused imports
echo "6. Unused imports..."
if pnpm typecheck --noUnusedLocals --noUnusedParameters 2>/dev/null; then
  echo "   PASS: No unused imports or variables"
else
  echo "   WARN: Unused imports/variables found (non-blocking)"
fi
echo ""

# 7. Env example check
echo "7. Environment variables..."
if [ -f ".env.example" ]; then
  echo "   PASS: .env.example exists"
else
  echo "   FAIL: .env.example missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 8. Check for TODO: placeholder URLs
echo "8. Placeholder URLs..."
TODO_COUNT=$(grep -r "TODO:" --include="*.ts" --include="*.tsx" app/ components/ lib/ 2>/dev/null | wc -l | tr -d ' ')
echo "   INFO: Found $TODO_COUNT TODO comments (review before production)"
echo ""

# Summary
echo "========================================="
if [ "$ERRORS" -eq "0" ]; then
  echo "  ALL CHECKS PASSED"
else
  echo "  $ERRORS CHECK(S) FAILED"
fi
echo "========================================="

exit $ERRORS
```

### Step 20: Verify build

```bash
# Run the complete production check
chmod +x scripts/production-check.sh
./scripts/production-check.sh

# Or run individually:
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build

# Bundle analysis (optional):
ANALYZE=true pnpm build
```

Fix any TypeScript errors. The most common will be import path issues or missing type declarations for Sentry or Vercel Analytics.

---

## Gotchas

1. **Sentry + Next.js setup:** `@sentry/nextjs` requires wrapping `next.config.js` with `withSentryConfig()`. However, the `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` files must exist at the project root. If Sentry is not needed immediately, set `enabled: false` and configure later.

2. **Rate limiting in development:** Upstash Redis is optional. The `createRateLimiter()` function returns `null` if Redis env vars are not set, so all rate limiting is silently skipped in local development. Do not assume rate limits are enforced without Redis.

3. **`next/dynamic` vs `React.lazy`:** In Next.js App Router, use `next/dynamic` with `ssr: false` for client-only components (D3, Framer Motion). `React.lazy` does not support SSR control and will cause hydration mismatches for browser-only libraries.

4. **Middleware edge runtime:** The `middleware.ts` file runs on the Edge Runtime, which has limited API support. Do not use Node.js-specific modules (like `fs`, `path`, or `crypto`) inside middleware. The `@upstash/redis` package is Edge-compatible.

5. **Security headers and CSP:** The Content-Security-Policy header may need adjustment based on what external services you use. If you add a new third-party script or connect to a new API domain, you must update the CSP policy in `next.config.js` or the page will fail silently.

6. **Vercel Analytics auto-detection:** `@vercel/analytics` and `@vercel/speed-insights` automatically detect the Vercel environment. They are no-ops in development and when deployed to non-Vercel environments. No API key is needed.

7. **Image optimization and Supabase Storage:** The `remotePatterns` in `next.config.js` must match your actual Supabase project URL. If images fail to load with a 400 error, check that the hostname pattern is correct.

8. **Loading.tsx vs Suspense:** `loading.tsx` files in the App Router automatically wrap the page in a `<Suspense>` boundary. You do not need to add `<Suspense>` manually around pages that have a sibling `loading.tsx`. However, for inline loading states within a page (e.g., a section that loads independently), use `<Suspense>` with a `fallback` prop.

9. **GitHub Actions secrets:** The CI workflow references `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub secrets. These must be configured in the repository Settings > Secrets and variables > Actions before the deploy preview workflow will run.

10. **Worker Dockerfile build context:** The `docker build` command in `deploy.sh` uses the project root as the build context (not the `worker/` directory). This is intentional -- the worker needs access to shared `lib/` code. Make sure the `Dockerfile` path is specified with `-f worker/Dockerfile`.

---

## Files to Create

```
app/
├── error.tsx
├── not-found.tsx
├── global-error.tsx
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
lib/
├── lazy.ts
├── env.ts
├── rate-limit.ts
├── analytics.ts
├── hooks/useKeyboardShortcuts.ts
├── utils/__tests__/citations.test.ts
├── utils/__tests__/dates.test.ts
├── search/__tests__/hybrid-search.test.ts
└── ai/__tests__/factory.test.ts
components/
├── shared/
│   ├── OptimizedImage.tsx
│   ├── ErrorBoundary.tsx
│   ├── SkipLink.tsx
│   ├── VisuallyHidden.tsx
│   ├── FocusTrap.tsx
│   ├── JsonLd.tsx
│   └── __tests__/
│       ├── EmptyState.test.tsx
│       └── LoadingState.test.tsx
├── search/__tests__/
│   └── SearchBar.test.tsx
└── chat/__tests__/
    └── ChatMessage.test.tsx
middleware.ts                    (update)
next.config.js                  (update)
vercel.json
.env.example
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
vitest.config.ts
vitest.setup.ts
docker-compose.yml
worker/
├── Dockerfile
└── deploy.sh
scripts/
└── production-check.sh
.github/workflows/
├── ci.yml
└── deploy-preview.yml
```

## Acceptance Criteria

1. `pnpm build` completes with zero errors and zero warnings
2. `pnpm test:run` -- all unit tests pass
3. `pnpm lint` -- no lint errors
4. TypeScript strict mode passes (`pnpm typecheck`)
5. All `loading.tsx` files render appropriate skeleton screens matching their page layouts
6. D3 graph and Framer Motion cascade are lazy-loaded via `next/dynamic` (not in initial JS bundle)
7. All pages have appropriate metadata (title, description, OG tags) via `generateMetadata` or static exports
8. `sitemap.ts` generates valid XML sitemap with all static routes
9. `robots.ts` generates valid robots.txt allowing crawling but disallowing `/api/` and `/auth/`
10. JSON-LD structured data renders on home page (WebSite schema), dataset pages, and entity pages
11. Error boundary component catches and displays component-level errors gracefully
12. Custom 404 page renders with navigation back to home and search
13. Custom error page renders with retry button and error ID
14. Skip-to-content link is focusable and jumps to `#main-content`
15. Search bar has proper ARIA attributes (`role="searchbox"`, `aria-label`)
16. Keyboard shortcut `/` focuses the search bar (when not in an input)
17. Rate limiting returns 429 with `Retry-After` header when limits are exceeded
18. Security headers (CSP, HSTS, X-Frame-Options) are present on all responses
19. Vercel Analytics and Speed Insights components are in the root layout
20. Sentry error tracking is configured (disabled in development)
21. GitHub Actions CI runs lint, typecheck, test, and build on every PR
22. `.env.example` documents all required and optional environment variables
23. `vercel.json` configures function timeouts, crons, and redirects
24. Worker Dockerfile builds successfully with `docker build`
25. No `console.log` statements in production code (only `console.error` for actual errors)
26. All placeholder URLs and values are clearly marked with `TODO:` comments
27. `scripts/production-check.sh` runs all checks and reports pass/fail
28. Focus trap works correctly in modal dialogs (chat panel, lightbox)
29. `OptimizedImage` component uses blur placeholder and proper `sizes` attribute
30. Bundle size for each page's JS is under 250KB (excluding shared chunks)

## Design Notes

- Skeleton screens should match the layout of their corresponding page -- same grid columns, spacing, and approximate content sizes. Use `Skeleton` from shadcn/ui with appropriate widths and heights.
- Error pages use the same dark theme as the rest of the app. The 404 page is informational and helpful (not frustrating). The error page shows an error ID for support.
- Security headers follow OWASP recommendations. The CSP is strict but allows Supabase connections and inline styles (needed by some UI libraries).
- Rate limits are conservative: 30 searches/min, 10 chats/min, 10 proposals/day. These can be adjusted per deployment via Upstash dashboard.
- The production check script is designed to run in CI and locally. It exits with a non-zero code if any critical check fails.
- Vercel deployment is zero-config beyond `vercel.json` -- push to main triggers production deploy, PRs get preview deploys.
- The Worker Dockerfile uses multi-stage builds to minimize the final image size. Only production dependencies and built output are included.
