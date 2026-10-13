import type { ReactElement } from 'react';

import {
  Content,
  Portal,
  Root,
  Trigger,
} from '@radix-ui/react-tooltip';
import { use } from 'react';

import { TooltipGroup } from './TooltipGroup';
import { TooltipGroupContext } from './TooltipGroupContext';
import {
  TOOLTIP_CONTENT_CLASS_NAME,
  TOOLTIP_LABEL_CLASS_NAME,
  TOOLTIP_SHORTCUT_CLASS_NAME,
} from './tooltipStyles';

const COLLISION_PADDING_PX = 8;
const SIDE_OFFSET_PX = 8;

export interface TooltipProps {
  children: ReactElement;
  content: string;
  shortcut?: string | undefined;
  side?: 'bottom' | 'left' | 'right' | 'top' | undefined;
}

export const Tooltip = ({
  children,
  content,
  shortcut,
  side = 'top',
}: TooltipProps): ReactElement => {
  const isInsideGroup = use(TooltipGroupContext);

  const hasShortcut = shortcut !== undefined && shortcut !== '';
  const activeShortcut = hasShortcut ? shortcut : undefined;
  const contentRole = hasShortcut ? undefined : 'presentation';

  const tooltip = (
    <Root>
      <Trigger aria-keyshortcuts={activeShortcut} asChild>{children}</Trigger>
      <Portal>
        <Content
          aria-label={activeShortcut}
          className={TOOLTIP_CONTENT_CLASS_NAME}
          collisionPadding={COLLISION_PADDING_PX}
          role={contentRole}
          side={side}
          sideOffset={SIDE_OFFSET_PX}
        >
          <span aria-hidden className={TOOLTIP_LABEL_CLASS_NAME}>{content}</span>
          {hasShortcut && <kbd aria-hidden className={TOOLTIP_SHORTCUT_CLASS_NAME}>{shortcut}</kbd>}
        </Content>
      </Portal>
    </Root>
  );

  return isInsideGroup ? tooltip : <TooltipGroup>{tooltip}</TooltipGroup>;
};
