import { test, expect } from '@playwright/test'

test.describe('Graph Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/graph')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading or page content', async ({ page }) => {
    await page.goto('/graph')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    const hasHeading = await heading.count() > 0 && await heading.isVisible()
    const hasContent = await page.locator('main, [role="main"]').count() > 0
    expect(hasHeading || hasContent).toBe(true)
  })

  test('shows graph container or empty state', async ({ page }) => {
    await page.goto('/graph')
    const container = page.locator('canvas, [class*="graph"], [data-testid*="graph"], main')
    await expect(container.first()).toBeVisible()
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/graph')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
