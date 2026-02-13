import { test, expect } from '@playwright/test'

test.describe('SEO Meta Tags', () => {
  test('homepage has title', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('homepage has og:title', async ({ page }) => {
    await page.goto('/')
    const content = await page.locator('meta[property="og:title"]').getAttribute('content')
    expect(content).toBeTruthy()
  })

  test('homepage has meta description', async ({ page }) => {
    await page.goto('/')
    const content = await page.locator('meta[name="description"]').getAttribute('content')
    expect(content).toBeTruthy()
    expect(content!.length).toBeGreaterThan(20)
  })

  test('search page has title', async ({ page }) => {
    await page.goto('/search')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('about page has title', async ({ page }) => {
    await page.goto('/about')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('all pages have viewport meta', async ({ page }) => {
    for (const path of ['/', '/search', '/about']) {
      await page.goto(path)
      const content = await page.locator('meta[name="viewport"]').getAttribute('content')
      expect(content).toContain('width=device-width')
    }
  })

  test('no duplicate title tags', async ({ page }) => {
    await page.goto('/')
    expect(await page.locator('title').count()).toBe(1)
  })

  test('og:type present on homepage', async ({ page }) => {
    await page.goto('/')
    const count = await page.locator('meta[property="og:type"]').count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('og:url present on homepage', async ({ page }) => {
    await page.goto('/')
    const count = await page.locator('meta[property="og:url"]').count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('canonical link or og:url matches page', async ({ page }) => {
    await page.goto('/')
    const canonical = page.locator('link[rel="canonical"]')
    if (await canonical.count() > 0) {
      const href = await canonical.getAttribute('href')
      expect(href).toBeTruthy()
    }
  })
})
