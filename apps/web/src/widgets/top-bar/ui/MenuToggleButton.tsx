import type { ReactElement } from 'react';

import { Menu } from 'lucide-react';
import { useMemo } from 'react';

import type { IconButtonProps } from '@/shared/ui';

import { useI18n } from '@/shared/i18n';
import {
  IconButton,
  useFocusHandoff,
} from '@/shared/ui';

import { MENU_FOCUS_KEY } from '../lib/menuFocusKey';
import { mergeRefs } from '../lib/mergeRefs';

export interface MenuToggleButtonProps extends Omit<IconButtonProps, 'icon' | 'label'> {
  buttonRef?: IconButtonProps['ref'];
}

export const MenuToggleButton = ({ buttonRef, ref, ...rest }: MenuToggleButtonProps): ReactElement => {
  const { t } = useI18n();
  const { ref: handoffRef } = useFocusHandoff<HTMLButtonElement>(MENU_FOCUS_KEY);

  const mergedRef = useMemo(() => mergeRefs(ref, buttonRef, handoffRef), [buttonRef, handoffRef, ref]);

  return (
    <IconButton
      aria-haspopup="menu"
      icon={<Menu className="size-5" />}
      label={t('menu.open')}
      variant="ghost"
      {...rest}
      ref={mergedRef}
    />
  );
};
