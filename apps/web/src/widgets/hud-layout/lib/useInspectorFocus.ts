import { useCallback } from 'react';

import type {
  AppSectionValue,
  ObjectRefValue,
} from '@/shared/routing';

import { useNavigate } from '@/shared/routing';

export interface InspectorFocusValue {
  inspectorKey: string | undefined;
  isInspectorOpen: boolean;
  onInspectorClose: () => void;
}

export const useInspectorFocus = (section: AppSectionValue, focus: ObjectRefValue | undefined): InspectorFocusValue => {
  const navigate = useNavigate();

  const isInspectorOpen = focus !== undefined;
  const inspectorKey = focus === undefined ? undefined : `${focus.type}:${focus.id}`;

  const handleInspectorClose = useCallback((): void => {
    console.log('> useInspectorFocus -> handleInspectorClose:', { section });
    navigate({ kind: 'section', section });
  }, [navigate, section]);

  return {
    inspectorKey,
    isInspectorOpen,
    onInspectorClose: handleInspectorClose,
  };
};
