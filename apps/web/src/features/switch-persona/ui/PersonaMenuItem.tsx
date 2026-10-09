import type { ReactElement } from 'react';

import type { DemoPersonaListItemValue } from '@/shared/api';

import {
  Avatar,
  DropdownMenuRadioItem,
} from '@/shared/ui';

const CURRENT_AVATAR_CLASS_NAME = [
  'in-aria-checked:ring-2 in-aria-checked:ring-indicator',
  'in-aria-checked:ring-offset-2 in-aria-checked:ring-offset-panel-solid',
].join(' ');

interface PersonaMenuItemProps {
  isDisabled: boolean;
  label: string;
  persona: DemoPersonaListItemValue;
  secondLine: string;
}

export const PersonaMenuItem = ({ isDisabled, label, persona, secondLine }: PersonaMenuItemProps): ReactElement => {
  return (
    <DropdownMenuRadioItem disabled={isDisabled} indicatorPlacement="end" label={label} value={persona.id}>
      <Avatar className={CURRENT_AVATAR_CLASS_NAME} name={persona.userDisplayName} seed={persona.userId} size="sm" />
      <span className="flex min-w-0 flex-col text-left" translate="no">
        <span className="truncate leading-5">{persona.userDisplayName}</span>
        <span className="truncate text-sm leading-4 text-on-panel-muted in-data-highlighted:text-on-panel">{secondLine}</span>
      </span>
    </DropdownMenuRadioItem>
  );
};
