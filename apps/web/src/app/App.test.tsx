import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { App } from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the main landmark', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeDefined();
  });
});
