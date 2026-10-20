import type { ReactElement } from 'react';

import {
  Content,
  Portal,
  Root,
  Trigger,
} from '@radix-ui/react-tooltip';
import {
  use,
  useState,
} from 'react';

import { formatShortcut } from './formatShortcut';
import { TooltipGroup } from './TooltipGroup';
import { TooltipGroupContext } from './TooltipGroupContext';
import {
  TOOLTIP_CONTENT_CLASS_NAME,
  TOOLTIP_LABEL_CLASS_NAME,
  TOOLTIP_SHORTCUT_CLASS_NAME,
  TOOLTIP_SHORTCUT_GROUP_CLASS_NAME,
} from './tooltipStyles';

const COLLISION_PADDING_PX = 8;
const SIDE_OFFSET_PX = 8;
const SHORTCUT_LABEL_SEPARATOR = ' ';

export interface TooltipProps {
  canOpen?: boolean | undefined;
  children: ReactElement;
  content: string;
  shortcut?: string | undefined;
  side?: 'bottom' | 'left' | 'right' | 'top' | undefined;
}

export const Tooltip = ({
  canOpen = true,
  children,
  content,
  shortcut,
  side = 'top',
}: TooltipProps): ReactElement => {
  const isInsideGroup = use(TooltipGroupContext);
  const [isOpenRequested, setIsOpenRequested] = useState(false);

  const shortcutKeys = shortcut === undefined ? [] : formatShortcut(shortcut);
  const hasShortcut = shortcutKeys.length > 0;
  const activeShortcut = hasShortcut ? shortcut : undefined;
  const shortcutDescription = hasShortcut ? shortcutKeys.join(SHORTCUT_LABEL_SEPARATOR) : undefined;
  const contentRole = hasShortcut ? undefined : 'presentation';
  const isOpen = canOpen && isOpenRequested;

  if (!canOpen && isOpenRequested) {
    setIsOpenRequested(false);
  }

  const handleOpenChange = (nextIsOpen: boolean): void => {
    setIsOpenRequested(canOpen && nextIsOpen);
  };

  const tooltip = (
    <Root onOpenChange={handleOpenChange} open={isOpen}>
      <Trigger aria-keyshortcuts={activeShortcut} asChild>{children}</Trigger>
      <Portal>
        <Content
          aria-label={shortcutDescription}
          className={TOOLTIP_CONTENT_CLASS_NAME}
          collisionPadding={COLLISION_PADDING_PX}
          role={contentRole}
          side={side}
          sideOffset={SIDE_OFFSET_PX}
        >
          <span aria-hidden className={TOOLTIP_LABEL_CLASS_NAME}>{content}</span>
          {hasShortcut && (
            <span aria-hidden className={TOOLTIP_SHORTCUT_GROUP_CLASS_NAME}>
              {shortcutKeys.map(key => <kbd className={TOOLTIP_SHORTCUT_CLASS_NAME} key={key}>{key}</kbd>)}
            </span>
          )}
        </Content>
      </Portal>
    </Root>
  );

  return isInsideGroup ? tooltip : <TooltipGroup>{tooltip}</TooltipGroup>;
};
