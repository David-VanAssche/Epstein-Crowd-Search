import { test, expect } from '@playwright/test'

test.describe('Black Book Page', () => {
  test('loads without server error', async ({ page }) => {
    const res = await page.goto('/black-book')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has heading "Black Book"', async ({ page }) => {
    await page.goto('/black-book')
    const heading = page.locator('h1')
    await expect(heading).toContainText('Black Book')
  })

  test('has search input', async ({ page }) => {
    await page.goto('/black-book')
    const input = page.locator('input[placeholder*="Search"]')
    await expect(input).toBeVisible()
  })

  test('has alphabet navigation', async ({ page }) => {
    await page.goto('/black-book')
    // Use aria-label to find both desktop and mobile navs
    const nav = page.locator('nav[aria-label="Alphabet filter"]')
    // At least one nav should exist (desktop or mobile depending on viewport)
    await expect(nav.first()).toBeAttached()
    // At least one "All" button should be in the DOM
    const allButtons = page.locator('nav[aria-label="Alphabet filter"] button', { hasText: 'All' })
    expect(await allButtons.count()).toBeGreaterThanOrEqual(1)
  })

  test('shows empty state or entries', async ({ page }) => {
    await page.goto('/black-book')
    // Wait for loading to finish
    await page.waitForTimeout(2000)
    const body = await page.textContent('body')
    // Should show either entries or the empty state message
    expect(body!.length).toBeGreaterThan(50)
  })

  test('search input is interactive', async ({ page }) => {
    await page.goto('/black-book')
    const input = page.locator('input[placeholder*="Search"]')
    await input.fill('test search')
    await expect(input).toHaveValue('test search')
  })

  test('clicking letter filters updates active state', async ({ page }) => {
    // Use a desktop-sized viewport so the alphabet nav is visible
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/black-book')
    // Target the visible (desktop) nav
    const letterB = page.locator('nav[aria-label="Alphabet filter"]:visible button', { hasText: /^B$/ }).first()
    await letterB.click()
    // The clicked button should have the active style (bg-primary)
    await expect(letterB).toHaveClass(/bg-primary/)
  })

  test('responsive: renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const res = await page.goto('/black-book')
    expect(res?.status()).toBeLessThan(500)
    // Heading should still be visible
    const heading = page.locator('h1')
    await expect(heading).toContainText('Black Book')
  })

  test('has BookUser icon in page', async ({ page }) => {
    await page.goto('/black-book')
    // The BookUser icon from lucide renders as an SVG
    const svg = page.locator('h1').locator('..').locator('..').locator('svg').first()
    await expect(svg).toBeVisible()
  })
})
