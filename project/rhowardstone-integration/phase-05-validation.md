# Phase 5: Validation

> **Status:** Not started
> **Estimated effort:** 8-12 hours
> **Depends on:** All previous phases

## Goal

Verify that all imported data is correct, all methodology upgrades produce reliable results, and all new UI features work end-to-end. Establish regression tests to catch issues during future pipeline runs.

## Tasks

### 5.1 Data Import Verification

**Script:** `scripts/import/verify-rhowardstone-import.ts`

Run comprehensive checks against known ground truth:

```typescript
// Check 1: OCR text completeness
// Compare our chunk count against rhowardstone's page count
const ourChunks = await supabase.from('chunks')
  .select('count', { count: 'exact' })
  .eq('ocr_source', 'rhowardstone');
console.log(`Our chunks: ${ourChunks.count}, Expected: ~500K`);

// Check 2: Entity import completeness
const ourEntities = await supabase.from('entities')
  .select('count', { count: 'exact' })
  .eq('provenance_source', 'rhowardstone');
console.log(`Our entities: ${ourEntities.count}, Expected: ~1,600+`);

// Check 3: Spot-check 10 random entities for data integrity
// Verify name, type, role match rhowardstone source

// Check 4: Relationship integrity
// Verify both entity_a_id and entity_b_id exist for all imported relationships

// Check 5: Redaction filtering effectiveness
// Count spatial vs. OCR-layer vs. filtered-out records
// Expected: ~98% of OCR-layer records should be filtered

// Check 6: Pipeline stage tracking
// Documents with rhowardstone OCR should have 'ocr' in completed_stages
```

### 5.2 Methodology Upgrade Testing

**Test spatial redaction detection against known redacted pages:**

```typescript
// Known test cases from rhowardstone's analysis:
const knownRedactions = [
  { efta: 'EFTA00045123', page: 3, expectedCount: 2, type: 'name_redaction' },
  { efta: 'EFTA00012456', page: 1, expectedCount: 5, type: 'full_line' },
  { efta: 'EFTA00078901', page: 7, expectedCount: 1, type: 'paragraph_block' },
  // ... more test cases
];

for (const tc of knownRedactions) {
  const result = await detectSpatialRedactions(tc.pdfBuffer, tc.page);
  assert(result.length === tc.expectedCount,
    `${tc.efta} page ${tc.page}: expected ${tc.expectedCount} redactions, got ${result.length}`);
}
```

**Test noise filter accuracy:**

```typescript
// Known noise samples (should be filtered)
const noiseSamples = [
  'fjkl asdf qwer zxcv',           // Random keyboard mash
  '|||///\\\\####',                  // OCR artifacts
  'aaaaabbbbccccddddeeee',          // Repeated chars
];

// Known real text (should NOT be filtered)
const realSamples = [
  'The defendant traveled to New York on March 15, 2005.',
  'Payment of $50,000 was wired to account ending 4523.',
  'Jeffrey Epstein',
];

for (const noise of noiseSamples) {
  assert(isLikelyOcrNoise(noise) === true, `Should be noise: "${noise}"`);
}
for (const real of realSamples) {
  assert(isLikelyOcrNoise(real) === false, `Should be real: "${real}"`);
}
```

### 5.3 UI Feature Verification

Manual testing checklist:

**Reports page (`/reports`):**
- [ ] Page loads with imported reports
- [ ] Congressional score badges display correctly
- [ ] Filtering by tag works
- [ ] Score range slider filters correctly
- [ ] Entity search finds reports mentioning a specific person
- [ ] Individual report view renders markdown correctly
- [ ] Entity names in reports link to entity dossier pages
- [ ] Document references link to document viewer

**Researcher's guide (`/start-here`):**
- [ ] Priority tiers show correct counts
- [ ] Critical tier highlights the most important documents
- [ ] Reading paths are navigable
- [ ] Works on mobile (accordion layout)

**Redaction quality badges:**
- [ ] Spatial detection badge shows for known spatial redactions
- [ ] OCR layer badge shows for OCR-detected redactions
- [ ] LLM badge shows for LLM-detected redactions
- [ ] "Corroborated" badge shows when multiple methods agree
- [ ] Tooltips explain each method

**DOJ source links:**
- [ ] Links appear on document viewer
- [ ] Links point to correct DOJ dataset URLs
- [ ] SHA-256 verification badge shows when verified

**Media browser:**
- [ ] Images tab shows imported images
- [ ] Grid lazy-loads thumbnails
- [ ] Image detail view shows rhowardstone analysis
- [ ] Videos and audio tabs work
- [ ] Sidebar shows "Media" not "Audio"

**Audit trail:**
- [ ] Shows on entity dossier page
- [ ] Import-created corrections appear with correct timestamps
- [ ] Correction badge shows on entity cards

### 5.4 Regression Test Suite

**New file:** `__tests__/integration/rhowardstone-import.test.ts`

Vitest integration tests that run against the test database:

```typescript
describe('rhowardstone data integrity', () => {
  test('imported OCR chunks reference valid documents', async () => {
    const orphans = await supabase.rpc('count_orphan_chunks', { source: 'rhowardstone' });
    expect(orphans).toBe(0);
  });

  test('imported entities have normalized names', async () => {
    const unnormalized = await supabase
      .from('entities')
      .select('id')
      .eq('provenance_source', 'rhowardstone')
      .is('name_normalized', null);
    expect(unnormalized.data?.length).toBe(0);
  });

  test('imported relationships reference existing entities', async () => {
    const broken = await supabase.rpc('count_broken_relationships', { source: 'rhowardstone' });
    expect(broken).toBe(0);
  });

  test('no PII in public entity view', async () => {
    // Query as anon user
    const entities = await anonClient
      .from('entities_public')
      .select('metadata_safe')
      .limit(100);
    for (const e of entities.data!) {
      expect(e.metadata_safe).not.toHaveProperty('phone');
      expect(e.metadata_safe).not.toHaveProperty('address');
      expect(e.metadata_safe).not.toHaveProperty('email');
    }
  });

  test('noise filter removes >95% of OCR-layer redaction text', async () => {
    // Check filtered vs. total ratio
    const stats = await supabase.rpc('redaction_filter_stats');
    expect(stats.filtered_ratio).toBeGreaterThan(0.95);
  });
});
```

### 5.5 Provenance Tracking Verification

Verify that all imported data carries correct provenance:

```sql
-- All rhowardstone chunks have provenance
SELECT count(*) FROM chunks
WHERE ocr_source = 'rhowardstone' AND provenance_source IS NULL;
-- Expected: 0

-- All rhowardstone entities have provenance
SELECT count(*) FROM entities
WHERE provenance_source = 'rhowardstone';
-- Expected: matches import count

-- UI displays provenance badges
-- Manual check: entity dossier page shows [Imported] badge for rhowardstone entities
```

## Checklist

- [ ] 5.1 Data import verification script passes
- [ ] 5.2 Spatial redaction test cases pass
- [ ] 5.2 Noise filter accuracy > 95% true positive, < 5% false positive
- [ ] 5.3 All UI features manually verified (sub-checklists above)
- [ ] 5.4 Regression test suite created and passing
- [ ] 5.5 Provenance tracking verified end-to-end
- [ ] Pipeline dashboard shows updated progress from rhowardstone OCR import
- [ ] No PII leakage through public API endpoints
- [ ] Performance: reports page loads in < 2s, media grid in < 3s

## Success Criteria

The integration is complete when:
1. Pipeline dashboard shows OCR stage progress reflecting rhowardstone's pre-computed OCR
2. Entity count jumped by ~1,600 with provenance badges
3. 100+ investigation reports browsable at `/reports`
4. Researchers can start at `/start-here` and follow curated reading paths
5. Redaction cards show detection method badges
6. Media browser shows 180K+ images with analysis metadata
7. All regression tests pass
8. Zero PII exposure through public endpoints
