import type { ReactElement } from 'react';

import { useRef } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  ActionButton,
  FileButton,
} from '@/shared/ui';

import { useRemoveMyAvatar } from '../api/useRemoveMyAvatar';
import { useSetMyAvatar } from '../api/useSetMyAvatar';
import { AVATAR_ACCEPTED_TYPES } from '../model/avatarImageLimits';

const ACTION_BUTTON_CLASS_NAME = 'px-3!';

export interface ChangeAvatarActionsProps {
  avatarUrl: string | undefined;
}

export const ChangeAvatarActions = ({ avatarUrl }: ChangeAvatarActionsProps): ReactElement => {
  const { t } = useI18n();
  const setAvatar = useSetMyAvatar();
  const uploadButtonRef = useRef<HTMLButtonElement>(null);

  const handleAvatarRemoved = (): void => {
    console.log('> ChangeAvatarActions -> handleAvatarRemoved:', {});
    uploadButtonRef.current?.focus();
  };

  const removeAvatar = useRemoveMyAvatar(handleAvatarRemoved);

  const hasAvatar = avatarUrl !== undefined && avatarUrl !== '';
  const uploadLabel = hasAvatar ? t('avatar.replace') : t('avatar.upload');

  return (
    <div className="flex flex-wrap items-start gap-2">
      <FileButton
        accept={AVATAR_ACCEPTED_TYPES}
        access={setAvatar.access}
        buttonRef={uploadButtonRef}
        className={ACTION_BUTTON_CLASS_NAME}
        command={setAvatar.command}
        data-testid="change-avatar-upload"
        errorMessage={setAvatar.errorMessage}
        onFileSelect={setAvatar.selectFile}
        pendingLabel={t('avatar.uploading')}
        variant="secondary"
      >
        {uploadLabel}
      </FileButton>
      {hasAvatar && (
        <ActionButton
          access={removeAvatar.access}
          className={ACTION_BUTTON_CLASS_NAME}
          command={removeAvatar.command}
          data-testid="change-avatar-remove"
          pendingLabel={t('avatar.removing')}
          variant="ghost"
        >
          {t('avatar.remove')}
        </ActionButton>
      )}
    </div>
  );
};
