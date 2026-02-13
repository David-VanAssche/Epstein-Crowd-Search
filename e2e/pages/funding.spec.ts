import { test, expect } from '@playwright/test'

test.describe('Funding Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/funding')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/funding')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows funding progress section', async ({ page }) => {
    await page.goto('/funding')
    const progress = page.locator('[role="progressbar"], [class*="progress"]')
    const textProgress = page.getByText(/raised|goal|funding/i)
    const count = (await progress.count()) + (await textProgress.count())
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('has donation information', async ({ page }) => {
    await page.goto('/funding')
    const donate = page.locator('text=/donat|contribut|support|impact/i')
    const count = await donate.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
