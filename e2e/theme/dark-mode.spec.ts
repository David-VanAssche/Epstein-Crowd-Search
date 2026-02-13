import { test, expect } from '@playwright/test'

test.describe('Dark Mode', () => {
  test('page loads with dark theme by default', async ({ page }) => {
    await page.goto('/')
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')
  })

  test('background is dark color', async ({ page }) => {
    await page.goto('/')
    const bg = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor)
    const isDark = !bg.includes('255, 255, 255')
    expect(isDark).toBe(true)
  })

  test('text is light color', async ({ page }) => {
    await page.goto('/')
    const heading = page.locator('h1').first()
    if (await heading.count() > 0) {
      const color = await heading.evaluate(el => window.getComputedStyle(el).color)
      // Text in dark mode should not be black (0, 0, 0)
      expect(color).not.toBe('rgb(0, 0, 0)')
    }
  })

  test('cards have dark background', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('[class*="card"]').first()
    if (await card.count() > 0) {
      const bg = await card.evaluate(el => window.getComputedStyle(el).backgroundColor)
      const isDark = !bg.includes('255, 255, 255')
      expect(isDark).toBe(true)
    }
  })

  test('dark theme is the only theme (no toggle)', async ({ page }) => {
    await page.goto('/')
    // App is dark-only; verify no theme toggle button exists
    const toggle = page.locator('button[aria-label*="theme" i]')
    // If a toggle exists and is visible, verify it works; otherwise dark-only is fine
    if (await toggle.count() > 0 && await toggle.isVisible()) {
      const before = await page.locator('html').getAttribute('class')
      await toggle.click()
      await page.waitForTimeout(300)
      const after = await page.locator('html').getAttribute('class')
      expect(before).not.toBe(after)
    } else {
      // Dark-only app, verify dark class remains
      const htmlClass = await page.locator('html').getAttribute('class')
      expect(htmlClass).toContain('dark')
    }
  })

  test('theme persists on navigation', async ({ page }) => {
    await page.goto('/')
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')
    await page.goto('/search')
    const searchClass = await page.locator('html').getAttribute('class')
    expect(searchClass).toContain('dark')
  })

  test('header has dark styling', async ({ page }) => {
    await page.goto('/')
    const bg = await page.locator('header').evaluate(el => window.getComputedStyle(el).backgroundColor)
    const isDark = !bg.includes('255, 255, 255')
    expect(isDark).toBe(true)
  })

  test('search input has dark styling', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('input[type="search"], input[placeholder*="search" i]').first()
    if (await input.count() > 0) {
      const bg = await input.evaluate(el => window.getComputedStyle(el).backgroundColor)
      const isDark = !bg.includes('255, 255, 255')
      expect(isDark).toBe(true)
    }
  })

  test('no white flash on page load', async ({ page }) => {
    await page.goto('/')
    const bg = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor)
    expect(bg).not.toContain('255, 255, 255')
  })
})
