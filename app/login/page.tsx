'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/hooks/useAuth'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [tab, setTab] = useState<string>('sign-in')
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const searchParams = useSearchParams()

  const authErrorCode = searchParams.get('error')
  const initialTab = searchParams.get('view')
  // Set initial tab from URL on first render
  if (initialTab === 'signup' && tab === 'sign-in' && !signUpSuccess) {
    setTab('sign-up')
  }

  const AUTH_ERROR_MESSAGES: Record<string, string> = {
    auth_failed: 'Authentication failed. Please try again.',
    no_code: 'No authorization code was provided.',
    callback_error: 'An error occurred during the authentication callback.',
  }
  const authErrorMessage = authErrorCode
    ? (AUTH_ERROR_MESSAGES[authErrorCode] ?? 'An error occurred during authentication.')
    : null

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setError(null)
    setSignUpSuccess(false)
  }

  const handleTabChange = (value: string) => {
    setTab(value)
    resetForm()
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmail(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await signUpWithEmail(email, password)
      setSignUpSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height))] items-center justify-center px-4">
      <Card className="w-full max-w-md border-border bg-surface">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {tab === 'sign-in' ? 'Sign In' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            Join the investigation. Contribute, save searches, and earn recognition.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(error || authErrorMessage) && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error || authErrorMessage}
            </div>
          )}

          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in">Sign In</TabsTrigger>
              <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
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
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sign-up">
              {signUpSuccess ? (
                <div className="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                  <p className="font-medium">Check your email</p>
                  <p className="mt-1 text-xs">
                    We sent a confirmation link to <strong>{email}</strong>.
                    Click the link to activate your account.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      minLength={6}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          {/* Why sign in */}
          <div className="mt-6 rounded-lg border border-border bg-surface-elevated p-4">
            <h3 className="mb-2 text-sm font-semibold">Why create an account?</h3>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}
