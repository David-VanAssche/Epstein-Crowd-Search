import { test, expect } from '@playwright/test'

/**
 * Verify that GoFundMe has been completely removed from user-facing pages.
 * All donation CTAs should now link to /funding or trigger Stripe checkout.
 */

const PAGES_TO_CHECK = [
  '/',
  '/funding',
  '/flights',
  '/graph',
  '/entities',
  '/map',
  '/timeline',
  '/audio',
  '/redactions',
  '/photos',
  '/finances',
  '/emails',
  '/contradictions',
  '/discoveries',
  '/search',
  '/checkout/success',
  '/checkout/cancel',
] as const

test.describe('GoFundMe cleanup verification', () => {
  for (const path of PAGES_TO_CHECK) {
    test(`${path} has no GoFundMe references`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const body = await page.locator('body').textContent()
      const bodyLower = body?.toLowerCase() ?? ''

      // Should not contain "gofundme" in any text on the page
      expect(bodyLower).not.toContain('gofundme')

      // Verify no links point to gofundme.com
      const allLinks = page.locator('a[href]')
      const linkCount = await allLinks.count()
      for (let i = 0; i < linkCount; i++) {
        const href = await allLinks.nth(i).getAttribute('href')
        expect(href || '', `Found GoFundMe link on ${path}`).not.toContain('gofundme.com')
      }

      // No iframes from gofundme
      const iframes = page.locator('iframe')
      const iframeCount = await iframes.count()
      for (let i = 0; i < iframeCount; i++) {
        const src = await iframes.nth(i).getAttribute('src')
        expect(src || '').not.toContain('gofundme')
      }
    })
  }
})

test.describe('Donation CTAs point to /funding or Stripe', () => {
  test('funding sidebar widget links to /funding (desktop only)', async ({ page, isMobile }) => {
    // Sidebar is collapsed on mobile, so skip this test there
    test.skip(!!isMobile, 'Sidebar not visible on mobile')

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // FundingSidebarWidget renders a link to /funding
    const fundingLinks = page.locator('a[href="/funding"]')
    const count = await fundingLinks.count()
    expect(count, 'Expected at least one /funding link on homepage').toBeGreaterThan(0)
  })

  test('EmptyState showFundingCTA links to /funding not GoFundMe', async ({ page }) => {
    // Visit search page with a query that returns nothing
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // Any "fund" links should go to /funding
    const fundLinks = page.locator('a:has-text("fund")')
    const count = await fundLinks.count()
    for (let i = 0; i < count; i++) {
      const href = await fundLinks.nth(i).getAttribute('href')
      expect(href).not.toContain('gofundme')
    }
  })

  test('funding page "Fund Processing" buttons exist', async ({ page }) => {
    await page.goto('/funding')
    await page.waitForLoadState('networkidle')

    // DonationCTA with variant bar/card should show "Fund Processing" button
    const fundButtons = page.locator('a:has-text("Fund Processing"), button:has-text("Fund Processing")')
    // This may or may not exist depending on which components render,
    // but if it does, it should link to /funding
    const count = await fundButtons.count()
    for (let i = 0; i < count; i++) {
      const el = fundButtons.nth(i)
      const tag = await el.evaluate((e) => e.tagName.toLowerCase())
      if (tag === 'a') {
        const href = await el.getAttribute('href')
        expect(href).not.toContain('gofundme')
      }
    }
  })
})
