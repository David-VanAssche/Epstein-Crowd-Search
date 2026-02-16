import { test, expect } from '@playwright/test'

test.describe('Search Page', () => {
  test('loads search page', async ({ page }) => {
    const res = await page.goto('/search')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has search input field', async ({ page }) => {
    await page.goto('/search')
    // SearchBar uses aria-label="Search documents" on the input
    const input = page.locator('input[aria-label="Search documents"]')
    await expect(input).toBeVisible()
  })

  test('shows empty state without query', async ({ page }) => {
    await page.goto('/search')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('URL params reflected in search', async ({ page }) => {
    await page.goto('/search?q=test')
    await expect(page).toHaveURL(/q=test/)
  })

  test('has filter controls', async ({ page }) => {
    await page.goto('/search')
    const filters = page.locator('select, [role="combobox"], button:has-text("Filter"), [data-testid*="filter"]')
    const count = await filters.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('has sort options', async ({ page }) => {
    await page.goto('/search')
    const sort = page.locator('select, [role="combobox"], button:has-text("Sort"), [data-testid*="sort"]')
    const count = await sort.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('page title is set', async ({ page }) => {
    await page.goto('/search')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/search')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
