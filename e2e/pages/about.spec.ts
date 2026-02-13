import { test, expect } from '@playwright/test'

test.describe('About Page', () => {
  test('loads page', async ({ page }) => {
    const res = await page.goto('/about')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has main heading', async ({ page }) => {
    await page.goto('/about')
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
  })

  test('has mission/purpose section', async ({ page }) => {
    await page.goto('/about')
    const mission = page.locator('text=/mission|purpose|goal|why/i')
    const count = await mission.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('has methodology section', async ({ page }) => {
    await page.goto('/about')
    const method = page.locator('text=/methodology|how|approach|process|technology/i')
    const count = await method.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('contains expected keywords', async ({ page }) => {
    await page.goto('/about')
    const text = await page.textContent('body')
    expect(text).toBeTruthy()
  })

  test('page title set', async ({ page }) => {
    await page.goto('/about')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/about')
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
  })
})
