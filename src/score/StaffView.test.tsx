import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { StaffView } from './StaffView';

/**
 * Layer 2 is deliberately this thin: OSMD cannot draw in jsdom and is stubbed there (see
 * src/testSetup.ts), so the only honest jsdom assertion is that the container is on the
 * page. That the notation is really rendered is e2e/staff.spec.ts's job.
 */
it('renders the staff container', () => {
  render(<StaffView />);

  expect(screen.getByTestId('staff')).toBeTruthy();
});
