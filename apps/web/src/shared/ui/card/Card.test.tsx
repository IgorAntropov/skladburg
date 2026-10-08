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

import { Card } from './Card';

const CARD_TEXT = 'Warehouse';
const CARD_TEST_ID = 'card';

describe('Card', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders its children inside a bordered container', () => {
    render(<Card data-testid={CARD_TEST_ID}>{CARD_TEXT}</Card>);
    const card = screen.getByTestId(CARD_TEST_ID);

    expect(card.textContent).toBe(CARD_TEXT);
    expect(card.className).toContain('border-line');
  });

  it('puts the caller class name after its own classes', () => {
    render(<Card className="w-full" data-testid={CARD_TEST_ID}>{CARD_TEXT}</Card>);

    expect(screen.getByTestId(CARD_TEST_ID).className.endsWith('w-full')).toBe(true);
  });

  it('passes the other attributes through', () => {
    render(<Card aria-label={CARD_TEXT} data-testid={CARD_TEST_ID} />);

    expect(screen.getByTestId(CARD_TEST_ID).getAttribute('aria-label')).toBe(CARD_TEXT);
  });
});
