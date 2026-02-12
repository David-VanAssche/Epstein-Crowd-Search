// lib/hooks/useRandomDocument.ts
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

export function useRandomDocument() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const goToRandom = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/document/random')
      if (!res.ok) throw new Error('Failed to get random document')
      const { id } = await res.json()
      router.push(`/document/${id}`)
    } catch {
      // Fallback: show alert if API doesn't exist yet
      alert('Random document feature requires document processing. Check back after funding!')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  return { goToRandom, isLoading }
}
