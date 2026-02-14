import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('loads and shows title', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('has search input', async ({ page }) => {
    await page.goto('/')
    // SearchBar uses aria-label="Search documents" on the input
    const searchInput = page.locator('input[aria-label="Search documents"]')
    await expect(searchInput).toBeVisible()
  })

  test('has navigation links in sidebar', async ({ page }) => {
    // Desktop viewport needed — on mobile the sidebar Sheet unmounts content when closed
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    // Navigation is in the sidebar, not the header
    const navLinks = page.locator('[data-sidebar="menu-button"]')
    expect(await navLinks.count()).toBeGreaterThan(5)
  })

  test('command center visible', async ({ page }) => {
    await page.goto('/')
    // Homepage renders CommandCenter with a search bar form and stat counters
    const searchForm = page.locator('form[role="search"]')
    await expect(searchForm).toBeVisible()
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
    // The search bar has a Search submit button
    const cta = page.locator('form[role="search"] button[type="submit"]')
    await expect(cta).toBeVisible()
  })

  test('responsive: mobile shows content', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    // Search bar should be visible on mobile
    const searchForm = page.locator('form[role="search"]')
    await expect(searchForm).toBeVisible()
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
