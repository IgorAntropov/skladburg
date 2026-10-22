import { UserProfileService } from '@skladburg/contracts/access/v1/profile';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import {
  useApiClient,
  useCommand,
} from '@/shared/api';

export interface UseRemoveMyAvatarValue {
  access: CommandAccessValue;
  command: CommandValue;
}

export const useRemoveMyAvatar = (onRemoved?: () => void): UseRemoveMyAvatarValue => {
  const client = useApiClient();
  const access = useCommandAccess(UserProfileService.method.removeMyAvatar);

  const command = useCommand({
    execute: idempotencyKey => client.service(UserProfileService).removeMyAvatar({ idempotencyKey }),
    method: UserProfileService.method.removeMyAvatar,
    onSuccess: () => {
      onRemoved?.();
    },
  });

  return { access, command };
};
