import type { ServiceImpl } from '@connectrpc/connect';
import type { User } from '@skladburg/contracts/access/v1/access';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { base64Encode } from '@bufbuild/protobuf/wire';
import {
  UserChangedSchema,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  RemoveMyAvatarResponseSchema,
  SetMyAvatarResponseSchema,
  UserProfileService,
} from '@skladburg/contracts/access/v1/profile';
import { userChannel } from '@skladburg/contracts/runtime';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  buildIdempotencyRecordId,
  getMethodName,
} from '../../idempotency/index';
import { isImageSignatureMatching } from '../../validation/index';

const AVATAR_FIELD_PATH = 'image';
const AVATAR_SIGNATURE_RULE_ID = 'avatar_image_signature';

export const createUserProfileService = (runtime: IModuleRuntime): ServiceImpl<typeof UserProfileService> => {
  const { command, errors, guard, idempotency, outbox } = runtime;

  const writeAvatar = (transaction: IStateTransaction, current: User, avatarUrl: string): User => {
    const user = clone(UserSchema, current);
    user.avatarUrl = avatarUrl;

    transaction.put('users', user);
    outbox.add(transaction, userChannel(user.id), {
      case: 'userChanged',
      value: create(UserChangedSchema, { userId: user.id }),
    });

    return user;
  };

  const purgeAvatarJournal = (transaction: IStateTransaction, userId: string): void => {
    const prefix = buildIdempotencyRecordId(userId, getMethodName(UserProfileService.method.setMyAvatar), '');

    for (const record of transaction.list('idempotency')) {
      if (record.id.startsWith(prefix)) {
        transaction.delete('idempotency', record.id);
      }
    }
  };

  return {
    removeMyAvatar: (request, context) => command((transaction) => {
      const caller = guard.guardCall(transaction, UserProfileService.method.removeMyAvatar, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          purgeAvatarJournal(transaction, caller.user.id);

          return create(RemoveMyAvatarResponseSchema, { user: writeAvatar(transaction, caller.user, '') });
        },
        idempotencyKey: request.idempotencyKey,
        method: UserProfileService.method.removeMyAvatar,
        request,
        scope: caller.user.id,
      });
    }),
    setMyAvatar: (request, context) => command((transaction) => {
      const caller = guard.guardCall(transaction, UserProfileService.method.setMyAvatar, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          if (!isImageSignatureMatching(request.image, request.mediaType)) {
            throw errors.validationFailed([{ fieldPath: AVATAR_FIELD_PATH, ruleId: AVATAR_SIGNATURE_RULE_ID }]);
          }

          purgeAvatarJournal(transaction, caller.user.id);

          const avatarUrl = `data:${request.mediaType};base64,${base64Encode(request.image)}`;

          return create(SetMyAvatarResponseSchema, { user: writeAvatar(transaction, caller.user, avatarUrl) });
        },
        idempotencyKey: request.idempotencyKey,
        method: UserProfileService.method.setMyAvatar,
        request,
        scope: caller.user.id,
      });
    }),
  };
};
