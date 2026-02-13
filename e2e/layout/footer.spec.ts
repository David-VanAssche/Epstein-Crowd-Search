import { test, expect } from '@playwright/test'

test.describe('Footer', () => {
  test('footer visible on homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('footer')).toBeVisible()
  })

  test('has footer content', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer')
    const text = await footer.textContent()
    expect(text?.length).toBeGreaterThan(0)
  })

  test('has links', async ({ page }) => {
    await page.goto('/')
    const links = page.locator('footer a')
    expect(await links.count()).toBeGreaterThan(0)
  })

  test('footer at bottom of page', async ({ page }) => {
    await page.goto('/')
    const box = await page.locator('footer').boundingBox()
    expect(box).toBeTruthy()
    expect(box!.y).toBeGreaterThan(100)
  })

  test('responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('footer')).toBeVisible()
  })
})
