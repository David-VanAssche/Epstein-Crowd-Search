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
  Camera,
  Map,
  Menu,
  LogIn,
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
          Help unlock the truth &rarr;
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
          {navItems.map((item) => {
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
