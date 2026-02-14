'use client'

import Link from 'next/link'
import {
  User,
  Bookmark,
  Search,
  LogOut,
  LogIn,
  ChevronsUpDown,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuth } from '@/lib/hooks/useAuth'

export function UserMenu() {
  const { user, isLoading, signOut } = useAuth()
  const { isMobile } = useSidebar()

  if (isLoading) return null

  if (!user) {
    return (
      <SidebarMenuButton asChild tooltip="Sign In">
        <Link href="/login">
          <LogIn className="h-4 w-4" />
          <span>Sign In</span>
        </Link>
      </SidebarMenuButton>
    )
  }

  const displayName =
    (user.user_metadata?.full_name as string) ??
    user.email?.split('@')[0] ??
    'User'
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const initials = (user.email?.[0] ?? 'U').toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          tooltip={displayName}
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="rounded-lg text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{displayName}</span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {user.email}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        side={isMobile ? 'bottom' : 'right'}
        align="end"
        sideOffset={4}
      >
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
        <DropdownMenuItem asChild>
          <Link href="/saved-searches" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Saved Searches
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={signOut}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
