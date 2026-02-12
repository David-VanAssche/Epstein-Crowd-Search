// app/login/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // Phase 4: Supabase auth
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    // Phase 4: Supabase OAuth
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-border bg-surface">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Join the investigation. Contribute, save searches, and earn recognition.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthLogin('google')}
          >
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthLogin('github')}
          >
            Continue with GitHub
          </Button>

          <div className="relative my-4">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>

          {/* Email/Password */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>

          {/* Why sign in */}
          <div className="mt-6 rounded-lg border border-border bg-surface-elevated p-4">
            <h3 className="mb-2 text-sm font-semibold">Why sign in?</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Submit redaction proposals and intelligence hints</li>
              <li>Save searches and bookmark documents</li>
              <li>Create investigation threads</li>
              <li>Earn XP and achievements for contributions</li>
              <li>Track your impact on the investigation</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
