import type { SupportTicketContext } from '@skladburg/contracts/support/v1/support_ticket';

import { appVersion } from 'virtual:app-version';

import { useErrorJournal } from '@/shared/api';
import { useAddress } from '@/shared/routing';

import { classifyDevice } from '../lib/classifyDevice';
import { collectSupportContext } from '../lib/collectSupportContext';

const STANDALONE_DISPLAY_MODE_QUERY = '(display-mode: standalone)';

const readIsStandalone = (): boolean => {
  const isIosStandalone = Reflect.get(navigator, 'standalone') === true;
  const isDisplayModeStandalone = typeof window.matchMedia === 'function'
    && window.matchMedia(STANDALONE_DISPLAY_MODE_QUERY).matches;

  return isIosStandalone || isDisplayModeStandalone;
};

export const useSupportContextCapture = (): (() => SupportTicketContext) => {
  const { address } = useAddress();
  const errorJournal = useErrorJournal();

  return (): SupportTicketContext => collectSupportContext({
    address,
    appVersion,
    device: classifyDevice({
      isStandalone: readIsStandalone(),
      maxTouchPoints: navigator.maxTouchPoints,
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
    }),
    errors: errorJournal.list(),
  });
};
