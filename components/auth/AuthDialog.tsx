'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/hooks/useAuth'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contextMessage?: string
  defaultTab?: 'sign-in' | 'sign-up'
}

export function AuthDialog({ open, onOpenChange, contextMessage, defaultTab = 'sign-in' }: AuthDialogProps) {
  const [tab, setTab] = useState<string>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const { signInWithEmail, signUpWithEmail } = useAuth()

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
      onOpenChange(false)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tab === 'sign-in' ? 'Sign In' : 'Create Account'}</DialogTitle>
          <DialogDescription>
            {contextMessage ??
              'Join the investigation. Contribute, save searches, and earn recognition.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sign-in">Sign In</TabsTrigger>
            <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
          </TabsList>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive mt-4">
              {error}
            </div>
          )}

          <TabsContent value="sign-in">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="auth-signin-email">Email</Label>
                <Input
                  id="auth-signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="auth-signin-password">Password</Label>
                <Input
                  id="auth-signin-password"
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
                  <Label htmlFor="auth-signup-email">Email</Label>
                  <Input
                    id="auth-signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="auth-signup-password">Password</Label>
                  <Input
                    id="auth-signup-password"
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
      </DialogContent>
    </Dialog>
  )
}
