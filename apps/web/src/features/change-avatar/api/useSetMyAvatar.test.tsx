import type {
  SetMyAvatarRequest,
  SetMyAvatarResponse,
} from '@skladburg/contracts/access/v1/profile';
import type { RenderHookResult } from '@testing-library/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  SetMyAvatarResponseSchema,
  UserProfileService,
} from '@skladburg/contracts/access/v1/profile';
import {
  ErrorCode,
  ErrorDetailSchema,
  FieldViolationSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';

import type { EncodedAvatarValue } from '../model/encodedAvatarValue';
import type { UseSetMyAvatarValue } from './useSetMyAvatar';

import { AvatarImageError } from '../lib/AvatarImageError';
import { encodeAvatarImage } from '../lib/encodeAvatarImage';
import { useSetMyAvatar } from './useSetMyAvatar';

vi.mock('../lib/encodeAvatarImage', () => ({ encodeAvatarImage: vi.fn() }));

type SetMyAvatarHandler = (request: SetMyAvatarRequest) => SetMyAvatarResponse;

const IMAGE: EncodedAvatarValue = { bytes: new Uint8Array([1, 2, 3, 4]), mediaType: 'image/webp' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createResponse = (): SetMyAvatarResponse => create(SetMyAvatarResponseSchema, {});

const createSignatureError = (): ConnectError => new ConnectError(
  'rejected',
  Code.InvalidArgument,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, {
      code: ErrorCode.VALIDATION_FAILED,
      params: {
        case: 'validationFailed',
        value: create(ValidationFailedParamsSchema, {
          violations: [create(FieldViolationSchema, { fieldPath: 'image', ruleId: 'avatar_image_signature' })],
        }),
      },
    }),
  }],
);

const createFile = (): File => new File([new Uint8Array(4)], 'photo.png', { type: 'image/png' });

const renderSetAvatar = (setMyAvatar: SetMyAvatarHandler): RenderHookResult<UseSetMyAvatarValue, unknown> => {
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({
    routes: router => router.service(UserProfileService, { setMyAvatar }),
  });

  const wrapper = ({ children }: { children: ReactNode }): ReactElement => withTestLocalizer(
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>,
  );

  return renderHook(() => useSetMyAvatar(), { wrapper });
};

describe('useSetMyAvatar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.mocked(encodeAvatarImage).mockReset();
    vi.restoreAllMocks();
  });

  it('prepares the picture and sends it with a fresh idempotency key', async () => {
    vi.mocked(encodeAvatarImage).mockResolvedValue(IMAGE);
    const setMyAvatar = vi.fn<SetMyAvatarHandler>(createResponse);
    const { result } = renderSetAvatar(setMyAvatar);

    act(() => {
      result.current.selectFile(createFile());
    });

    expect(result.current.command.isPending).toBe(true);
    await waitFor(() => {
      expect(setMyAvatar).toHaveBeenCalledTimes(1);
    });

    const [request] = setMyAvatar.mock.calls[0] ?? [];

    expect(request?.mediaType).toBe('image/webp');
    expect(Array.from(request?.image ?? [])).toEqual([1, 2, 3, 4]);
    expect(request?.idempotencyKey).toMatch(UUID_PATTERN);
    await waitFor(() => {
      expect(result.current.command.isPending).toBe(false);
    });
  });

  it('shows the text of the client error and sends nothing', async () => {
    vi.mocked(encodeAvatarImage).mockRejectedValue(new AvatarImageError('avatar.sourceTooLarge'));
    const setMyAvatar = vi.fn<SetMyAvatarHandler>(createResponse);
    const { result } = renderSetAvatar(setMyAvatar);

    act(() => {
      result.current.selectFile(createFile());
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(defaultLocaleCatalog['avatar.sourceTooLarge']);
    });
    expect(result.current.command.isPending).toBe(false);
    expect(setMyAvatar).not.toHaveBeenCalled();
  });

  it('shows the decode text for an unexpected failure of the preparation', async () => {
    vi.mocked(encodeAvatarImage).mockRejectedValue(new Error('boom'));
    const { result } = renderSetAvatar(vi.fn<SetMyAvatarHandler>(createResponse));

    act(() => {
      result.current.selectFile(createFile());
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(defaultLocaleCatalog['avatar.decodeFailed']);
    });
  });

  it('clears the client error when another file is chosen', async () => {
    vi.mocked(encodeAvatarImage)
      .mockRejectedValueOnce(new AvatarImageError('avatar.tooLarge'))
      .mockResolvedValueOnce(IMAGE);
    const { result } = renderSetAvatar(vi.fn<SetMyAvatarHandler>(createResponse));

    act(() => {
      result.current.selectFile(createFile());
    });
    await waitFor(() => {
      expect(result.current.errorMessage).toBe(defaultLocaleCatalog['avatar.tooLarge']);
    });

    act(() => {
      result.current.selectFile(createFile());
    });

    expect(result.current.errorMessage).toBeUndefined();
    await waitFor(() => {
      expect(result.current.command.isPending).toBe(false);
    });
  });

  it('names the rejected signature from the server', async () => {
    vi.mocked(encodeAvatarImage).mockResolvedValue(IMAGE);
    const setMyAvatar = vi.fn<SetMyAvatarHandler>(() => {
      throw createSignatureError();
    });
    const { result } = renderSetAvatar(setMyAvatar);

    act(() => {
      result.current.selectFile(createFile());
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(defaultLocaleCatalog['validation.avatar_image_signature']);
    });
  });
});
