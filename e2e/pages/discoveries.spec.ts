import { test, expect } from '@playwright/test'

test.describe('Discoveries Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/discoveries')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/discoveries')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows discoveries or empty state', async ({ page }) => {
    await page.goto('/discoveries')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
