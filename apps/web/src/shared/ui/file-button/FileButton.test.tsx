import {
  cleanup,
  fireEvent,
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

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { FileButton } from './FileButton';

const PICK_LABEL = 'Загрузить фото';
const TEST_ID = 'pick';
const ALLOWED_ACCESS: CommandAccessValue = { status: 'allowed' };

const createStubCommand = (isPending: boolean): CommandValue => ({
  apiError: undefined,
  error: null,
  failedAt: 0,
  isPending,
  method: undefined,
  reset: vi.fn(),
  run: vi.fn(),
});

const createImageFile = (): File => new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });

const renderButton = (
  access: CommandAccessValue,
  command: CommandValue,
  errorMessage?: string,
): ReturnType<typeof vi.fn> => {
  const onFileSelect = vi.fn();

  render(withTestLocalizer(
    <FileButton
      accept="image/png"
      access={access}
      command={command}
      data-testid={TEST_ID}
      errorMessage={errorMessage}
      onFileSelect={onFileSelect}
    >
      {PICK_LABEL}
    </FileButton>,
  ));

  return onFileSelect;
};

const readInput = (): HTMLInputElement => {
  const input = screen.getByTestId(`${TEST_ID}-input`);

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The file input is missing');
  }

  return input;
};

const selectFile = (file: File): void => {
  fireEvent.change(readInput(), { target: { files: [file] } });
};

describe('FileButton', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hands the chosen file to the callback', () => {
    const onFileSelect = renderButton(ALLOWED_ACCESS, createStubCommand(false));
    const file = createImageFile();

    selectFile(file);

    expect(onFileSelect).toHaveBeenCalledExactlyOnceWith(file);
  });

  it('clears the input value so that the same file can be chosen again', () => {
    renderButton(ALLOWED_ACCESS, createStubCommand(false));
    const input = readInput();
    const assignedValues: string[] = [];

    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        assignedValues.push(value);
      },
    });
    selectFile(createImageFile());

    expect(assignedValues).toEqual(['']);
  });

  it('opens the system picker from the button', () => {
    renderButton(ALLOWED_ACCESS, createStubCommand(false));
    const openPicker = vi.spyOn(readInput(), 'click');

    fireEvent.click(screen.getByRole('button', { name: PICK_LABEL }));

    expect(openPicker).toHaveBeenCalledTimes(1);
  });

  it('does not open the picker while the command is running', () => {
    renderButton(ALLOWED_ACCESS, createStubCommand(true));
    const openPicker = vi.spyOn(readInput(), 'click');

    fireEvent.click(screen.getByRole('button'));

    expect(openPicker).not.toHaveBeenCalled();
  });

  it('ignores a chosen file while the command is running', () => {
    const onFileSelect = renderButton(ALLOWED_ACCESS, createStubCommand(true));

    selectFile(createImageFile());

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('ignores a chosen file while the access is denied', () => {
    const onFileSelect = renderButton({ permission: 'warehouse_create', status: 'denied' }, createStubCommand(false));

    selectFile(createImageFile());

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('shows the message of the client error as an alert', () => {
    renderButton(ALLOWED_ACCESS, createStubCommand(false), 'Файл слишком большой');

    expect(screen.getByRole('alert').textContent).toBe('Файл слишком большой');
  });
});
