import type { Page } from '@playwright/test';

/** The drawn staff's width, which tells one piece's staff from another's. */
export const staffWidth = (page: Page) =>
  page
    .getByTestId('staff')
    .locator('svg')
    .evaluate((svg) => svg.getBoundingClientRect().width);

/** Collects every Content-Security-Policy violation into `window.cspViolations`. */
export async function recordCspViolations(page: Page) {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
}
