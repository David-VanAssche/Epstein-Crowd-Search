// lib/hooks/useNotifications.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPaginated } from '@/lib/api/client'
import type { Notification } from '@/types/collaboration'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const result = await fetchPaginated<Notification>('/api/notifications')
      return result.items
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000, // Poll every minute
  })

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      })
      if (!res.ok) throw new Error('Failed to mark notification as read')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      })
      if (!res.ok) throw new Error('Failed to mark all notifications as read')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    },
  })

  const notifications = data ?? []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
  }
}
