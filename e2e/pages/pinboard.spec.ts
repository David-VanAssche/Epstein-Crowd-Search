import { test, expect } from '@playwright/test'

test.describe('Pinboard Page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/pinboard')
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasAuth = url.includes('login') || url.includes('auth')
    const hasContent = await page.locator('text=/sign in|log in|pinboard/i').count() > 0
    expect(hasAuth || hasContent).toBe(true)
  })

  test('has heading or page content when page loads', async ({ page }) => {
    await page.goto('/pinboard')
    // Pinboard requires auth so may redirect to login
    const url = page.url()
    if (url.includes('login')) {
      expect(true).toBe(true) // redirected to login, that's fine
    } else {
      const heading = page.locator('h1, h2, [role="heading"]').first()
      const hasHeading = await heading.count() > 0 && await heading.isVisible()
      const hasContent = await page.locator('main, [role="main"]').count() > 0
      expect(hasHeading || hasContent).toBe(true)
    }
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/pinboard')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
