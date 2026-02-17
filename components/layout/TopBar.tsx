'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { generateBreadcrumbs } from '@/lib/breadcrumbs'
import { useAuth } from '@/lib/hooks/useAuth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Bookmark, LogOut, LogIn } from 'lucide-react'
import Link from 'next/link'

export function TopBar() {
  const pathname = usePathname()
  const crumbs = generateBreadcrumbs(pathname)
  const { user, isLoading: authLoading, signOut } = useAuth()

  return (
    <header className="h-[var(--topbar-height)] sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Breadcrumbs - hidden on small screens */}
      <nav className="hidden md:flex" aria-label="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            {crumbs.map((crumb, i) => {
              if (!crumb.label) return null
              return (
                <React.Fragment key={crumb.href}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {i === crumbs.length - 1 ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </nav>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-1">
        <NotificationDropdown />

        {!authLoading && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.user_metadata?.avatar_url as string} />
                  <AvatarFallback className="text-xs">
                    {(user.email?.[0] ?? 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
                  <Bookmark className="h-4 w-4" />
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
        ) : !authLoading ? (
          <div className="flex items-center gap-1">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            </Link>
            <Link href="/login?view=signup">
              <Button size="sm" className="hidden sm:inline-flex">
                Sign Up
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  )
}
