// lib/data/government-officials.ts
// Curated lists of government officials relevant to the Epstein investigation.
// Used by congressional-scorer.ts for cross-referencing entity mentions.
// Names are lowercase for case-insensitive matching.

export interface OfficialEntry {
  name: string
  role: string
  branch: 'executive' | 'legislative' | 'judicial' | 'law_enforcement' | 'intelligence'
}

export const GOVERNMENT_OFFICIALS: OfficialEntry[] = [
  // Law enforcement / DOJ
  { name: 'alexander acosta', role: 'US Attorney / Labor Secretary', branch: 'executive' },
  { name: 'robert mueller', role: 'FBI Director', branch: 'law_enforcement' },
  { name: 'james comey', role: 'FBI Director', branch: 'law_enforcement' },
  { name: 'barry krischer', role: 'State Attorney Palm Beach', branch: 'law_enforcement' },
  { name: 'marie villafaña', role: 'AUSA Southern District of Florida', branch: 'law_enforcement' },
  { name: 'ann marie mciver', role: 'AUSA', branch: 'law_enforcement' },
  { name: 'geoffrey berman', role: 'US Attorney SDNY', branch: 'law_enforcement' },
  { name: 'maurene comey', role: 'AUSA SDNY', branch: 'law_enforcement' },
  { name: 'william barr', role: 'Attorney General', branch: 'executive' },
  { name: 'loretta lynch', role: 'Attorney General', branch: 'executive' },
  { name: 'eric holder', role: 'Attorney General', branch: 'executive' },
  { name: 'alberto gonzales', role: 'Attorney General', branch: 'executive' },
  // Judiciary
  { name: 'richard berman', role: 'US District Judge SDNY', branch: 'judicial' },
  { name: 'kenneth marra', role: 'US District Judge SDFL', branch: 'judicial' },
  { name: 'loretta preska', role: 'US District Judge SDNY', branch: 'judicial' },
  { name: 'alison nathan', role: 'US District Judge SDNY', branch: 'judicial' },
  // Legislative
  { name: 'chuck grassley', role: 'Senator', branch: 'legislative' },
  { name: 'ben sasse', role: 'Senator', branch: 'legislative' },
  { name: 'tim scott', role: 'Senator', branch: 'legislative' },
  // Intelligence
  { name: 'robert maxwell', role: 'Alleged Mossad connection', branch: 'intelligence' },
  // Executive - Presidents and staff mentioned in documents
  { name: 'bill clinton', role: 'President', branch: 'executive' },
  { name: 'donald trump', role: 'President', branch: 'executive' },
  { name: 'andrew cuomo', role: 'Governor', branch: 'executive' },
  { name: 'bill richardson', role: 'Governor / UN Ambassador', branch: 'executive' },
  { name: 'george mitchell', role: 'Senator / Special Envoy', branch: 'legislative' },
  // Foreign officials referenced in documents
  { name: 'prince andrew', role: 'Duke of York', branch: 'executive' },
  { name: 'ehud barak', role: 'Prime Minister of Israel', branch: 'executive' },
]

/** Set of lowercase official names for fast lookup */
export const OFFICIAL_NAMES_SET = new Set(
  GOVERNMENT_OFFICIALS.map((o) => o.name.toLowerCase())
)

/** Check if a name matches a known government official */
export function isGovernmentOfficial(name: string): OfficialEntry | undefined {
  const normalized = name.trim().toLowerCase()
  return GOVERNMENT_OFFICIALS.find((o) => o.name === normalized)
}
