import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { FocusHandoffProvider } from './FocusHandoffProvider';
import { useFocusHandoff } from './useFocusHandoff';

const TRIGGER_LABEL = 'Trigger';
const RETRY_LABEL = 'Retry';
const EXISTING_LABEL = 'Existing';
const OTHER_LABEL = 'Other';
const LATE_LABEL = 'Late';

interface HandoffButtonProps {
  generation?: number;
  handoffKey: string;
  label: string;
  slot?: RequestSlotValue | undefined;
}

interface RequestSlotValue {
  cancelFocus: (() => void) | undefined;
  cancels: (() => void)[];
  capture: (requestFocus: () => void, cancelFocus: () => void) => void;
  requestFocus: (() => void) | undefined;
  requests: (() => void)[];
}

const createSlot = (): RequestSlotValue => {
  const slot: RequestSlotValue = {
    cancelFocus: undefined,
    cancels: [],
    capture: (requestFocus, cancelFocus) => {
      slot.cancels.push(cancelFocus);
      slot.cancelFocus = cancelFocus;
      slot.requestFocus = requestFocus;
      slot.requests.push(requestFocus);
    },
    requestFocus: undefined,
    requests: [],
  };

  return slot;
};

const requestFromSlot = (slot: RequestSlotValue): void => {
  act(() => {
    slot.requestFocus?.();
  });
};

const cancelFromSlot = (slot: RequestSlotValue): void => {
  act(() => {
    slot.cancelFocus?.();
  });
};

const HandoffButton = ({ handoffKey, label, slot }: HandoffButtonProps): ReactElement => {
  const { cancelFocus, ref, requestFocus } = useFocusHandoff<HTMLButtonElement>(handoffKey);
  slot?.capture(requestFocus, cancelFocus);

  return <button ref={ref} type="button">{label}</button>;
};

const Remountable = ({ generation = 0, ...rest }: HandoffButtonProps): ReactElement => (
  <HandoffButton key={generation} {...rest} />
);

const getButton = (label: string): HTMLElement => screen.getByRole('button', { name: label });

describe('FocusHandoff', () => {
  afterEach(() => {
    cleanup();
  });

  it('leaves the focus alone when nobody asked for it', () => {
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <Remountable generation={generation} handoffKey="trigger" label={TRIGGER_LABEL} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));

    rerender(renderTree(1));

    expect(document.activeElement).toBe(document.body);
  });

  it('gives the focus to the new element after the request and the remount', () => {
    const slot = createSlot();
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <Remountable generation={generation} handoffKey="trigger" label={TRIGGER_LABEL} slot={slot} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));

    requestFromSlot(slot);
    rerender(renderTree(1));

    expect(document.activeElement).toBe(getButton(TRIGGER_LABEL));
  });

  it('serves a request once', () => {
    const slot = createSlot();
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <Remountable generation={generation} handoffKey="trigger" label={TRIGGER_LABEL} slot={slot} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));
    requestFromSlot(slot);

    rerender(renderTree(1));
    const trigger = getButton(TRIGGER_LABEL);
    expect(document.activeElement).toBe(trigger);

    trigger.blur();
    rerender(renderTree(2));

    expect(document.activeElement).toBe(document.body);
  });

  it('does not give the focus to an element with another key', () => {
    const slot = createSlot();
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <HandoffButton handoffKey="menu" label={TRIGGER_LABEL} slot={slot} />
        <Remountable generation={generation} handoffKey="other" label={OTHER_LABEL} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));
    requestFromSlot(slot);

    rerender(renderTree(1));

    expect(document.activeElement).toBe(document.body);
  });

  it('keeps the request until an element with its key connects', () => {
    const slot = createSlot();
    const renderTree = (isOtherShown: boolean, isLateShown: boolean): ReactElement => (
      <FocusHandoffProvider>
        <HandoffButton handoffKey="menu" label={TRIGGER_LABEL} slot={slot} />
        {isOtherShown && <HandoffButton handoffKey="other" label={OTHER_LABEL} />}
        {isLateShown && <HandoffButton handoffKey="menu" label={LATE_LABEL} />}
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(false, false));
    requestFromSlot(slot);

    rerender(renderTree(true, false));
    expect(document.activeElement).toBe(document.body);

    rerender(renderTree(true, true));
    expect(document.activeElement).toBe(getButton(LATE_LABEL));
  });

  it('gives the focus to the first element that connects when several share a key', () => {
    const slot = createSlot();
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <HandoffButton handoffKey="persona" label={EXISTING_LABEL} slot={slot} />
        <Remountable generation={generation} handoffKey="persona" label={RETRY_LABEL} />
        <Remountable generation={generation} handoffKey="persona" label={TRIGGER_LABEL} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));
    requestFromSlot(slot);

    rerender(renderTree(1));

    expect(document.activeElement).toBe(getButton(RETRY_LABEL));
  });

  it('drops the request on cancel, so the remount does not take the focus', () => {
    const slot = createSlot();
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <Remountable generation={generation} handoffKey="trigger" label={TRIGGER_LABEL} slot={slot} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));
    requestFromSlot(slot);

    cancelFromSlot(slot);
    rerender(renderTree(1));

    expect(document.activeElement).toBe(document.body);
  });

  it('keeps the request when another key is cancelled', () => {
    const menuSlot = createSlot();
    const otherSlot = createSlot();
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <Remountable generation={generation} handoffKey="menu" label={TRIGGER_LABEL} slot={menuSlot} />
        <HandoffButton handoffKey="other" label={OTHER_LABEL} slot={otherSlot} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));
    requestFromSlot(menuSlot);

    cancelFromSlot(otherSlot);
    rerender(renderTree(1));

    expect(document.activeElement).toBe(getButton(TRIGGER_LABEL));
  });

  it('does nothing on cancel when nobody asked for the focus', () => {
    const slot = createSlot();
    const renderTree = (generation: number): ReactElement => (
      <FocusHandoffProvider>
        <Remountable generation={generation} handoffKey="trigger" label={TRIGGER_LABEL} slot={slot} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree(0));

    cancelFromSlot(slot);
    rerender(renderTree(1));

    expect(document.activeElement).toBe(document.body);
  });

  it('keeps the request and the cancel functions stable between renders', () => {
    const slot = createSlot();
    const renderTree = (): ReactElement => (
      <FocusHandoffProvider>
        <HandoffButton handoffKey="trigger" label={TRIGGER_LABEL} slot={slot} />
      </FocusHandoffProvider>
    );
    const { rerender } = render(renderTree());

    rerender(renderTree());

    expect(slot.requests.length).toBeGreaterThan(1);
    expect(new Set(slot.requests).size).toBe(1);
    expect(slot.cancels.length).toBeGreaterThan(1);
    expect(new Set(slot.cancels).size).toBe(1);
  });

  it('does nothing and does not throw without a provider', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const slot = createSlot();
    const { rerender } = render(<Remountable generation={0} handoffKey="trigger" label={TRIGGER_LABEL} slot={slot} />);

    expect(() => {
      slot.requestFocus?.();
      slot.cancelFocus?.();
    }).not.toThrow();
    rerender(<Remountable generation={1} handoffKey="trigger" label={TRIGGER_LABEL} slot={slot} />);

    expect(document.activeElement).toBe(document.body);
    expect(log).toHaveBeenCalledWith('> FocusHandoffContext -> request:', { key: 'trigger' });

    log.mockRestore();
  });
});
