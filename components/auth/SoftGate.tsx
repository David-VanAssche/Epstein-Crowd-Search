'use client'

import { useState, cloneElement, isValidElement } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { AuthDialog } from './AuthDialog'

interface SoftGateProps {
  action: string
  children: React.ReactElement<{ onClick?: (...args: unknown[]) => void }>
}

export function SoftGate({ action, children }: SoftGateProps) {
  const { user } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  if (user) {
    return children
  }

  return (
    <>
      {isValidElement(children) &&
        cloneElement(children, {
          onClick: (e: unknown) => {
            if (e && typeof e === 'object' && 'preventDefault' in e) {
              (e as Event).preventDefault()
            }
            setShowAuth(true)
          },
        })}
      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        contextMessage={`Sign in to ${action}`}
      />
    </>
  )
}
