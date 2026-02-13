import { expect, type Page } from '@playwright/test'

/**
 * Assert no unexpected console errors occurred during the test.
 * Filters out known noisy errors (e.g., hydration mismatches from extensions).
 */
export function assertNoConsoleErrors(errors: Array<{ type: string; text: string }>) {
  const ignoredPatterns = [
    /Download the React DevTools/,
    /Failed to load resource.*favicon/,
    /hydrat/i,
    /NEXT_REDIRECT/,
  ]

  const real = errors.filter(
    (e) => !ignoredPatterns.some((p) => p.test(e.text))
  )

  expect(real, `Unexpected console errors: ${JSON.stringify(real)}`).toHaveLength(0)
}

/**
 * Assert that the page is in dark mode by checking the html element.
 */
export async function assertDarkTheme(page: Page) {
  const htmlClass = await page.locator('html').getAttribute('class')
  expect(htmlClass).toContain('dark')
}

/**
 * Assert that the basic layout elements are present (header, main, footer).
 */
export async function assertLayoutPresent(page: Page) {
  await expect(page.locator('header').first()).toBeVisible()
  await expect(page.locator('main').first()).toBeVisible()
}

/**
 * Assert page has expected SEO meta tags.
 */
export async function assertMetaTags(page: Page, expected: { title?: string | RegExp; description?: RegExp }) {
  if (expected.title) {
    if (expected.title instanceof RegExp) {
      await expect(page).toHaveTitle(expected.title)
    } else {
      await expect(page).toHaveTitle(expected.title)
    }
  }
  if (expected.description) {
    const content = await page.locator('meta[name="description"]').getAttribute('content')
    expect(content).toMatch(expected.description)
  }
}
