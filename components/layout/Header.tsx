'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Search,
  Users,
  Clock,
  ShieldAlert,
  Camera,
  Plane,
  Database,
  Headphones,
  Menu,
  LogIn,
  LogOut,
  User,
  Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'

const navItems = [
  { href: '/search', label: 'Search', icon: Search },
  { href: '/entities', label: 'Entities', icon: Users },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/redactions', label: 'Redactions', icon: ShieldAlert },
  { href: '/photos', label: 'Photos', icon: Camera },
  { href: '/audio', label: 'Audio', icon: Headphones },
  { href: '/flights', label: 'Flights', icon: Plane },
  { href: '/sources', label: 'Sources', icon: Database },
]

export function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, isLoading: authLoading, signOut } = useAuth()

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
          {!authLoading && user ? (
            <>
            <NotificationDropdown />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.user_metadata?.avatar_url as string} />
                    <AvatarFallback className="text-xs">
                      {(user.email?.[0] ?? 'U').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">
                    {(user.user_metadata?.full_name as string) ?? user.email?.split('@')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bookmarks" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Bookmarks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}

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
                {user ? (
                  <button
                    onClick={() => { signOut(); setMobileOpen(false) }}
                    className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground"
                  >
                    <LogIn className="h-5 w-5" />
                    Sign In
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
