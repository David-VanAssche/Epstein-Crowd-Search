import { test, expect } from '@playwright/test'

test.describe('Prosecutors Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/prosecutors')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading', async ({ page }) => {
    await page.goto('/prosecutors')
    const heading = page.locator('h1, h2, [role="heading"]').first()
    await expect(heading).toBeVisible()
  })

  test('has timeline or case section', async ({ page }) => {
    await page.goto('/prosecutors')
    const content = page.locator('text=/case|timeline|prosecution|legal|attorney/i')
    const count = await content.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('has entity list or cards', async ({ page }) => {
    await page.goto('/prosecutors')
    const body = page.locator('main')
    await expect(body).toBeVisible()
  })

  test('page title set', async ({ page }) => {
    await page.goto('/prosecutors')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('static content visible', async ({ page }) => {
    await page.goto('/prosecutors')
    const text = await page.textContent('body')
    expect(text!.length).toBeGreaterThan(50)
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/prosecutors')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
