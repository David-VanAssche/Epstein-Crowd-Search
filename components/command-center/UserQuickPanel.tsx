'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/useAuth'
import { Bookmark, FileSearch, Users, Trophy } from 'lucide-react'

export function UserQuickPanel() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Card className="border-border bg-surface">
        <CardContent className="pt-6">
          <div className="h-24 animate-pulse rounded-md bg-surface-elevated" />
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Join the Investigation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Create an account to save searches, bookmark documents, propose redaction
            solutions, and earn recognition for your contributions.
          </p>
          <Button asChild className="w-full">
            <Link href="/login?view=signup">Create Account</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="underline hover:text-foreground">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your Investigation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/bookmarks"
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-surface-elevated"
          >
            <Bookmark className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Bookmarks</span>
          </Link>
          <Link
            href="/saved-searches"
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-surface-elevated"
          >
            <FileSearch className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Saved Searches</span>
          </Link>
          <Link
            href="/profile"
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-surface-elevated"
          >
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Achievements</span>
          </Link>
          <Link
            href="/entities"
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-surface-elevated"
          >
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Entities</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
