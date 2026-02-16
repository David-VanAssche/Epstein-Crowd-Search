'use client'

import { useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

export function AuthGateOverlay() {
  const [showAuth, setShowAuth] = useState(false)
  const [defaultTab, setDefaultTab] = useState<'sign-in' | 'sign-up'>('sign-in')

  const openWith = (tab: 'sign-in' | 'sign-up') => {
    setDefaultTab(tab)
    setShowAuth(true)
  }

  return (
    <>
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <div className="text-center space-y-4 bg-background/80 backdrop-blur-sm rounded-lg p-8 border border-border max-w-sm mx-4">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Sign in required</h2>
          <p className="text-sm text-muted-foreground">
            This feature requires an account. Sign in to contribute, save searches, and track your investigation.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openWith('sign-in')} className="flex-1">
              Sign In
            </Button>
            <Button onClick={() => openWith('sign-up')} className="flex-1">
              Sign Up
            </Button>
          </div>
        </div>
      </div>
      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        defaultTab={defaultTab}
        contextMessage="Sign in to access this feature"
      />
    </>
  )
}
