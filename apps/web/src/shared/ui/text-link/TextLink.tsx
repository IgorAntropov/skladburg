import type { ReactElement } from 'react';

import type { AddressLinkProps } from '@/shared/routing';

import { cn } from '@/shared/lib/cn';
import { AddressLink } from '@/shared/routing';

export interface TextLinkProps extends AddressLinkProps {
  size?: TextLinkSizeValue | undefined;
}

type TextLinkSizeValue = 'md' | 'sm';

const TEXT_LINK_CLASS_NAME = [
  'inline-flex min-h-11 items-center rounded-control text-link underline underline-offset-2',
  'hover:text-on-panel active:text-on-panel',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
].join(' ');

const TEXT_LINK_SIZE_CLASS_NAMES: Readonly<Record<TextLinkSizeValue, string>> = {
  md: 'text-base',
  sm: 'text-sm font-medium',
};

export const TextLink = ({ className, size = 'md', ...addressLinkProps }: TextLinkProps): ReactElement => {
  return <AddressLink {...addressLinkProps} className={cn(TEXT_LINK_CLASS_NAME, TEXT_LINK_SIZE_CLASS_NAMES[size], className)} />;
};
