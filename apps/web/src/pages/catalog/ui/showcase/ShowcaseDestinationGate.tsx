import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { AssistantPortrait } from '@/entities/assistant';
import { AddressLink } from '@/shared/routing';
import {
  buttonClassName,
  EmptyState,
  WidgetStates,
} from '@/shared/ui';

import type { ShowcaseDestinationStateValue } from '../../api/useShowcaseDestination';

import { useShowcaseDestination } from '../../api/useShowcaseDestination';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { ShowcasePanelSkeleton } from './ShowcasePanelSkeleton';
import { ShowcaseWorkspace } from './ShowcaseWorkspace';

interface ShowcaseDestinationGateProps {
  focus: ObjectRefValue | undefined;
}

const LINK_CLASS_NAME = buttonClassName({ variant: 'secondary' });

const readSettledState = (state: ShowcaseDestinationStateValue): ShowcaseDestinationStateValue | undefined => (
  state.isPending || state.error !== null ? undefined : state
);

export const ShowcaseDestinationGate = ({ focus }: ShowcaseDestinationGateProps): ReactElement => {
  const { t } = useCatalogTexts();
  const destinationState = useShowcaseDestination();

  return (
    <WidgetStates
      data={readSettledState(destinationState)}
      error={destinationState.error}
      isRetrying={destinationState.isRetrying}
      loadingLabel={t('catalog.showcase.loading')}
      onRetry={destinationState.retry}
      skeleton={<ShowcasePanelSkeleton />}
    >
      {({ destination, options, select }) => (destination === undefined
        ? (
            <EmptyState
              action={(
                <AddressLink className={LINK_CLASS_NAME} to={{ kind: 'section', section: 'warehouse' }}>
                  {t('catalog.empty.noWarehouse.action')}
                </AddressLink>
              )}
              className="py-8"
              data-testid="catalog-empty-no-warehouse"
              hint={t('catalog.empty.noWarehouse.hint')}
              media={<AssistantPortrait size="sm" />}
              text={t('catalog.empty.noWarehouse.text')}
            />
          )
        : (
            <ShowcaseWorkspace
              destination={destination}
              destinationOptions={options}
              focus={focus}
              onDestinationChange={select}
            />
          ))}
    </WidgetStates>
  );
};
