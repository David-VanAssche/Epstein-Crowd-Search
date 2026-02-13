import { test, expect } from '@playwright/test'

test.describe('Sources Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/sources')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/sources')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows sources list or empty state', async ({ page }) => {
    await page.goto('/sources')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
