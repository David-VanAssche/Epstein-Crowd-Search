import { test, expect } from '@playwright/test'

test.describe('Footer (Sidebar Footer)', () => {
  // The app uses a sidebar layout — the "footer" is the sidebar footer
  // rendered as <div data-sidebar="footer">, not a <footer> element.

  test('sidebar footer exists in DOM', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('[data-sidebar="footer"]')
    await expect(footer).toBeAttached()
  })

  test('sidebar footer has content', async ({ page }) => {
    // Desktop viewport so sidebar is expanded and visible
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const footer = page.locator('[data-sidebar="footer"]')
    await expect(footer).toBeVisible()
    const text = await footer.textContent()
    expect(text!.length).toBeGreaterThan(0)
  })

  test('sidebar footer has user menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    // The sidebar footer contains a UserMenu component with sign-in or user avatar
    const footer = page.locator('[data-sidebar="footer"]')
    const buttons = footer.locator('button, a')
    expect(await buttons.count()).toBeGreaterThan(0)
  })

  test('sidebar footer below sidebar content', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const content = page.locator('[data-sidebar="content"]')
    const footer = page.locator('[data-sidebar="footer"]')
    const contentBox = await content.boundingBox()
    const footerBox = await footer.boundingBox()
    expect(contentBox).toBeTruthy()
    expect(footerBox).toBeTruthy()
    expect(footerBox!.y).toBeGreaterThanOrEqual(contentBox!.y)
  })

  test('responsive: sidebar footer in DOM on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    // On mobile the sidebar is a Sheet (hidden by default), but the footer is still in DOM
    const footer = page.locator('[data-sidebar="footer"]')
    await expect(footer).toBeAttached()
  })
})
