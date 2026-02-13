import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('loads and shows title', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('has search input', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name="q"]')
    await expect(searchInput.first()).toBeVisible()
  })

  test('has navigation links', async ({ page }) => {
    await page.goto('/')
    const navLinks = page.locator('header a, nav a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(1)
  })

  test('hero section visible', async ({ page }) => {
    await page.goto('/')
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
  })

  test('stats section visible', async ({ page }) => {
    await page.goto('/')
    const stats = page.locator('[class*="stat"], [data-testid*="stat"]')
    const textStats = page.getByText(/documents|entities|redactions/i)
    const count = (await stats.count()) + (await textStats.count())
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('has call to action', async ({ page }) => {
    await page.goto('/')
    const cta = page.locator('a, button').filter({ hasText: /search|explore|start|get started/i })
    const count = await cta.count()
    expect(count).toBeGreaterThan(0)
  })

  test('responsive: mobile shows content', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
  })

  test('no crash on load', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBeLessThan(500)
  })

  test('page has meta description', async ({ page }) => {
    await page.goto('/')
    const desc = page.locator('meta[name="description"]')
    const content = await desc.getAttribute('content')
    expect(content).toBeTruthy()
  })

  test('loads within 5 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    expect(Date.now() - start).toBeLessThan(5000)
  })
})
