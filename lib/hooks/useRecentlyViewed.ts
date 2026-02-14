'use client'

import { useState, useEffect, useCallback } from 'react'

export interface RecentItem {
  id: string
  title: string
  type: 'document' | 'entity' | 'search'
  href: string
  timestamp: number
}

const STORAGE_KEY = 'ecr_recently_viewed'
const MAX_ITEMS = 5

function loadItems(): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([])

  useEffect(() => {
    setItems(loadItems())
  }, [])

  const addItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id)
      const next = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { items, addItem }
}
