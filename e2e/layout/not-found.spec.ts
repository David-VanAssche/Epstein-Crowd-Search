import { test, expect } from '@playwright/test'

test.describe('404 Not Found', () => {
  test('shows 404 for /nonexistent-page', async ({ page }) => {
    const res = await page.goto('/nonexistent-page-12345')
    expect(res?.status()).toBe(404)
  })

  test('has not found message', async ({ page }) => {
    await page.goto('/nonexistent-page-12345')
    const msg = page.locator('text=/not found|404|doesn\'t exist/i')
    await expect(msg.first()).toBeVisible()
  })

  test('has link back to home', async ({ page }) => {
    await page.goto('/nonexistent-page-12345')
    const link = page.locator('a[href="/"], a:has-text("home"), a:has-text("back")')
    await expect(link.first()).toBeVisible()
  })

  test('page title is set on not-found page', async ({ page }) => {
    await page.goto('/nonexistent-page-12345')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('no server error (not 500)', async ({ page }) => {
    const res = await page.goto('/nonexistent-page-12345')
    expect(res?.status()).not.toBe(500)
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/nonexistent-page-12345')
    const msg = page.locator('text=/not found|404/i')
    await expect(msg.first()).toBeVisible()
  })
})
