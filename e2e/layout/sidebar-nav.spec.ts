import { test, expect } from '@playwright/test'

test.describe('Sidebar Navigation — New Items', () => {
  test('sidebar has Black Book link', async ({ page }) => {
    // Desktop viewport needed — on mobile the sidebar Sheet unmounts content when closed
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const link = page.locator('a[href="/black-book"]')
    await expect(link).toHaveCount(1)
  })

  test('sidebar has Prosecutors link', async ({ page }) => {
    // Desktop viewport needed — on mobile the sidebar Sheet unmounts content when closed
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const link = page.locator('a[href="/prosecutors"]')
    await expect(link).toHaveCount(1)
  })

  test('Black Book link navigates to /black-book', async ({ page }) => {
    // Use desktop viewport where sidebar is expanded
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const link = page.locator('a[href="/black-book"]')
    await link.click()
    await page.waitForURL('**/black-book')
    expect(page.url()).toContain('/black-book')
  })

  test('Prosecutors link navigates to /prosecutors', async ({ page }) => {
    // Use desktop viewport where sidebar is expanded
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const link = page.locator('a[href="/prosecutors"]')
    await link.click()
    await page.waitForURL('**/prosecutors')
    expect(page.url()).toContain('/prosecutors')
  })
})
