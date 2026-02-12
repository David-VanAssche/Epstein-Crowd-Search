'use client'

import { useState } from 'react'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface SidebarProps {
  children: React.ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-background transition-all duration-300',
          collapsed ? 'w-0 overflow-hidden' : 'w-sidebar',
          className
        )}
      >
        <div className="flex items-center justify-end p-2 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">{children}</ScrollArea>
      </aside>

      {/* Desktop collapsed toggle */}
      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex fixed left-2 top-[140px] z-40 h-8 w-8"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden fixed bottom-4 left-4 z-40"
          >
            Filters
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full sm:w-[340px] p-0 bg-background">
          <ScrollArea className="h-full p-4 pt-12">{children}</ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
