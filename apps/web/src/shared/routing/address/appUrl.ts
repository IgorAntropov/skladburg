import type { AppAddressValue } from './addressTypes';

import { formatAddressPath } from './formatAddressPath';
import { parseAddressPath } from './parseAddressPath';
import { splitPathAndQuery } from './splitPathAndQuery';

const ENTRY_DOCUMENT_NAME = 'index.html';

const getBasePathname = (appBaseUrl: URL): string => {
  return appBaseUrl.pathname.endsWith('/') ? appBaseUrl.pathname : `${appBaseUrl.pathname}/`;
};

const parseFragment = (fragment: string): AppAddressValue | undefined => {
  return parseAddressPath(splitPathAndQuery(fragment).path);
};

const tryParseUrl = (text: string): undefined | URL => {
  try {
    return new URL(text);
  }
  catch {
    return undefined;
  }
};

export const toAppUrl = (address: AppAddressValue, appBaseUrl: URL): string => {
  return `${appBaseUrl.origin}${getBasePathname(appBaseUrl)}#${formatAddressPath(address)}`;
};

export const parseAppUrl = (text: string, appBaseUrl: URL): AppAddressValue | undefined => {
  const trimmedText = text.trim();

  if (trimmedText.startsWith('#')) {
    return parseFragment(trimmedText.slice(1));
  }

  const url = tryParseUrl(trimmedText);

  if (url === undefined) {
    return undefined;
  }

  const basePathname = getBasePathname(appBaseUrl);
  const isOwnDocument
    = url.origin === appBaseUrl.origin && (url.pathname === basePathname || url.pathname === `${basePathname}${ENTRY_DOCUMENT_NAME}`);

  if (!isOwnDocument) {
    return undefined;
  }

  return parseFragment(url.hash.slice(1));
};
