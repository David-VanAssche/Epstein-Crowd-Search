// lib/hooks/useRandomDocument.ts
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { fetchApi } from '@/lib/api/client'

export function useRandomDocument() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const goToRandom = useCallback(async () => {
    setIsLoading(true)
    try {
      const doc = await fetchApi<{ id: string }>('/api/random-document')
      router.push(`/document/${doc.id}`)
    } catch {
      alert('Random document feature requires document processing. Check back after funding!')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  return { goToRandom, isLoading }
}
