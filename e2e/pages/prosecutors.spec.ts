import { test, expect } from '@playwright/test'

test.describe('Prosecutors Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/prosecutors')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading "Prosecutor Dashboard"', async ({ page }) => {
    await page.goto('/prosecutors')
    const heading = page.locator('h1')
    await expect(heading).toContainText('Prosecutor Dashboard')
  })

  test('has law enforcement badge', async ({ page }) => {
    await page.goto('/prosecutors')
    // Match the exact badge text to avoid strict mode violation with partial match
    const badge = page.getByText('For Law Enforcement & Legal Professionals')
    await expect(badge).toBeVisible()
  })

  test('has Entity Evidence Summaries section', async ({ page }) => {
    await page.goto('/prosecutors')
    const section = page.locator('h2', { hasText: 'Entity Evidence Summaries' })
    await expect(section).toBeVisible()
  })

  test('has Criminal Activity Indicators section', async ({ page }) => {
    await page.goto('/prosecutors')
    const section = page.locator('h2', { hasText: 'Criminal Activity Indicators' })
    await expect(section).toBeVisible()
  })

  test('has 6 criminal indicator category cards', async ({ page }) => {
    await page.goto('/prosecutors')
    // Check for the 6 categories
    for (const category of ['Trafficking', 'Obstruction', 'Conspiracy', 'Financial Crimes', 'Witness Tampering', 'Exploitation']) {
      const card = page.locator('h3', { hasText: category })
      await expect(card).toBeVisible()
    }
  })

  test('has Most-Flagged Documents section', async ({ page }) => {
    await page.goto('/prosecutors')
    const section = page.locator('h2', { hasText: 'Most-Flagged Documents' })
    await expect(section).toBeVisible()
  })

  test('has Risk Scoring Methodology section', async ({ page }) => {
    await page.goto('/prosecutors')
    const section = page.locator('h2', { hasText: 'Risk Scoring Methodology' })
    await expect(section).toBeVisible()
  })

  test('methodology explains anti-guilt-by-association safeguards', async ({ page }) => {
    await page.goto('/prosecutors')
    const body = await page.textContent('body')
    expect(body).toContain('Anti-Guilt-by-Association Safeguards')
    expect(body).toContain('14 of 20 relationship types contribute zero')
    expect(body).toContain('guilt-by-association firewall')
  })

  test('methodology explains evidence score', async ({ page }) => {
    await page.goto('/prosecutors')
    const body = await page.textContent('body')
    expect(body).toContain('Evidence Score (max 2.0)')
    expect(body).toContain('Relationship Score (max 1.5)')
    expect(body).toContain('Indicator Score (max 1.5)')
  })

  test('has Export Evidence Package button (disabled)', async ({ page }) => {
    await page.goto('/prosecutors')
    const button = page.locator('button', { hasText: 'Export Evidence Package' })
    await expect(button).toBeVisible()
    await expect(button).toBeDisabled()
  })

  test('has Verification & Chain of Custody section', async ({ page }) => {
    await page.goto('/prosecutors')
    const section = page.locator('text=Verification & Chain of Custody')
    await expect(section).toBeVisible()
  })

  test('has Legal Inquiries section', async ({ page }) => {
    await page.goto('/prosecutors')
    const section = page.locator('text=Legal Inquiries')
    await expect(section).toBeVisible()
  })

  test('responsive: renders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const res = await page.goto('/prosecutors')
    expect(res?.status()).toBeLessThan(500)
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
  })

  test('static content has sufficient length', async ({ page }) => {
    await page.goto('/prosecutors')
    const text = await page.textContent('body')
    // The methodology section alone is several hundred characters
    expect(text!.length).toBeGreaterThan(500)
  })
})
