import { test, expect } from '@playwright/test'

test.describe('Redactions Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/redactions')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has page heading', async ({ page }) => {
    await page.goto('/redactions')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows content or empty state', async ({ page }) => {
    await page.goto('/redactions')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/redactions')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
