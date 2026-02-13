import { test as base, expect, type Page } from '@playwright/test'

type ConsoleMessage = { type: string; text: string }

/**
 * Extended Playwright fixture that captures console.error messages per test.
 */
export const test = base.extend<{
  consoleErrors: ConsoleMessage[]
}>({
  consoleErrors: async ({ page }, use) => {
    const errors: ConsoleMessage[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({ type: msg.type(), text: msg.text() })
      }
    })

    await use(errors)
  },
})

export { expect }
export type { Page }
