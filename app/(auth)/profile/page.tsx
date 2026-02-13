// app/(auth)/profile/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LoadingState } from '@/components/shared/LoadingState'
import { useAuth } from '@/lib/hooks/useAuth'
import { fetchApi } from '@/lib/api/client'
import type { UserProfile } from '@/types/redaction'

export default function ProfilePage() {
  const { user } = useAuth()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchApi<UserProfile>('/api/profile'),
    enabled: !!user,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <LoadingState variant="page" />
      </div>
    )
  }

  const displayName = profile?.display_name
    ?? (user?.user_metadata?.full_name as string)
    ?? user?.email?.split('@')[0]
    ?? 'Researcher'

  const avatarUrl = profile?.avatar_url
    ?? (user?.user_metadata?.avatar_url as string)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Your Profile</h1>

      <div className="grid gap-6 md:grid-cols-3">
        {/* User Info */}
        <Card className="border-border bg-surface md:col-span-1">
          <CardContent className="flex flex-col items-center pt-6">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="text-2xl">
                {displayName[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge variant="secondary" className="mt-2">
              {profile?.tier ?? 'contributor'}
            </Badge>
            {profile && (
              <div className="mt-4 w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Level {profile.level}</span>
                  <span className="text-muted-foreground">{profile.level_title}</span>
                </div>
                <Progress value={(profile.xp % 100)} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{profile.xp} XP</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border bg-surface">
            <CardHeader>
              <CardTitle>Contribution Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Proposals Submitted', value: profile?.proposals_submitted ?? 0 },
                  { label: 'Proposals Confirmed', value: profile?.proposals_confirmed ?? 0 },
                  { label: 'Cascades Triggered', value: profile?.cascades_triggered ?? 0 },
                  { label: 'Accuracy Rate', value: `${((profile?.accuracy_rate ?? 0) * 100).toFixed(0)}%` },
                  { label: 'Reputation Score', value: profile?.reputation_score ?? 0 },
                  { label: 'Current Streak', value: `${profile?.current_streak ?? 0} days` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {profile?.expertise_areas && profile.expertise_areas.length > 0 && (
            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle>Expertise Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.expertise_areas.map((area) => (
                    <Badge key={area} variant="outline">{area}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
