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

/**
 * Optional overrides for dynamic segments (e.g., entity UUIDs → entity names).
 * Key is the full path segment, value is the display label.
 */
let dynamicLabels: Record<string, string> = {}

export function setBreadcrumbLabel(segment: string, label: string) {
  dynamicLabels = { ...dynamicLabels, [segment]: label }
}

export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === '/') return []

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: BreadcrumbItem[] = []

  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = dynamicLabels[segment] ?? ROUTE_LABELS[segment] ?? formatSegment(segment)
    crumbs.push({ label, href: currentPath })
  }

  return crumbs
}

function formatSegment(segment: string): string {
  // If it looks like a UUID or ID, return empty — will be filled by setBreadcrumbLabel()
  if (segment.length > 20 || /^[0-9a-f-]{8,}$/i.test(segment)) {
    return ''
  }
  // Convert kebab-case to Title Case
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
