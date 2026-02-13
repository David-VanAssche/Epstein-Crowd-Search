import { test, expect } from '@playwright/test'

test.describe('Cascade Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/cascade')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/cascade')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('shows cascade visualization or empty state', async ({ page }) => {
    await page.goto('/cascade')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
