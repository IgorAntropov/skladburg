import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { Tooltip } from './Tooltip';
import { TooltipGroup } from './TooltipGroup';
import {
  TOOLTIP_OPEN_DELAY_MS,
  TOOLTIP_SKIP_DELAY_MS,
} from './tooltipTiming';

const FIRST_TRIGGER_NAME = 'First';
const SECOND_TRIGGER_NAME = 'Second';
const FIRST_CONTENT = 'First hint';
const SECOND_CONTENT = 'Second hint';
const SHORTCUT = 'Q';

const readDescription = (trigger: HTMLElement): string => {
  const describedById = trigger.getAttribute('aria-describedby');
  const described = describedById === null ? null : document.getElementById(describedById);

  const readVisibleText = (node: Node): string => {
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') {
      return '';
    }

    return node.hasChildNodes() ? Array.from(node.childNodes).map(readVisibleText).join('') : (node.textContent ?? '');
  };

  return described === null ? '' : readVisibleText(described);
};

const POINTER_POSITION_AWAY_FROM_GRACE_AREA = {
  clientX: 400,
  clientY: 400,
} as const;

const POINTER_MOVES_PER_HOVER = 2;

const hover = (trigger: HTMLElement): void => {
  for (let moveIndex = 0; moveIndex < POINTER_MOVES_PER_HOVER; moveIndex += 1) {
    fireEvent.pointerMove(trigger, {
      ...POINTER_POSITION_AWAY_FROM_GRACE_AREA,
      pointerType: 'mouse',
    });
  }
};

const leave = (trigger: HTMLElement): void => {
  fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
};

const advance = (durationMs: number): void => {
  act(() => {
    vi.advanceTimersByTime(durationMs);
  });
};

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens a standalone tooltip only after the open delay', () => {
    render(
      <Tooltip content={FIRST_CONTENT}>
        <button type="button">{FIRST_TRIGGER_NAME}</button>
      </Tooltip>,
    );

    hover(screen.getByRole('button', { name: FIRST_TRIGGER_NAME }));
    advance(TOOLTIP_OPEN_DELAY_MS - 1);

    expect(screen.queryByText(FIRST_CONTENT)).toBeNull();

    advance(1);

    expect(screen.getByText(FIRST_CONTENT)).toBeTruthy();
  });

  it('does not share the skipped delay between standalone tooltips', () => {
    render(
      <>
        <Tooltip content={FIRST_CONTENT}>
          <button type="button">{FIRST_TRIGGER_NAME}</button>
        </Tooltip>
        <Tooltip content={SECOND_CONTENT}>
          <button type="button">{SECOND_TRIGGER_NAME}</button>
        </Tooltip>
      </>,
    );
    const first = screen.getByRole('button', { name: FIRST_TRIGGER_NAME });
    const second = screen.getByRole('button', { name: SECOND_TRIGGER_NAME });

    hover(first);
    advance(TOOLTIP_OPEN_DELAY_MS);
    leave(first);
    hover(second);

    expect(screen.queryByText(SECOND_CONTENT)).toBeNull();

    advance(TOOLTIP_OPEN_DELAY_MS);

    expect(screen.getByText(SECOND_CONTENT)).toBeTruthy();
  });

  it('opens the neighbour of an opened tooltip in a group without delay', () => {
    render(
      <TooltipGroup>
        <Tooltip content={FIRST_CONTENT}>
          <button type="button">{FIRST_TRIGGER_NAME}</button>
        </Tooltip>
        <Tooltip content={SECOND_CONTENT}>
          <button type="button">{SECOND_TRIGGER_NAME}</button>
        </Tooltip>
      </TooltipGroup>,
    );
    const first = screen.getByRole('button', { name: FIRST_TRIGGER_NAME });
    const second = screen.getByRole('button', { name: SECOND_TRIGGER_NAME });

    hover(first);
    advance(TOOLTIP_OPEN_DELAY_MS);
    leave(first);
    hover(second);

    expect(screen.getByText(SECOND_CONTENT)).toBeTruthy();
    expect(screen.queryByText(FIRST_CONTENT)).toBeNull();
  });

  it('restores the open delay in a group after the skip window passes', () => {
    render(
      <TooltipGroup>
        <Tooltip content={FIRST_CONTENT}>
          <button type="button">{FIRST_TRIGGER_NAME}</button>
        </Tooltip>
        <Tooltip content={SECOND_CONTENT}>
          <button type="button">{SECOND_TRIGGER_NAME}</button>
        </Tooltip>
      </TooltipGroup>,
    );
    const first = screen.getByRole('button', { name: FIRST_TRIGGER_NAME });
    const second = screen.getByRole('button', { name: SECOND_TRIGGER_NAME });

    hover(first);
    advance(TOOLTIP_OPEN_DELAY_MS);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    advance(TOOLTIP_SKIP_DELAY_MS);
    leave(first);
    hover(second);

    expect(screen.queryByText(SECOND_CONTENT)).toBeNull();
  });

  it('describes the trigger only by the shortcut and exposes it as a key shortcut', () => {
    render(
      <Tooltip content={FIRST_CONTENT} shortcut={SHORTCUT}>
        <button aria-label={FIRST_CONTENT} type="button" />
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: FIRST_CONTENT });

    act(() => {
      trigger.focus();
    });

    expect(trigger.getAttribute('aria-keyshortcuts')).toBe(SHORTCUT);
    expect(readDescription(trigger)).toBe(SHORTCUT);
  });

  it('does not describe the trigger when there is no shortcut to add', () => {
    render(
      <Tooltip content={FIRST_CONTENT}>
        <button aria-label={FIRST_CONTENT} type="button" />
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: FIRST_CONTENT });

    act(() => {
      trigger.focus();
    });

    expect(trigger.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(screen.getAllByText(FIRST_CONTENT).length).toBeGreaterThan(0);
    expect(readDescription(trigger)).toBe('');
  });
});
