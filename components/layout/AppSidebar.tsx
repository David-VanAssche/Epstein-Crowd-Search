'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  BookUser,
  Scale,
  Workflow,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { UserMenu } from '@/components/auth/UserMenu'
import { FundingSidebarWidget } from '@/components/funding/FundingSidebarWidget'

const NAV_GROUPS = [
  {
    label: 'Investigate',
    items: [
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/search', label: 'Search', icon: Search },
      { href: '/entities', label: 'Entities', icon: Users },
      { href: '/graph', label: 'Graph', icon: Network },
      { href: '/map', label: 'Map', icon: Globe },
    ],
  },
  {
    label: 'Browse',
    items: [
      { href: '/sources', label: 'Documents', icon: FileText },
      { href: '/flights', label: 'Flights', icon: Plane },
      { href: '/emails', label: 'Emails', icon: Mail },
      { href: '/finances', label: 'Finances', icon: DollarSign },
      { href: '/photos', label: 'Photos', icon: Camera },
      { href: '/audio', label: 'Audio', icon: Headphones },
      { href: '/black-book', label: 'Black Book', icon: BookUser },
    ],
  },
  {
    label: 'Collaborate',
    items: [
      { href: '/redactions', label: 'Redactions', icon: EyeOff },
      { href: '/contradictions', label: 'Contradictions', icon: AlertTriangle },
      { href: '/discoveries', label: 'Discoveries', icon: Sparkles },
      { href: '/pinboard', label: 'Pinboard', icon: Pin },
    ],
  },
  {
    label: 'Analyze',
    items: [
      { href: '/timeline', label: 'Timeline', icon: Clock },
      { href: '/analysis', label: 'Analysis', icon: BarChart3 },
      { href: '/pipeline', label: 'Pipeline', icon: Workflow },
      { href: '/stats', label: 'Stats', icon: Activity },
      { href: '/prosecutors', label: 'Prosecutors', icon: Scale },
    ],
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Epstein Crowd Research">
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
                  ECR
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Epstein Crowd Research</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Open Investigation</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <FundingSidebarWidget />
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
