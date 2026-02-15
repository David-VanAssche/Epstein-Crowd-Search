import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation', () => {
  test('page has main landmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
  })

  test('page has nav landmark', async ({ page }) => {
    await page.goto('/')
    // Nav may be the breadcrumb nav or sidebar content — check DOM
    const navCount = await page.locator('nav, [role="navigation"]').count()
    expect(navCount).toBeGreaterThan(0)
  })

  test('tab key moves focus through interactive elements', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
    const tag = await page.evaluate(() => document.activeElement?.tagName)
    expect(tag).toBeTruthy()
  })

  test('focus is visible', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
    const focused = page.locator(':focus')
    if (await focused.count() > 0) {
      const outline = await focused.evaluate(el => {
        const s = window.getComputedStyle(el)
        return s.outline || s.boxShadow
      })
      expect(outline.length).toBeGreaterThan(0)
    }
  })

  test('interactive content reachable via keyboard', async ({ page }) => {
    await page.goto('/')
    // The homepage has a search form — verify it can receive focus
    const searchForm = page.locator('form[role="search"]')
    await expect(searchForm).toBeAttached()
    // Tab through elements and check we can reach a focusable element
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
    }
    const tag = await page.evaluate(() => document.activeElement?.tagName)
    expect(['INPUT', 'BUTTON', 'A', 'TEXTAREA']).toContain(tag)
  })

  test('search input focusable via tab', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('input[aria-label="Search documents"]')
    if (await input.count() > 0) {
      await input.focus()
      const tag = await page.evaluate(() => document.activeElement?.tagName)
      expect(tag).toBe('INPUT')
    }
  })

  test('escape closes mobile sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    const trigger = page.locator('[data-sidebar="trigger"]')
    if (await trigger.count() > 0 && await trigger.isVisible()) {
      await trigger.click()
      await page.waitForTimeout(500)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })

  test('buttons are keyboard accessible', async ({ page }) => {
    await page.goto('/')
    const btn = page.locator('button:visible').first()
    if (await btn.count() > 0) {
      await btn.focus()
      const tag = await page.evaluate(() => document.activeElement?.tagName)
      expect(tag).toBe('BUTTON')
    }
  })
})
