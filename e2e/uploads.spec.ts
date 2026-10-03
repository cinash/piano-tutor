import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { connectVirtualKeyboard, playChord } from './virtualKeyboard';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '..', 'src', 'score', 'fixtures', 'uploads');

const staffWidth = (page: Page) =>
  page
    .getByTestId('staff')
    .locator('svg')
    .evaluate((svg) => svg.getBoundingClientRect().width);

// Against the built app, under its Content-Security-Policy, as content-security-policy.spec.ts
// is: an uploaded file is drawn by the same OSMD, and must not need anything the policy blocks.
test('an uploaded piece is drawn, played, and remembered', async ({ page }) => {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  await connectVirtualKeyboard(page);
  const staff = page.getByTestId('staff');
  const input = page.getByTestId('upload-piece-input');
  const select = page.getByTestId('piece-select');
  await expect(staff.locator('.staffline')).toHaveCount(2);
  const cichaNocWidth = await staffWidth(page);

  await input.setInputFiles(path.join(FIXTURES, 'kotek.musicxml'));

  await expect(select).toHaveValue('upload-kotek');
  await expect(input).toHaveValue('');
  // Four bars against Cicha Noc's 22: this fails if the staff keeps drawing the old piece.
  await expect.poll(() => staffWidth(page)).toBeLessThan(cichaNocWidth * 0.5);
  await expect(staff.locator('.staffline')).toHaveCount(2);
  const kotekWidth = await staffWidth(page);

  // Bar 1: G4 over G3, then A4, G4 and E4.
  await playChord(page, [67, 55]);
  await playChord(page, [69]);
  await playChord(page, [67]);
  await playChord(page, [64]);
  await expect(page.getByTestId('position-readout')).toHaveText('Measure 2 of 4');

  // A correction goes up under a new title, as a new piece of eight bars.
  await input.setInputFiles(path.join(FIXTURES, 'kotek-poprawione.musicxml'));

  await expect(select).toHaveValue('upload-kotek-poprawione');
  await expect.poll(() => staffWidth(page)).toBeGreaterThan(kotekWidth * 1.5);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);

  await page.reload();

  await expect(select).toHaveValue('upload-kotek-poprawione');
  await expect(page.getByTestId('position-readout')).toHaveText('Measure 1 of 8');
  await expect(staff.locator('svg')).toBeVisible();
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});
