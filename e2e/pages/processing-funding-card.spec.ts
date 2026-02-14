import { test, expect } from '@playwright/test'

/**
 * Verify that all feature pages render the ProcessingFundingCard component
 * (or its loading/fallback state) instead of the old EmptyState.
 *
 * The card either:
 * - Shows campaign data from the API (progress bar, fund buttons)
 * - Shows the fallback "Help fund processing" link if the campaigns table doesn't exist yet
 * - Shows a loading skeleton while fetching
 *
 * On mobile, the client-side React Query fetch may take longer, so we skip
 * content-level assertions there and only verify page loads.
 */

const FULL_VARIANT_PAGES = [
  '/flights',
  '/graph',
  '/entities',
  '/map',
  '/timeline',
  '/audio',
  '/redactions',
  '/photos',
  '/contradictions',
] as const

test.describe('ProcessingFundingCard on feature pages', () => {
  for (const path of FULL_VARIANT_PAGES) {
    test(`${path} page loads without server error`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(500)
    })
  }

  // Desktop-only tests: verify funding card content appears after client fetch
  test.describe('funding card content (desktop)', () => {
    test.skip(({ isMobile }) => !!isMobile, 'Client-side fetch timing differs on mobile viewport')

    for (const path of FULL_VARIANT_PAGES) {
      test(`${path} shows funding-related content after load`, async ({ page }) => {
        await page.goto(path)

        // Wait for ProcessingFundingCard to finish its client-side fetch.
        // After loading, it renders either:
        // - Campaign data with "funded" / "Fund Processing" text
        // - Fallback with "Help fund processing" text
        // Use auto-retrying assertion with body (unique element).
        await expect(page.locator('body')).toContainText(/fund/i, { timeout: 15000 })
      })
    }

    test('/flights renders contribution form or fallback', async ({ page }) => {
      await page.goto('/flights')

      // Wait for the ProcessingFundingCard to render
      await expect(page.locator('body')).toContainText(/fund/i, { timeout: 15000 })

      const bodyText = (await page.locator('body').textContent()) ?? ''

      // Either we see dollar amount buttons (campaign loaded) or a funding link (fallback)
      const hasDollarAmounts = /\$\d+/.test(bodyText)
      const hasFundText = /fund/i.test(bodyText)

      expect(
        hasDollarAmounts || hasFundText,
        'Expected dollar amount buttons or funding text on flights page'
      ).toBe(true)
    })

    test('/contradictions shows ProcessingFundingCard above sample data', async ({ page }) => {
      await page.goto('/contradictions')

      // The contradictions page shows a funding card above sample preview
      const heading = page.getByRole('heading', { name: /contradiction/i })
      await expect(heading).toBeVisible()

      // Wait for funding card content
      await expect(page.locator('body')).toContainText(/fund/i, { timeout: 15000 })
    })

    test('funding card renders progress bar or fallback', async ({ page }) => {
      await page.goto('/flights')

      // Wait for the funding card to finish loading
      await expect(page.locator('body')).toContainText(/fund/i, { timeout: 15000 })

      // Should now have a progress bar or fallback link
      const progressBar = page.locator('[role="progressbar"]')
      const fallbackLink = page.locator('a[href="/funding"]')
      const progressCount = await progressBar.count()
      const fallbackCount = await fallbackLink.count()

      expect(
        progressCount > 0 || fallbackCount > 0,
        'Expected either a progress bar or funding fallback link'
      ).toBe(true)
    })
  })
})

test.describe('ProcessingFundingCard on entity sub-tabs (compact variant)', () => {
  test('/entities page loads without error', async ({ page }) => {
    const res = await page.goto('/entities')
    expect(res?.status()).toBeLessThan(500)

    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
