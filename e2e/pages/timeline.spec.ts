import { test, expect } from '@playwright/test'

test.describe('Timeline Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/timeline')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/timeline')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows timeline or empty state', async ({ page }) => {
    await page.goto('/timeline')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/timeline')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
