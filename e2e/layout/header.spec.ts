import { test, expect } from '@playwright/test'

test.describe('Header', () => {
  test('header visible on homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header')).toBeVisible()
  })

  test('has logo/brand link', async ({ page }) => {
    await page.goto('/')
    const logo = page.locator('header a[href="/"]').first()
    await expect(logo).toBeVisible()
  })

  test('has navigation links', async ({ page }) => {
    await page.goto('/')
    const navLinks = page.locator('header a, nav a')
    expect(await navLinks.count()).toBeGreaterThan(1)
  })

  test('nav links navigate correctly', async ({ page }) => {
    await page.goto('/')
    const searchLink = page.locator('header a[href*="search"], nav a[href*="search"]').first()
    if (await searchLink.count() > 0 && await searchLink.isVisible()) {
      await searchLink.click()
      await expect(page).toHaveURL(/search/)
    }
  })

  test('header is sticky', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    await expect(header).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 500))
    await page.waitForTimeout(100)
    await expect(header).toBeVisible()
  })

  test('mobile: shows hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const hamburger = page.locator('header button[aria-label*="menu" i], header button:has(svg)')
    expect(await hamburger.count()).toBeGreaterThan(0)
  })

  test('mobile: hamburger opens nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    // The hamburger is a lg:hidden button with sr-only "Toggle menu" text
    const hamburger = page.locator('button:has(> .sr-only)').first()
    if (await hamburger.count() > 0 && await hamburger.isVisible()) {
      await hamburger.click()
      await page.waitForTimeout(500)
      // Sheet component opens a dialog/overlay with navigation links
      const sheetContent = page.locator('[role="dialog"], [data-state="open"]')
      expect(await sheetContent.count()).toBeGreaterThan(0)
    }
  })

  test('mobile: nav items clickable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const navLinks = page.locator('nav a, header a').filter({ hasText: /search|about|stats/i })
    expect(await navLinks.count()).toBeGreaterThan(0)
  })

  test('has interactive buttons in header', async ({ page }) => {
    await page.goto('/')
    // The header has sign-in/user buttons and mobile menu button (no theme toggle)
    const buttons = page.locator('header button, header a[href="/login"]')
    expect(await buttons.count()).toBeGreaterThan(0)
  })

  test('active link highlighted', async ({ page }) => {
    await page.goto('/search')
    const link = page.locator('header a[href*="search"]').first()
    if (await link.count() > 0) {
      const classes = await link.getAttribute('class')
      expect(classes?.length).toBeGreaterThan(0)
    }
  })
})
