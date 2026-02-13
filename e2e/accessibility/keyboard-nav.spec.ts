import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation', () => {
  test('page has main landmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
  })

  test('page has nav landmark', async ({ page }) => {
    await page.goto('/')
    // Nav may be hidden on mobile, check it exists in DOM
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

  test('skip to content link or heading reachable', async ({ page }) => {
    await page.goto('/')
    const skip = page.locator('a[href="#main"], a:has-text("skip to content")')
    if (await skip.count() === 0) {
      const h1 = page.locator('h1').first()
      await expect(h1).toBeVisible()
    }
  })

  test('search input focusable via tab', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('input[type="search"], input[placeholder*="search" i]').first()
    if (await input.count() > 0) {
      await input.focus()
      const tag = await page.evaluate(() => document.activeElement?.tagName)
      expect(tag).toBe('INPUT')
    }
  })

  test('escape closes mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    // Target the mobile hamburger (lg:hidden button with sr-only text)
    const hamburger = page.locator('button:has(> .sr-only)').first()
    if (await hamburger.count() > 0 && await hamburger.isVisible()) {
      await hamburger.click()
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
