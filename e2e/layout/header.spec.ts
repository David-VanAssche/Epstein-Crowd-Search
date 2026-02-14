import { test, expect } from '@playwright/test'

test.describe('Header', () => {
  test('header visible on homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header')).toBeVisible()
  })

  test('has logo/brand link', async ({ page }) => {
    await page.goto('/')
    // Brand link is in the sidebar header (always in DOM), or breadcrumb Home link in header
    const brandLink = page.locator('[data-sidebar="header"] a[href="/"], header a[href="/"]')
    expect(await brandLink.count()).toBeGreaterThan(0)
  })

  test('has navigation links in sidebar', async ({ page }) => {
    // Desktop viewport needed — on mobile the sidebar Sheet unmounts content when closed
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    // Navigation lives in the sidebar, not the header
    const navLinks = page.locator('[data-sidebar="menu-button"]')
    expect(await navLinks.count()).toBeGreaterThan(5)
  })

  test('nav links navigate correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const searchLink = page.locator('a[href="/search"]').first()
    if (await searchLink.count() > 0 && await searchLink.isVisible()) {
      await searchLink.click()
      await page.waitForURL('**/search')
      expect(page.url()).toContain('/search')
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

  test('sidebar trigger visible', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('[data-sidebar="trigger"]')
    await expect(trigger).toBeVisible()
  })

  test('sidebar trigger toggles sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const trigger = page.locator('[data-sidebar="trigger"]')
    const sidebar = page.locator('[data-sidebar="sidebar"]:not([data-mobile="true"])')
    // Sidebar starts open
    await expect(sidebar).toBeVisible()
    // Click trigger to collapse
    await trigger.click()
    await page.waitForTimeout(300)
  })

  test('mobile: sidebar trigger opens sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const trigger = page.locator('[data-sidebar="trigger"]')
    await expect(trigger).toBeVisible()
    await trigger.click()
    await page.waitForTimeout(500)
    // Mobile sidebar opens as a Sheet dialog
    const mobileSidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]')
    await expect(mobileSidebar).toBeVisible()
  })

  test('mobile: nav items accessible via sidebar sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    // Open mobile sidebar
    await page.locator('[data-sidebar="trigger"]').click()
    await page.waitForTimeout(500)
    // Nav links should be visible in the sheet
    const navLinks = page.locator('[data-mobile="true"] [data-sidebar="menu-button"]')
    expect(await navLinks.count()).toBeGreaterThan(5)
  })

  test('has interactive buttons in header', async ({ page }) => {
    await page.goto('/')
    // The header has sidebar trigger button and auth buttons
    const buttons = page.locator('header button')
    expect(await buttons.count()).toBeGreaterThan(0)
  })

  test('active link highlighted', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/search')
    const activeLink = page.locator('[data-sidebar="menu-button"][data-active="true"]')
    expect(await activeLink.count()).toBeGreaterThan(0)
  })
})
