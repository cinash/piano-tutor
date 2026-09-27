import { render, screen } from '@testing-library/react';
import { it } from 'vitest';

import { StaffView } from './StaffView';
import { cichaNocXml } from './cichaNoc';

// OSMD is stubbed in jsdom (src/testSetup.ts), so this can only assert the container.
it('renders the staff container', () => {
  render(<StaffView xml={cichaNocXml} targetStartTime={0} />);

  screen.getByTestId('staff');
});
