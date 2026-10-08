import type {
  ComponentProps,
  MouseEvent,
  ReactElement,
} from 'react';

import type { AppAddressValue } from '../address/addressTypes';

import { formatAddressPath } from '../address/formatAddressPath';
import { useLocationSource } from './useLocationSource';
import { useNavigate } from './useNavigate';

export interface AddressLinkProps extends Omit<ComponentProps<'a'>, 'href'> {
  to: AppAddressValue;
}

const SELF_TARGETS: readonly (string | undefined)[] = [undefined, '', '_self'];

const isPlainLeftClick = (event: MouseEvent<HTMLAnchorElement>): boolean => {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
};

export const AddressLink = ({ children, onClick, target, to, ...anchorProps }: AddressLinkProps): ReactElement => {
  const location = useLocationSource();
  const navigate = useNavigate();

  const href = location.createHref(formatAddressPath(to));

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);

    const isInterceptable
      = !event.defaultPrevented && isPlainLeftClick(event) && SELF_TARGETS.includes(target) && anchorProps.download === undefined;

    if (!isInterceptable) {
      return;
    }

    event.preventDefault();
    navigate(to);
  };

  return (
    <a {...anchorProps} href={href} onClick={handleClick} target={target}>
      {children}
    </a>
  );
};
