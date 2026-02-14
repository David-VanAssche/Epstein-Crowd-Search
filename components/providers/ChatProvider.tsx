'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface ChatProviderState {
  isPanelOpen: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
}

const ChatContext = createContext<ChatProviderState | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])
  const togglePanel = useCallback(() => setIsPanelOpen((prev) => !prev), [])

  return (
    <ChatContext.Provider value={{ isPanelOpen, openPanel, closePanel, togglePanel }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatPanel() {
  const context = useContext(ChatContext)
  if (!context) {
    // Return safe defaults during SSR/prerendering
    return {
      isPanelOpen: false,
      openPanel: () => {},
      closePanel: () => {},
      togglePanel: () => {},
    }
  }
  return context
}
