import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { ObjectInspector } from '@/widgets/object-inspector';

import type { NetworkMapModelStateValue } from '../api/useNetworkMapModel';

import { findNetworkMapObject } from '../lib/findNetworkMapObject';
import { NetworkInspectorContent } from './NetworkInspectorContent';

interface NetworkInspectorProps {
  focus: ObjectRefValue | undefined;
  onClose: () => void;
  state: NetworkMapModelStateValue;
}

export const NetworkInspector = ({ focus, onClose, state }: NetworkInspectorProps): ReactElement => {
  const { t } = useI18n();

  const { data } = state;
  const isMapObject = focus?.type === 'site' || focus?.type === 'city';

  const foundObject = useMemo(
    () => (data === undefined || !isMapObject ? undefined : findNetworkMapObject(data, focus)),
    [data, focus, isMapObject],
  );

  let title: string | undefined;

  if (foundObject?.kind === 'site') {
    title = foundObject.site.label;
  }
  else if (foundObject?.kind === 'city') {
    title = foundObject.city.name;
  }
  else if (isMapObject) {
    title = t(`object.type.${focus.type}`);
  }

  return (
    <ObjectInspector focus={focus} onClose={onClose} title={title}>
      {isMapObject ? <NetworkInspectorContent focus={focus} state={state} /> : undefined}
    </ObjectInspector>
  );
};
