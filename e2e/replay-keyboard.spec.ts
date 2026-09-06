import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'example-replay.json');

test('replaying a recorded fixture lights up the matching on-screen keys in sequence', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByTestId('replay-file-input').setInputFiles(FIXTURE_PATH);
  await expect(page.getByTestId('source-status')).toHaveText(
    'Replaying: example-replay.json',
  );

  const keyC4 = page.locator('[data-note="60"]');
  const keyE4 = page.locator('[data-note="64"]');

  await expect(keyC4).toHaveAttribute('data-held', 'true');
  await expect(keyE4).toHaveAttribute('data-held', 'false');

  await expect(keyC4).toHaveAttribute('data-held', 'false');
  await expect(keyE4).toHaveAttribute('data-held', 'true');

  await expect(keyE4).toHaveAttribute('data-held', 'false');
});
