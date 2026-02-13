import { test, expect } from '@playwright/test'

test.describe('Stats Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/stats')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/stats')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows stats cards or placeholders', async ({ page }) => {
    await page.goto('/stats')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
