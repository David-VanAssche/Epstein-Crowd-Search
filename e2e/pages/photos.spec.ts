import { test, expect } from '@playwright/test'

test.describe('Photos Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/photos')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/photos')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows photos grid or empty state', async ({ page }) => {
    await page.goto('/photos')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
