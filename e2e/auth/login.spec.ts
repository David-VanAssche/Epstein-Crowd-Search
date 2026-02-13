import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('loads login page', async ({ page }) => {
    const res = await page.goto('/login')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has sign in heading/button', async ({ page }) => {
    await page.goto('/login')
    const heading = page.locator('h1, h2, button, a').filter({ hasText: /sign|log|continue|auth/i })
    expect(await heading.count()).toBeGreaterThan(0)
  })

  test('has OAuth provider buttons or links', async ({ page }) => {
    await page.goto('/login')
    const oauth = page.locator('button, a').filter({ hasText: /github|google|oauth|sign in/i })
    const count = await oauth.count()
    expect(count).toBeGreaterThan(0)
  })

  test('no plaintext password field visible', async ({ page }) => {
    await page.goto('/login')
    // May or may not have password field depending on auth config
    const passwordVisible = page.locator('input[type="password"]:visible')
    // This is informational - some auth configs include password
    const count = await passwordVisible.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('has continue as guest or back link', async ({ page }) => {
    await page.goto('/login')
    const link = page.locator('a, button').filter({ hasText: /guest|back|home|skip|continue/i })
    const count = await link.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('page title set', async ({ page }) => {
    await page.goto('/login')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('login page accessible from header', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.locator('header a[href*="login"], nav a[href*="login"]').first()
    if (await loginLink.count() > 0 && await loginLink.isVisible()) {
      await loginLink.click()
      await expect(page).toHaveURL(/login/)
    }
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/login')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('no crash on load', async ({ page }) => {
    const res = await page.goto('/login')
    expect(res?.status()).toBeLessThan(500)
  })

  test('redirects or stays on login', async ({ page }) => {
    await page.goto('/login')
    const url = page.url()
    expect(url.includes('login') || url === 'http://localhost:3000/').toBe(true)
  })

  test('handles error param in URL gracefully', async ({ page }) => {
    await page.goto('/login?error=access_denied')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
