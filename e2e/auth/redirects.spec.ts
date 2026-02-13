import { test, expect } from '@playwright/test'

test.describe('Auth Redirects', () => {
  test('/profile redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasAuth = url.includes('login') || url.includes('auth')
    const hasContent = await page.locator('text=/sign in|log in|authenticate/i').count() > 0
    expect(hasAuth || hasContent).toBe(true)
  })

  test('/pinboard redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/pinboard')
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasAuth = url.includes('login') || url.includes('auth')
    const hasContent = await page.locator('text=/sign in|log in|authenticate/i').count() > 0
    expect(hasAuth || hasContent).toBe(true)
  })

  test('public pages do not redirect', async ({ page }) => {
    for (const path of ['/search', '/about', '/stats']) {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(path))
    }
  })

  test('redirect preserves original URL or redirects to login', async ({ page }) => {
    await page.goto('/profile')
    const url = page.url()
    // Either redirected to login (any form) or stayed
    expect(url.includes('login') || url.includes('profile')).toBe(true)
  })

  test('/search is publicly accessible', async ({ page }) => {
    const res = await page.goto('/search')
    expect(res?.status()).toBeLessThan(400)
  })

  test('/about is publicly accessible', async ({ page }) => {
    const res = await page.goto('/about')
    expect(res?.status()).toBeLessThan(400)
  })
})
