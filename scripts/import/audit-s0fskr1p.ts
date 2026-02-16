import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface PatternStats {
  pattern: string
  description: string
  count: number
  examples: Array<{ context: string; lineNumber: number }>
}

async function listDirectory(path: string) {
  const { data, error } = await supabase.storage
    .from('raw-archive')
    .list(path, { limit: 100 })

  if (error) {
    console.error(`Error listing ${path}:`, error)
    return []
  }

  return data || []
}

async function downloadFile(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('raw-archive')
    .download(path)

  if (error) {
    console.error(`Error downloading ${path}:`, error)
    return null
  }

  return await data.text()
}

function analyzePatterns(content: string): PatternStats[] {
  const lines = content.split('\n')

  const patterns: Array<{ regex: RegExp; description: string }> = [
    { regex: /^-{3,}$/m, description: 'Triple dash (---) delimiters' },
    { regex: /^={3,}$/m, description: 'Triple equals (===) delimiters' },
    { regex: /^\*{3,}$/m, description: 'Triple asterisk (***) delimiters' },
    { regex: /EFTA\d{8}/g, description: 'EFTA numbers (EFTA########)' },
    { regex: /\bPage\s+\d+/gi, description: 'Page numbers (Page N)' },
    { regex: /\f/g, description: 'Form feed characters' },
    { regex: /^Document:/mi, description: 'Document: markers' },
    { regex: /^Filename:/mi, description: 'Filename: markers' },
    { regex: /^File:/mi, description: 'File: markers' },
    { regex: /^Source:/mi, description: 'Source: markers' },
    { regex: /^\[PAGE \d+\]/mi, description: '[PAGE N] markers' },
    { regex: /^-{10,}$/m, description: 'Long dash lines (10+ dashes)' },
  ]

  const stats: PatternStats[] = []

  for (const { regex, description } of patterns) {
    const matches: Array<{ context: string; lineNumber: number }> = []

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        const start = Math.max(0, i - 2)
        const end = Math.min(lines.length, i + 3)
        const context = lines.slice(start, end)
          .map((l, idx) => {
            const lineNum = start + idx + 1
            const marker = lineNum === i + 1 ? '>>> ' : '    '
            return `${marker}${lineNum}: ${l.slice(0, 120)}`
          })
          .join('\n')

        matches.push({ context, lineNumber: i + 1 })
      }
      // Reset regex lastIndex for global patterns
      regex.lastIndex = 0
    }

    if (matches.length > 0) {
      stats.push({
        pattern: regex.source,
        description,
        count: matches.length,
        examples: matches.slice(0, 3),
      })
    }
  }

  return stats
}

async function main() {
  console.log('='.repeat(80))
  console.log('S0FSKR1P OCR AUDIT - Boundary Marker Detection')
  console.log('='.repeat(80))
  console.log()

  // Step 1: List subdirectories
  console.log('Listing s0fskr1p subdirectories...')
  const subdirs = await listDirectory('github/s0fskr1p')
  console.log(`Found ${subdirs.length} items in github/s0fskr1p/`)
  console.log()

  const sampleFiles: string[] = []

  // Step 2: Get first .txt file from each subdirectory
  for (const item of subdirs) {
    if (!item.name) continue

    const subPath = `github/s0fskr1p/${item.name}`
    const files = await listDirectory(subPath)

    const txtFile = files.find(f => f.name?.endsWith('.txt'))
    if (txtFile) {
      const filePath = `${subPath}/${txtFile.name}`
      sampleFiles.push(filePath)
      console.log(`Selected: ${filePath}`)
    }

    if (sampleFiles.length >= 5) break
  }

  console.log(`\nSelected ${sampleFiles.length} sample files`)
  console.log('='.repeat(80))

  // Step 3: Download and analyze each file
  const results: Array<{
    path: string
    size: number
    lineCount: number
    patterns: PatternStats[]
  }> = []

  for (const filePath of sampleFiles) {
    console.log(`\nANALYZING: ${filePath}`)
    console.log('-'.repeat(80))

    const content = await downloadFile(filePath)
    if (!content) {
      console.log('Failed to download, skipping...')
      continue
    }

    const size = Buffer.byteLength(content, 'utf8')
    const lineCount = content.split('\n').length

    console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Lines: ${lineCount.toLocaleString()}`)
    console.log()

    const patterns = analyzePatterns(content)

    if (patterns.length === 0) {
      console.log('No boundary markers found.')
    } else {
      console.log('PATTERNS FOUND:\n')

      for (const stat of patterns) {
        console.log(`${stat.description}: ${stat.count.toLocaleString()} occurrences`)
        console.log()

        for (let i = 0; i < Math.min(3, stat.examples.length); i++) {
          const example = stat.examples[i]
          console.log(`  Example ${i + 1} (line ${example.lineNumber}):`)
          console.log(example.context)
          console.log()
        }
      }
    }

    results.push({ path: filePath, size, lineCount, patterns })
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80) + '\n')

  for (const result of results) {
    const fileName = result.path.split('/').pop()
    console.log(`${fileName}:`)
    console.log(`  Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Lines: ${result.lineCount.toLocaleString()}`)

    if (result.patterns.length === 0) {
      console.log(`  Markers: None found`)
      console.log(`  Recommendation: MERGED-ONLY (no clear document boundaries)`)
    } else {
      console.log(`  Markers found:`)
      for (const pattern of result.patterns) {
        console.log(`    - ${pattern.description}: ${pattern.count.toLocaleString()}`)
      }

      const hasEFTA = result.patterns.some(p => p.description.includes('EFTA'))
      const bestMarker = result.patterns.reduce((max, p) =>
        p.count > max.count ? p : max,
        result.patterns[0]
      )

      console.log(`  Estimated docs: ~${bestMarker.count.toLocaleString()} (based on ${bestMarker.description})`)
      console.log(`  EFTA numbers: ${hasEFTA ? 'YES - enables direct mapping to DOJ documents' : 'NO'}`)
      console.log(`  Recommendation: ${hasEFTA ? 'SPLITTABLE (EFTA mapping available)' : 'POTENTIALLY SPLITTABLE (inspect examples)'}`)
    }

    console.log()
  }

  console.log('='.repeat(80))
  console.log('AUDIT COMPLETE')
  console.log('='.repeat(80))
}

main().catch(console.error)
