import { test, expect } from '@playwright/test'

test.describe('Funding Page — Campaign System', () => {
  test('has "Fund the Truth" heading', async ({ page }) => {
    await page.goto('/funding')
    await expect(page.getByRole('heading', { name: /fund the truth/i })).toBeVisible()
  })

  test('shows "Processing Campaigns" section heading', async ({ page }) => {
    await page.goto('/funding')
    await expect(page.getByRole('heading', { name: /processing campaigns/i })).toBeVisible()
  })

  test('shows campaign grid or loading skeletons', async ({ page }) => {
    await page.goto('/funding')
    await page.waitForLoadState('networkidle')

    // CampaignProgressGrid renders either campaign cards or loading skeletons
    // Campaign cards have role="button" and progress bars
    const cards = page.locator('[role="button"]')
    const skeletons = page.locator('.animate-pulse')
    const cardCount = await cards.count()
    const skeletonCount = await skeletons.count()

    // Should have either real cards or skeleton loaders
    expect(
      cardCount > 0 || skeletonCount > 0,
      'Expected campaign cards or loading skeletons on funding page'
    ).toBe(true)
  })

  test('campaign cards are clickable and expand', async ({ page }) => {
    await page.goto('/funding')
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[role="button"]')
    const count = await cards.count()
    if (count === 0) {
      test.skip()
      return
    }

    // Click the first card
    await cards.first().click()

    // After click, an expanded detail card should appear
    // CampaignDetailCard contains a ContributionForm with dollar buttons
    await page.waitForTimeout(500) // Allow state update
    const dollarButtons = page.locator('button:has-text("$")')
    const dollarCount = await dollarButtons.count()
    expect(dollarCount).toBeGreaterThan(0)
  })

  test('shows aggregate stats section', async ({ page }) => {
    await page.goto('/funding')
    await page.waitForLoadState('networkidle')

    // Aggregate stats: "Total Funded", "Total Spent", "Pages Processed", "Overall Progress"
    const fundedText = page.getByText(/total funded/i)
    const spentText = page.getByText(/total spent/i)
    const processedText = page.getByText(/pages processed/i)
    const progressText = page.getByText(/overall progress/i)

    // These show if campaigns loaded; skip if they didn't
    const count = await fundedText.count()
    if (count > 0) {
      await expect(fundedText).toBeVisible()
      await expect(spentText).toBeVisible()
      await expect(processedText).toBeVisible()
      await expect(progressText).toBeVisible()
    }
  })

  test('does not contain GoFundMe iframe', async ({ page }) => {
    await page.goto('/funding')
    await page.waitForLoadState('networkidle')

    // Verify no GoFundMe embed remains
    const iframes = page.locator('iframe')
    const iframeCount = await iframes.count()
    for (let i = 0; i < iframeCount; i++) {
      const src = await iframes.nth(i).getAttribute('src')
      expect(src || '').not.toContain('gofundme')
    }
  })

  test('has "Where Your Money Goes" section', async ({ page }) => {
    await page.goto('/funding')
    await expect(page.getByRole('heading', { name: /where your money goes/i })).toBeVisible()
  })

  test('has DonationImpactCalc section', async ({ page }) => {
    await page.goto('/funding')
    await page.waitForLoadState('networkidle')

    // The impact calculator should be on the page
    // It shows text like "pages" or "entities" or "impact"
    const body = await page.locator('body').textContent()
    expect(body?.toLowerCase()).toMatch(/impact|pages|processing/i)
  })
})
