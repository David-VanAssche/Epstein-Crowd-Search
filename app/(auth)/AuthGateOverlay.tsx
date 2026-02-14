'use client'

import { useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

export function AuthGateOverlay() {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <>
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <div className="text-center space-y-4 bg-background/80 backdrop-blur-sm rounded-lg p-8 border border-border max-w-sm mx-4">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Sign in required</h2>
          <p className="text-sm text-muted-foreground">
            This feature requires an account. Sign in to contribute, save searches, and track your investigation.
          </p>
          <Button onClick={() => setShowAuth(true)} className="w-full">
            Sign In
          </Button>
        </div>
      </div>
      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        contextMessage="Sign in to access this feature"
      />
    </>
  )
}
