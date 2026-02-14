'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageSquare,
  Search,
  Users,
  Network,
  Globe,
  FileText,
  Plane,
  Mail,
  DollarSign,
  Camera,
  Headphones,
  EyeOff,
  AlertTriangle,
  Sparkles,
  Pin,
  Clock,
  BarChart3,
  Activity,
  PanelLeft,
  Shuffle,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useSidebar } from '@/components/ui/sidebar'
import { useChatPanel } from '@/components/providers/ChatProvider'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Activity, group: 'Navigation' },
  { href: '/chat', label: 'Chat', icon: MessageSquare, group: 'Investigate' },
  { href: '/search', label: 'Search', icon: Search, group: 'Investigate' },
  { href: '/entities', label: 'Entities', icon: Users, group: 'Investigate' },
  { href: '/graph', label: 'Graph', icon: Network, group: 'Investigate' },
  { href: '/map', label: 'Map', icon: Globe, group: 'Investigate' },
  { href: '/sources', label: 'Documents', icon: FileText, group: 'Browse' },
  { href: '/flights', label: 'Flights', icon: Plane, group: 'Browse' },
  { href: '/emails', label: 'Emails', icon: Mail, group: 'Browse' },
  { href: '/finances', label: 'Finances', icon: DollarSign, group: 'Browse' },
  { href: '/photos', label: 'Photos', icon: Camera, group: 'Browse' },
  { href: '/audio', label: 'Audio', icon: Headphones, group: 'Browse' },
  { href: '/redactions', label: 'Redactions', icon: EyeOff, group: 'Collaborate' },
  { href: '/contradictions', label: 'Contradictions', icon: AlertTriangle, group: 'Collaborate' },
  { href: '/discoveries', label: 'Discoveries', icon: Sparkles, group: 'Collaborate' },
  { href: '/pinboard', label: 'Pinboard', icon: Pin, group: 'Collaborate' },
  { href: '/timeline', label: 'Timeline', icon: Clock, group: 'Analyze' },
  { href: '/analysis', label: 'Analysis', icon: BarChart3, group: 'Analyze' },
  { href: '/stats', label: 'Stats', icon: Activity, group: 'Analyze' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { toggleSidebar } = useSidebar()
  const { togglePanel: toggleChat } = useChatPanel()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleChat()
      }
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        router.push('/search')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleChat, router])

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    []
  )

  // Group navigation items
  const groups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>(
    (acc, item) => {
      if (!acc[item.group]) acc[item.group] = []
      acc[item.group].push(item)
      return acc
    },
    {}
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {Object.entries(groups).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.href}
                  onSelect={() => runCommand(() => router.push(item.href))}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(toggleSidebar)}
          >
            <PanelLeft className="mr-2 h-4 w-4" />
            Toggle Sidebar
            <CommandShortcut>Cmd+B</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(toggleChat)}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Toggle Chat
            <CommandShortcut>Cmd+J</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => router.push('/search'))
            }
          >
            <Search className="mr-2 h-4 w-4" />
            Focus Search
            <CommandShortcut>Cmd+/</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => router.push('/sources?random=1'))
            }
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Random Document
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
