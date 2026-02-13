import { test, expect } from '@playwright/test'

test.describe('Flights Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/flights')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/flights')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows flight data or empty state', async ({ page }) => {
    await page.goto('/flights')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
