import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { App } from './App';

test('renders OK', () => {
  render(<App />);
  expect(screen.getByText('OK')).toBeDefined();
});
