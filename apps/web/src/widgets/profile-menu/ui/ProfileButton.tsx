import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { IconButtonProps } from '@/shared/ui';

import { useProfileSummary } from '@/entities/session';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  IconButton,
  useFocusHandoff,
} from '@/shared/ui';

import { mergeRefs } from '../lib/mergeRefs';
import { PROFILE_MENU_FOCUS_KEY } from '../lib/profileMenuFocusKey';
import { ProfileButtonIcon } from './ProfileButtonIcon';

export interface ProfileButtonProps extends Omit<IconButtonProps, 'icon' | 'label'> {
  buttonRef?: IconButtonProps['ref'];
}

export const ProfileButton = ({ buttonRef, className, ref, ...rest }: ProfileButtonProps): ReactElement => {
  const { t } = useI18n();
  const summaryState = useProfileSummary();
  const { ref: handoffRef } = useFocusHandoff<HTMLButtonElement>(PROFILE_MENU_FOCUS_KEY);

  const mergedRef = useMemo(() => mergeRefs(ref, buttonRef, handoffRef), [buttonRef, handoffRef, ref]);

  const label = summaryState.kind === 'ready'
    ? t('profile.button.label', {
        name: summaryState.summary.userDisplayName,
        organization: summaryState.summary.organizationName,
      })
    : t('profile.button.loading');

  return (
    <IconButton
      aria-haspopup="menu"
      className={cn('rounded-full', className)}
      icon={<ProfileButtonIcon state={summaryState} />}
      label={label}
      variant="ghost"
      {...rest}
      ref={mergedRef}
    />
  );
};
