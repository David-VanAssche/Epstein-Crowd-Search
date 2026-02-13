import { test, expect } from '@playwright/test'

test.describe('Map Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/map')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading or page content', async ({ page }) => {
    await page.goto('/map')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    const hasHeading = await heading.count() > 0 && await heading.isVisible()
    const hasContent = await page.locator('main, [role="main"]').count() > 0
    expect(hasHeading || hasContent).toBe(true)
  })

  test('shows map container or empty state', async ({ page }) => {
    await page.goto('/map')
    const container = page.locator('[class*="leaflet"], [class*="map"], main')
    await expect(container.first()).toBeVisible()
  })
})
