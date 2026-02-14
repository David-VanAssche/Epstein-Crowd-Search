const ROUTE_LABELS: Record<string, string> = {
  search: 'Search',
  entities: 'Entities',
  entity: 'Entity',
  graph: 'Graph',
  map: 'Map',
  chat: 'Chat',
  sources: 'Documents',
  flights: 'Flights',
  emails: 'Emails',
  finances: 'Finances',
  photos: 'Photos',
  audio: 'Audio',
  redactions: 'Redactions',
  contradictions: 'Contradictions',
  discoveries: 'Discoveries',
  pinboard: 'Pinboard',
  timeline: 'Timeline',
  analysis: 'Analysis',
  stats: 'Stats',
  document: 'Document',
  profile: 'Profile',
  bookmarks: 'Bookmarks',
  funding: 'Funding',
  about: 'About',
  cascade: 'Cascade',
  'saved-searches': 'Saved Searches',
}

export interface BreadcrumbItem {
  label: string
  href: string
}

export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === '/') return []

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: BreadcrumbItem[] = []

  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = ROUTE_LABELS[segment] ?? formatSegment(segment)
    crumbs.push({ label, href: currentPath })
  }

  return crumbs
}

function formatSegment(segment: string): string {
  // If it looks like a UUID or ID, truncate it
  if (segment.length > 20 || /^[0-9a-f-]{8,}$/i.test(segment)) {
    return segment.slice(0, 8) + '...'
  }
  // Convert kebab-case to Title Case
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
