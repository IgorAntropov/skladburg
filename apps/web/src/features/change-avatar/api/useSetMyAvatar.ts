import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import {
  useApiClient,
  useCommand,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { AvatarImageErrorKeyValue } from '../lib/AvatarImageError';
import type { EncodedAvatarValue } from '../model/encodedAvatarValue';

import { AvatarImageError } from '../lib/AvatarImageError';
import { encodeAvatarImage } from '../lib/encodeAvatarImage';
import { readAvatarServerErrorKey } from '../lib/readAvatarServerErrorKey';

export interface UseSetMyAvatarValue {
  access: CommandAccessValue;
  command: CommandValue;
  errorMessage: string | undefined;
  selectFile: (file: File) => void;
}

const toImageErrorKey = (error: unknown): AvatarImageErrorKeyValue =>
  error instanceof AvatarImageError ? error.messageKey : 'avatar.decodeFailed';

export const useSetMyAvatar = (): UseSetMyAvatarValue => {
  const { t } = useI18n();
  const client = useApiClient();
  const access = useCommandAccess(UserProfileService.method.setMyAvatar);

  const preparedImageRef = useRef<EncodedAvatarValue | undefined>(undefined);
  const isDisposedRef = useRef(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [imageErrorKey, setImageErrorKey] = useState<AvatarImageErrorKeyValue | undefined>(undefined);

  const execute = async (idempotencyKey: string): Promise<void> => {
    const image = preparedImageRef.current;

    if (image === undefined) {
      throw new TypeError('The prepared avatar is missing');
    }

    await client.service(UserProfileService).setMyAvatar({
      idempotencyKey,
      image: image.bytes,
      mediaType: image.mediaType,
    });
  };

  const command = useCommand({
    execute,
    method: UserProfileService.method.setMyAvatar,
    onSuccess: () => {
      preparedImageRef.current = undefined;
    },
  });

  const { reset, run } = command;

  const busyCommand: CommandValue = { ...command, isPending: command.isPending || isPreparing };

  const serverErrorKey = readAvatarServerErrorKey(command.apiError);
  const messageKey = imageErrorKey ?? serverErrorKey;
  const errorMessage = messageKey === undefined ? undefined : t(messageKey);

  const prepareAndRun = async (file: File): Promise<void> => {
    try {
      preparedImageRef.current = await encodeAvatarImage(file);
    }
    catch (error) {
      console.log('> useSetMyAvatar -> prepareAndRun:', { error });
      setImageErrorKey(toImageErrorKey(error));
      setIsPreparing(false);

      return;
    }

    if (!isDisposedRef.current) {
      run();
    }
    setIsPreparing(false);
  };

  const selectFile = (file: File): void => {
    console.log('> useSetMyAvatar -> selectFile:', { size: file.size, type: file.type });
    reset();
    setImageErrorKey(undefined);
    setIsPreparing(true);
    void prepareAndRun(file);
  };

  useEffect(() => {
    isDisposedRef.current = false;

    return () => {
      isDisposedRef.current = true;
    };
  }, []);

  return {
    access,
    command: busyCommand,
    errorMessage,
    selectFile,
  };
};
