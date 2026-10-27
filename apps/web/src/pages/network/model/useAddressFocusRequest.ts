import {
  useEffect,
  useRef,
} from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useViewportClass } from '@/shared/lib/viewport';
import { useAddress } from '@/shared/routing';

import { useNetworkMapStore } from './useNetworkMapStore';

export const useAddressFocusRequest = (focus: ObjectRefValue | undefined): void => {
  const { focusRequest } = useAddress();
  const viewportClass = useViewportClass();
  const requestFocus = useNetworkMapStore(state => state.requestFocus);
  const requestOrganizationFocus = useNetworkMapStore(state => state.requestOrganizationFocus);

  const handledFocusRequestRef = useRef(focusRequest);

  const focusId = focus?.id;
  const focusType = focus?.type;
  const isPhone = viewportClass === 'phone';

  useEffect(() => {
    if (focusRequest === handledFocusRequestRef.current) {
      return;
    }

    handledFocusRequestRef.current = focusRequest;

    if (isPhone || focusId === undefined) {
      return;
    }

    if (focusType === 'organization') {
      console.log('> useAddressFocusRequest -> requestOrganizationFocus:', { focusId, focusRequest });
      requestOrganizationFocus(focusId);

      return;
    }

    if (focusType === 'site' || focusType === 'city') {
      console.log('> useAddressFocusRequest -> requestFocus:', { focusId, focusRequest });
      requestFocus(focusId);
    }
  }, [focusId, focusRequest, focusType, isPhone, requestFocus, requestOrganizationFocus]);
};
