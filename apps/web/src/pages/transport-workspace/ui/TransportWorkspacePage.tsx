import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { Truck } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { useNetworkDirectoryQuery } from '@/entities/network';
import {
  useCan,
  useSessionQuery,
} from '@/entities/session';
import { useActingContext } from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { useViewportClass } from '@/shared/lib/viewport';
import {
  Button,
  EmptyState,
  SkeletonGroup,
  Tabs,
} from '@/shared/ui';
import {
  HudLayout,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { ObjectInspector } from '@/widgets/object-inspector';
import { ScenePlaceholder } from '@/widgets/scene-viewport';

import { transportSection } from '../i18n/transportSection';
import {
  createTransportCityReader,
  createTransportTimeFormatter,
} from '../model/transportFormatting';
import { TransportSkeleton } from './TransportData';
import { TransportInspectorSlot } from './TransportInspectorSlot';
import {
  TransportRequestList,
  TransportTripList,
} from './TransportList';

type TransportTab = 'requests' | 'trips';

interface TransportWorkspacePageProps {
  focus: ObjectRefValue | undefined;
}

export const TransportWorkspacePage = ({ focus }: TransportWorkspacePageProps): ReactElement => {
  const i18n = useI18n();
  const catalog = useCatalogSection(transportSection);
  const { organizationId, userId } = useActingContext();
  const session = useSessionQuery();
  const canViewRequests = useCan(PermissionCode.TRANSPORT_REQUEST_VIEW, { kind: 'organization' });
  const canViewTrips = useCan(PermissionCode.TRIP_VIEW, { kind: 'organization' });
  const directory = useNetworkDirectoryQuery();
  const viewport = useViewportClass();
  const inspectorFocus = useInspectorFocus('transport', focus);
  const listRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<string | undefined>(undefined);
  const [preferredTab, setPreferredTab] = useState<TransportTab>('requests');

  const isRequestFocus = focus?.type === 'transport_request';
  const isTripFocus = focus?.type === 'trip';
  const routeTab = isRequestFocus ? 'requests' : isTripFocus ? 'trips' : undefined;
  if (routeTab !== undefined && routeTab !== preferredTab) {
    setPreferredTab(routeTab);
  }
  const { t } = catalog;
  const isLoading = catalog.status === 'loading' || session.isPending;
  const scopeKey = `${organizationId ?? ''}:${userId ?? ''}`;
  const focusKey = inspectorFocus.inspectorKey;

  useEffect(() => {
    const previous = lastFocusRef.current;
    lastFocusRef.current = focus?.id;

    if (focus?.id !== undefined) {
      inspectorRef.current?.focus();

      return;
    }

    if (previous !== undefined) {
      const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-transport-row]') ?? []);
      const item = rows.find(row => row.dataset.transportRow === previous);
      const fallback = listRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');

      (item ?? fallback)?.focus();
    }
  }, [focus?.id, focusKey]);

  const renderPanel = (): ReactElement => {
    if (isLoading) {
      return <SkeletonGroup isFilled label={i18n.t('routing.section.loading')}><TransportSkeleton /></SkeletonGroup>;
    }
    if (t === undefined) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">{i18n.t('routing.chunkError.message')}</p>
          <Button onClick={catalog.retry} variant="secondary">{i18n.t('common.retry')}</Button>
        </div>
      );
    }
    if (!canViewRequests && !canViewTrips) {
      return <EmptyState icon={Truck} text={t('transport.noAccess')} />;
    }

    const formatTime = createTransportTimeFormatter(i18n, t);
    const readCity = createTransportCityReader(directory.data?.cities, t);
    const tabs: TabsItemValue[] = [];
    if (canViewRequests) {
      tabs.push({
        content: <TransportRequestList focus={focus} formatTime={formatTime} readCity={readCity} t={t} />,
        id: 'requests',
        label: t('transport.tabs.requests'),
      });
    }
    if (canViewTrips) {
      tabs.push({
        content: <TransportTripList focus={focus} formatTime={formatTime} readCity={readCity} t={t} />,
        id: 'trips',
        label: t('transport.tabs.trips'),
      });
    }

    return (
      <>
        <p className="text-on-panel-muted">{t('transport.description')}</p>
        <Tabs defaultTabId={preferredTab} items={tabs} key={`${scopeKey}:${preferredTab}`} label={t('transport.tabs')} />
      </>
    );
  };

  const renderInspector = (): ReactElement | undefined => {
    if (focus === undefined) {
      return undefined;
    }
    if (isLoading) {
      return <SkeletonGroup isFilled label={i18n.t('routing.section.loading')}><TransportSkeleton /></SkeletonGroup>;
    }
    if (t === undefined) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">{i18n.t('routing.chunkError.message')}</p>
          <Button onClick={catalog.retry} variant="secondary">{i18n.t('common.retry')}</Button>
        </div>
      );
    }

    const formatTime = createTransportTimeFormatter(i18n, t);
    const readCity = createTransportCityReader(directory.data?.cities, t);
    const key = `${scopeKey}:${focusKey ?? ''}`;

    if (isRequestFocus && canViewRequests) {
      return <TransportInspectorSlot formatTime={formatTime} id={focus.id} key={key} kind="request" readCity={readCity} t={t} />;
    }
    if (isTripFocus && canViewTrips) {
      return <TransportInspectorSlot formatTime={formatTime} id={focus.id} key={key} kind="trip" readCity={readCity} t={t} />;
    }

    return (
      <div data-testid={isTripFocus ? 'transport-trip-unavailable' : 'transport-request-unavailable'}>
        <EmptyState icon={Truck} text={t('transport.unavailable')} />
      </div>
    );
  };

  const inspectorTitle = isTripFocus ? t?.('transport.trips.title') : isRequestFocus ? t?.('transport.requests.title') : undefined;
  const isPanelVisible = viewport !== 'phone' || focus === undefined;

  return (
    <div className="contents" data-testid="page-transport">
      {!isPanelVisible && <h1 className="sr-only">{i18n.t('section.transport.title')}</h1>}
      <HudLayout
        {...inspectorFocus}
        inspector={(
          <div className="flex min-w-0 flex-1 flex-col" ref={inspectorRef} tabIndex={-1}>
            <ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} title={inspectorTitle}>
              {renderInspector()}
            </ObjectInspector>
          </div>
        )}
        panel={isPanelVisible
          ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" ref={listRef}>
                <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('section.transport.title')}</h1>
                {renderPanel()}
              </div>
            )
          : undefined}
        scene={<ScenePlaceholder label={i18n.t('hud.scene.placeholder')} />}
      />
    </div>
  );
};
