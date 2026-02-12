# Phase 1: Foundation

> **Sessions:** 1 | **Dependencies:** None | **Parallel with:** Nothing (must be first)

## Summary

Bootstrap the Next.js application with all dependencies, dark theme design system, root layout, shared components, CI/CD, and the `project/` planning directory. This is the scaffold everything else builds on.

## IMPORTANT: Existing Repo Context

This repo already contains:
- `epstein-archive-scaffold-prompt.md` — the full spec (DO NOT delete)
- `project/` — planning directory with all phase files (already complete)
- `.git/` — initialized git repo with remote

When running `pnpm create next-app`, you must handle the existing files. Strategy:
1. Run `pnpm create next-app` in a temp directory
2. Copy the generated files into this repo
3. Or use the `--no-git` flag and answer prompts to avoid conflicts

Alternatively, manually create `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` from scratch — which is actually simpler and avoids all conflict issues.

---

## Step-by-Step Execution

### Step 1: Create package.json and install dependencies

```bash
# Initialize package.json (if not already present)
pnpm init

# Install Next.js + React
pnpm add next@14 react react-dom

# Install TypeScript
pnpm add -D typescript @types/react @types/react-dom @types/node

# Install Tailwind CSS
pnpm add -D tailwindcss postcss autoprefixer
pnpm dlx tailwindcss init -p --ts

# Install core deps
pnpm add @supabase/supabase-js @supabase/ssr

# Install UI deps (needed before shadcn init)
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# Install data deps
pnpm add @tanstack/react-query zod

# Install animation deps
pnpm add framer-motion

# Install visualization deps
pnpm add d3
pnpm add -D @types/d3

# Install dev/test deps
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom

# Install ESLint
pnpm add -D eslint eslint-config-next
```

Add these scripts to `package.json`:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

### Step 2: TypeScript configuration

Write `tsconfig.json`:
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    },
    "target": "ES2022"
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "worker"]
}
```

### Step 3: Next.js configuration

Write `next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
```

Write `postcss.config.js`:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### Step 4: shadcn/ui initialization

Write `components.json` directly (avoids interactive CLI):
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/lib/hooks"
  }
}
```

Write `lib/utils.ts`:
```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Then install shadcn/ui components (run each sequentially):
```bash
pnpm dlx shadcn@latest add button card input badge tabs dialog sheet select dropdown-menu tooltip skeleton separator scroll-area avatar progress textarea --yes
```

> **NOTE:** Use `shadcn@latest` (not `shadcn-ui@latest` which is the old package name). The `--yes` flag skips confirmation prompts.

### Step 5: Design System — tailwind.config.ts

Write the complete `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // shadcn/ui system (required — maps to CSS variables)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Custom project colors
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          elevated: 'hsl(var(--surface-elevated))',
        },
        'border-accent': 'hsl(var(--border-accent))',
        info: 'hsl(var(--info))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        'code-document': 'hsl(var(--code-document))',
        // Entity type colors (used for badges/pills)
        entity: {
          person: 'hsl(var(--entity-person))',
          organization: 'hsl(var(--entity-org))',
          location: 'hsl(var(--entity-location))',
          aircraft: 'hsl(var(--entity-aircraft))',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'Menlo', 'monospace'],
      },
      maxWidth: {
        content: '1400px',
      },
      width: {
        sidebar: '280px',
        'chat-panel': '400px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
```

> **NOTE:** Also install `tailwindcss-animate`: `pnpm add -D tailwindcss-animate`

### Step 6: Design System — globals.css

Write `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* --- shadcn/ui required variables (dark theme as default) --- */
    --background: 240 10% 4%;           /* #0a0a0f */
    --foreground: 240 5% 90%;           /* #e4e4e7 zinc-200 */

    --card: 240 10% 8%;                 /* #12121a (surface) */
    --card-foreground: 240 5% 90%;

    --popover: 240 15% 14%;             /* #1a1a2e (surface-elevated) */
    --popover-foreground: 240 5% 90%;

    --primary: 0 72% 51%;               /* #dc2626 red-600 (accent) */
    --primary-foreground: 0 0% 100%;

    --secondary: 240 10% 8%;            /* #12121a */
    --secondary-foreground: 240 5% 90%;

    --muted: 240 10% 8%;
    --muted-foreground: 240 4% 46%;     /* #71717a zinc-500 */

    --accent: 0 72% 51%;                /* #dc2626 red-600 */
    --accent-foreground: 0 0% 100%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;

    --border: 240 15% 20%;              /* #2a2a3e */
    --input: 240 15% 20%;
    --ring: 0 72% 51%;                  /* red-600 focus ring */

    --radius: 0.5rem;

    /* --- Custom project variables --- */
    --surface: 240 10% 8%;              /* #12121a */
    --surface-elevated: 240 15% 14%;    /* #1a1a2e */
    --border-accent: 240 15% 30%;       /* #3a3a5e */

    --info: 217 91% 60%;                /* #3b82f6 blue-500 */
    --success: 142 71% 45%;             /* #22c55e green-500 */
    --warning: 38 92% 50%;              /* #f59e0b amber-500 */
    --code-document: 240 20% 15%;       /* #1e1e2e */

    /* Entity type colors */
    --entity-person: 217 91% 60%;       /* blue-500 */
    --entity-org: 271 91% 65%;          /* purple-500 */
    --entity-location: 142 71% 45%;     /* green-500 */
    --entity-aircraft: 38 92% 50%;      /* amber-500 */
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: hsl(var(--background));
  }
  ::-webkit-scrollbar-thumb {
    background: hsl(var(--border));
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--border-accent));
  }

  /* Selection color */
  ::selection {
    background: hsl(var(--primary) / 0.3);
    color: hsl(var(--foreground));
  }
}
```

### Step 7: Root Layout + Providers

Write `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: {
    default: 'The Epstein Archive',
    template: '%s | The Epstein Archive',
  },
  description:
    '3.5 million pages of Epstein files, now searchable. AI-powered search, entity mapping, and crowdsourced redaction solving.',
  openGraph: {
    title: 'The Epstein Archive',
    description:
      '3.5 million pages of truth, now searchable.',
    url: 'https://epsteinarchive.org',
    siteName: 'The Epstein Archive',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <QueryProvider>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}
```

Write `components/providers/QueryProvider.tsx`:
```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
```

Write `app/page.tsx` (minimal placeholder — replaced in Phase 3):
```tsx
export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 text-center">
        3.5 Million Pages of Truth
      </h1>
      <p className="text-lg text-muted-foreground text-center max-w-2xl">
        AI-powered search across the complete Epstein DOJ file release.
        Coming soon.
      </p>
    </div>
  )
}
```

### Step 8: Header Component

Write `components/layout/Header.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Search,
  Users,
  Network,
  Clock,
  ShieldAlert,
  Database,
  Menu,
  X,
  LogIn,
  Camera,
  Headphones,
  Plane,
  Map,
  Scale,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/search', label: 'Search', icon: Search },
  { href: '/entities', label: 'Entities', icon: Users },
  { href: '/graph', label: 'Graph', icon: Network },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/redactions', label: 'Redactions', icon: ShieldAlert },
  { href: '/photos', label: 'Photos', icon: Camera },
  { href: '/audio', label: 'Audio', icon: Headphones },
  { href: '/flights', label: 'Flights', icon: Plane },
  { href: '/datasets', label: 'Datasets', icon: Database },
  { href: '/prosecutors', label: 'For Prosecutors', icon: Scale },
]

export function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Funding banner */}
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 text-center text-sm text-primary">
        <span className="text-muted-foreground">0% of documents processed.</span>{' '}
        <a
          href="https://www.gofundme.com/f/the-epstein-archive"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary/80"
        >
          Help unlock the truth →
        </a>
      </div>

      <div className="container flex h-14 max-w-content items-center">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="text-lg font-bold text-foreground">
            The Epstein Archive
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1 text-sm">
          {navItems.slice(0, 7).map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-surface',
                  pathname === item.href && 'text-foreground bg-surface'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center space-x-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5">
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          </Link>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-background">
              <nav className="flex flex-col space-y-1 mt-8">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-md transition-colors',
                        'text-muted-foreground hover:text-foreground hover:bg-surface',
                        pathname === item.href && 'text-foreground bg-surface'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  )
                })}
                <div className="border-t border-border my-2" />
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground"
                >
                  <LogIn className="h-5 w-5" />
                  Sign In
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
```

### Step 9: Footer Component

Write `components/layout/Footer.tsx`:
```tsx
import Link from 'next/link'
import { Github, ExternalLink, Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container max-w-content py-8 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              The Epstein Archive
            </h3>
            <p className="text-sm text-muted-foreground">
              Open-source platform for searching 3.5 million pages of
              DOJ-released Epstein files. MIT Licensed.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  About & Methodology
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/David-VanAssche/Epstein-Crowd-Search"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <Github className="h-3.5 w-3.5" />
                  Source Code
                </a>
              </li>
              <li>
                <a
                  href="https://www.gofundme.com/f/the-epstein-archive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <Heart className="h-3.5 w-3.5" />
                  Support This Project
                </a>
              </li>
              <li>
                <Link
                  href="/prosecutors"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  For Prosecutors
                </Link>
              </li>
            </ul>
          </div>

          {/* Processing Status */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Processing Status
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pages processed</span>
                <span className="text-foreground font-mono">0 / 3,500,000</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: '0%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Help us process the rest.{' '}
                <a
                  href="https://www.gofundme.com/f/the-epstein-archive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Donate →
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          MIT License. All data sourced from public DOJ releases.
        </div>
      </div>
    </footer>
  )
}
```

### Step 10: Sidebar Component

Write `components/layout/Sidebar.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface SidebarProps {
  children: React.ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-background transition-all duration-300',
          collapsed ? 'w-0 overflow-hidden' : 'w-sidebar',
          className
        )}
      >
        <div className="flex items-center justify-end p-2 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">{children}</ScrollArea>
      </aside>

      {/* Desktop collapsed toggle */}
      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex fixed left-2 top-[140px] z-40 h-8 w-8"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile sidebar (full-screen sheet) */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden fixed bottom-4 left-4 z-40"
          >
            Filters
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full sm:w-[340px] p-0 bg-background">
          <ScrollArea className="h-full p-4 pt-12">{children}</ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

### Step 11: Shared Components

Write `components/shared/EmptyState.tsx`:
```tsx
import { LucideIcon, FileSearch, Inbox, Clock, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type EmptyStateVariant = 'not-processed' | 'no-results' | 'coming-soon' | 'community-data' | 'custom'

interface EmptyStateProps {
  variant?: EmptyStateVariant
  icon?: LucideIcon
  title?: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  showFundingCTA?: boolean
}

const variantDefaults: Record<
  Exclude<EmptyStateVariant, 'custom'>,
  { icon: LucideIcon; title: string; description: string }
> = {
  'not-processed': {
    icon: Clock,
    title: 'Not Yet Processed',
    description:
      'This content will be available once document processing is funded and complete.',
  },
  'no-results': {
    icon: FileSearch,
    title: 'No Results Found',
    description: 'Try adjusting your search terms or filters.',
  },
  'coming-soon': {
    icon: Inbox,
    title: 'Coming Soon',
    description: 'This feature is under development.',
  },
  'community-data': {
    icon: Heart,
    title: 'Community Data Available',
    description:
      'Search works on community-processed data. Fund AI processing for deeper analysis and more complete results.',
  },
}

export function EmptyState({
  variant = 'custom',
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  showFundingCTA = false,
}: EmptyStateProps) {
  const defaults = variant !== 'custom' ? variantDefaults[variant] : null
  const FinalIcon = Icon ?? defaults?.icon ?? Inbox
  const finalTitle = title ?? defaults?.title ?? 'Nothing here'
  const finalDescription = description ?? defaults?.description ?? ''

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-surface p-4 mb-4">
        <FinalIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{finalTitle}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {finalDescription}
      </p>
      {ctaLabel && ctaHref && (
        <Button asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      )}
      {showFundingCTA && (
        <Button asChild variant="outline" className="mt-2 gap-2">
          <a
            href="https://www.gofundme.com/f/the-epstein-archive"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Heart className="h-4 w-4" />
            Help us process more →
          </a>
        </Button>
      )}
    </div>
  )
}
```

Write `components/shared/LoadingState.tsx`:
```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type LoadingVariant = 'card' | 'list' | 'page' | 'inline'

interface LoadingStateProps {
  variant?: LoadingVariant
  count?: number
  className?: string
}

export function LoadingState({
  variant = 'card',
  count = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'page') {
    return (
      <div className={cn('space-y-6 p-4', className)}>
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'inline') {
    return <Skeleton className={cn('h-4 w-24 inline-block', className)} />
  }

  // card variant (default)
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

Write `components/shared/ErrorBoundary.tsx`:
```tsx
'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Step 12: Configuration Files

Write `.env.example`:
```env
# ======================
# Supabase
# ======================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ======================
# Google Cloud (Document AI + Vertex AI)
# ======================
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
DOCUMENT_AI_PROCESSOR_ID=your-processor-id

# ======================
# AI Provider Selection (defaults shown)
# ======================
EMBEDDING_PROVIDER=google-vertex
VISUAL_EMBEDDING_PROVIDER=google-multimodal
FREE_CHAT_PROVIDER=gemini-flash
PAID_CHAT_PROVIDER=anthropic
RERANK_PROVIDER=cohere
OCR_PROVIDER=google-document-ai
TRANSCRIPTION_PROVIDER=whisper

# ======================
# AI Provider Credentials
# ======================
COHERE_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
# FIREWORKS_API_KEY=        # future
# XAI_API_KEY=              # future

# ======================
# Whisper (video/audio transcription)
# ======================
WHISPER_MODEL=large-v3
# OPENAI_API_KEY=           # if using OpenAI Whisper API

# ======================
# Application
# ======================
NEXT_PUBLIC_SITE_URL=https://epsteinarchive.org
NEXT_PUBLIC_GOFUNDME_URL=https://www.gofundme.com/f/the-epstein-archive
NEXT_PUBLIC_GOFUNDME_WIDGET_URL=
NEXT_PUBLIC_GITHUB_URL=https://github.com/David-VanAssche/Epstein-Crowd-Search

# ======================
# Funding Admin
# ======================
FUNDING_ADMIN_SECRET=

# ======================
# Worker (standalone process)
# ======================
WORKER_CONCURRENCY=5
WORKER_PORT=8080
REDIS_URL=redis://localhost:6379
```

Write `.gitignore`:
```
# dependencies
node_modules/
.pnp
.pnp.js

# next.js
.next/
out/

# production
build/
dist/

# env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# os
.DS_Store
Thumbs.db

# ide
.idea/
.vscode/
*.swp
*.swo

# data (downloaded datasets)
data/

# worker
worker/node_modules/
worker/dist/
```

Write `CLAUDE.md`:
```markdown
# CLAUDE.md — Project Instructions for Claude Code

## Project: The Epstein Archive

Open-source multimodal RAG platform for searching 3.5M pages of Epstein DOJ files.

## Quick Reference

- **Package manager:** pnpm (NEVER npm or yarn)
- **Framework:** Next.js 14, App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Database:** Supabase (PostgreSQL + pgvector)
- **Theme:** Dark only (no light mode)

## Key Files

- `project/MASTER_PLAN.md` — Full architecture and phase plan
- `project/CONVENTIONS.md` — Coding standards (MUST READ)
- `project/AI_PROVIDER_INTERFACES.md` — AI provider abstraction design
- `project/phase-NN-*.md` — Per-phase checklists (mark items [x] when done)
- `epstein-archive-scaffold-prompt.md` — Original full spec with exact SQL

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build (must pass with zero errors)
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check
pnpm test         # Vitest tests
```

## Conventions

- Server Components by default; only add `'use client'` when needed
- Use `@/` import alias for all imports
- Validate API inputs with Zod
- Use React Query for data fetching in client components
- Never import AI providers directly — use factory in `lib/ai/factory.ts`
- All search results must include citations with document + page number

## Phase Workflow

1. Read this file
2. Read `project/MASTER_PLAN.md`
3. Read the relevant `project/phase-NN-*.md`
4. Mark checklist items `- [x]` when complete
5. Leave `<!-- NOTE: reason -->` if something is incomplete
6. Run `pnpm build` before committing — zero errors required
```

Write `CONTRIBUTING.md`:
```markdown
# Contributing to The Epstein Archive

Thank you for your interest in contributing to this project.

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env.local` and fill in your credentials
3. `pnpm install`
4. `pnpm dev`

## Code Style

See `project/CONVENTIONS.md` for full coding standards.

- TypeScript strict mode
- Tailwind CSS for styling (no raw CSS except globals.css)
- shadcn/ui components in `components/ui/`
- Server Components by default

## Pull Requests

- One feature per PR
- Run `pnpm build && pnpm test && pnpm lint` before submitting
- Follow conventional commit messages: `feat:`, `fix:`, `refactor:`, etc.

## License

MIT — see LICENSE file.
```

Write `LICENSE`:
```
MIT License

Copyright (c) 2026 The Epstein Archive Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Step 13: CI/CD Workflows

Write `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: TypeScript check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test:run

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
```

Write `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

Write `.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug Report
about: Report a bug
labels: bug
---

## Description

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

## Actual Behavior

## Environment

- Browser:
- OS:
```

Write `.github/ISSUE_TEMPLATE/feature_request.md`:
```markdown
---
name: Feature Request
about: Suggest a feature
labels: enhancement
---

## Description

## Use Case

## Proposed Solution
```

### Step 14: Verify Build

After all files are created, run:
```bash
pnpm build
```

This MUST complete with zero errors. Common fixes:
- If shadcn components have import issues, ensure `components.json` paths are correct
- If fonts fail, check that `next/font/google` imports are correct
- If TypeScript errors, run `pnpm typecheck` to see specific issues

---

## Checklist

### Project Initialization
- [ ] Create `package.json` with all dependencies and scripts
- [ ] Write `tsconfig.json` with strict mode and `@/*` alias
- [ ] Write `next.config.js` with image domains
- [ ] Write `postcss.config.js`
- [ ] Run `pnpm install` successfully

### shadcn/ui Setup
- [ ] Write `components.json` (New York style, zinc, CSS variables)
- [ ] Write `lib/utils.ts` with `cn()` function
- [ ] Install all 16 shadcn/ui components (button, card, input, badge, tabs, dialog, sheet, select, dropdown-menu, tooltip, skeleton, separator, scroll-area, avatar, progress, textarea)
- [ ] Install `tailwindcss-animate` plugin

### Design System
- [ ] Write `tailwind.config.ts` with all custom colors, fonts, animations
- [ ] Write `app/globals.css` with all CSS variables in HSL format

### Application Shell
- [ ] Write `app/layout.tsx` with fonts, metadata, Header, Footer, QueryProvider
- [ ] Write `app/page.tsx` placeholder
- [ ] Write `components/providers/QueryProvider.tsx` ('use client' boundary)

### Layout Components
- [ ] Write `components/layout/Header.tsx` with nav, mobile Sheet menu, funding banner
- [ ] Write `components/layout/Footer.tsx` with links, processing progress, MIT notice
- [ ] Write `components/layout/Sidebar.tsx` with collapse, mobile Sheet overlay

### Shared Components
- [ ] Write `components/shared/EmptyState.tsx` with 3 variants + funding CTA
- [ ] Write `components/shared/LoadingState.tsx` with 4 variants (card, list, page, inline)
- [ ] Write `components/shared/ErrorBoundary.tsx` with retry button

### Configuration Files
- [ ] Write `.env.example` with all env vars documented
- [ ] Write `.gitignore`
- [ ] Write `CLAUDE.md`
- [ ] Write `CONTRIBUTING.md`
- [ ] Write `LICENSE` (MIT)

### CI/CD
- [ ] Write `.github/workflows/ci.yml`
- [ ] Write `.github/workflows/deploy.yml`
- [ ] Write `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] Write `.github/ISSUE_TEMPLATE/feature_request.md`

### Project Planning (already complete)
- [x] `project/MASTER_PLAN.md`
- [x] `project/CONVENTIONS.md`
- [x] `project/AI_PROVIDER_INTERFACES.md`
- [x] `project/phase-01-foundation.md` through `project/phase-10-gamification.md`

### Verification
- [ ] `pnpm dev` starts and renders dark-themed page
- [ ] `pnpm build` completes with zero errors
- [ ] `pnpm typecheck` passes
- [ ] Header shows navigation links and mobile hamburger menu
- [ ] Footer shows GitHub, GoFundMe links and processing progress
- [ ] EmptyState renders all 3 variants
- [ ] LoadingState renders all 4 variants

## Files to Create

```
package.json
tsconfig.json
next.config.js
postcss.config.js
components.json
tailwind.config.ts
.env.example
.gitignore
CLAUDE.md
CONTRIBUTING.md
LICENSE
lib/utils.ts
app/globals.css
app/layout.tsx
app/page.tsx
components/providers/QueryProvider.tsx
components/layout/Header.tsx
components/layout/Footer.tsx
components/layout/Sidebar.tsx
components/shared/EmptyState.tsx
components/shared/LoadingState.tsx
components/shared/ErrorBoundary.tsx
components/ui/  (16 shadcn components — auto-generated)
.github/workflows/ci.yml
.github/workflows/deploy.yml
.github/ISSUE_TEMPLATE/bug_report.md
.github/ISSUE_TEMPLATE/feature_request.md
```

## Gotchas

1. **shadcn package name changed** — Use `shadcn@latest` not `shadcn-ui@latest`
2. **QueryProvider must be 'use client'** — Root layout is a Server Component, so the React Query provider needs a client component wrapper
3. **CSS variables use HSL without `hsl()`** — shadcn convention: `--background: 240 10% 4%` not `--background: hsl(240, 10%, 4%)`
4. **Font variables** — `next/font/google` sets CSS variables via the `variable` prop; reference them in Tailwind as `var(--font-inter)`
5. **tailwindcss-animate** — Required by shadcn/ui animations but not auto-installed
6. **Existing files** — Don't delete `epstein-archive-scaffold-prompt.md` or `project/` directory
7. **Sheet component** — Used for both mobile header menu AND mobile sidebar; ensure both work independently
