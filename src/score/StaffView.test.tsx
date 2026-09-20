import { render, screen } from '@testing-library/react';
import { it } from 'vitest';

import { StaffView } from './StaffView';

// OSMD is stubbed in jsdom (src/testSetup.ts), so this can only assert the container.
it('renders the staff container', () => {
  render(<StaffView />);

  screen.getByTestId('staff');
});
