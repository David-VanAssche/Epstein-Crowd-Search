'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { TopBar } from '@/components/layout/TopBar'
import { ChatProvider } from '@/components/providers/ChatProvider'
import { ChatFloatingPanel } from '@/components/chat/ChatFloatingPanel'
import { CommandPalette } from '@/components/layout/CommandPalette'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarInset>
          <TopBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <ChatFloatingPanel />
      <CommandPalette />
    </ChatProvider>
  )
}
