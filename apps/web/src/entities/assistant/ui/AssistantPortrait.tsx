import type { ReactElement } from 'react';

import { useResolvedTheme } from '@/shared/theme';

import { useAssistantName } from '../model/useAssistantName';

export interface AssistantPortraitProps {
  isDecorative?: boolean | undefined;
  size: AssistantPortraitSizeValue;
}

export type AssistantPortraitSizeValue = 'md' | 'sm';

const PORTRAIT_PIXELS: Readonly<Record<AssistantPortraitSizeValue, number>> = { md: 64, sm: 36 };

const PORTRAIT_CLASS_NAMES: Readonly<Record<AssistantPortraitSizeValue, string>> = {
  md: 'size-16 shrink-0 select-none',
  sm: 'size-9 shrink-0 select-none',
};

export const AssistantPortrait = ({ isDecorative = true, size }: AssistantPortraitProps): ReactElement => {
  const resolvedTheme = useResolvedTheme();
  const name = useAssistantName();

  const pixels = PORTRAIT_PIXELS[size];
  const portraitUrl = `${import.meta.env.BASE_URL}assistant/assistant-${resolvedTheme}.svg`;

  return (
    <img
      alt={isDecorative ? '' : name}
      aria-hidden={isDecorative ? true : undefined}
      className={PORTRAIT_CLASS_NAMES[size]}
      data-testid="assistant-portrait"
      decoding="async"
      draggable={false}
      height={pixels}
      src={portraitUrl}
      width={pixels}
    />
  );
};
