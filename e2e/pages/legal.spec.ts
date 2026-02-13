import { test, expect } from '@playwright/test'

test.describe('Legal Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/legal')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has legal content', async ({ page }) => {
    await page.goto('/legal')
    const body = page.locator('body')
    await expect(body).toBeVisible()
    const text = await page.textContent('body')
    expect(text!.length).toBeGreaterThan(100)
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/legal')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
