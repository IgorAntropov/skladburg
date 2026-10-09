import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { ViewportClassValue } from '@/shared/lib/viewport';

import { cn } from '@/shared/lib/cn';
import { useViewportClass } from '@/shared/lib/viewport';
import {
  Panel,
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import type { HudSkeletonZonesValue } from '../lib/hudSkeletonZones';
import type { HudZonePaddingValue } from './hudStyles';

import {
  HUD_DESKTOP_CENTER_COLUMN_CLASS_NAME,
  HUD_DESKTOP_INSPECTOR_ZONE_CLASS_NAME,
  HUD_DESKTOP_KPI_ZONE_CLASS_NAME,
  HUD_DESKTOP_LISTS_ZONE_CLASS_NAME,
  HUD_DESKTOP_OVERLAY_CLASS_NAME,
  HUD_DESKTOP_PANEL_ZONE_CLASS_NAME,
  HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME,
  HUD_DESKTOP_TRACKER_ZONE_CLASS_NAME,
  HUD_PHONE_MAIN_CLASS_NAME,
  HUD_ROOT_CLASS_NAMES,
  HUD_TABLET_BOTTOM_ZONE_CLASS_NAME,
  HUD_TABLET_KPI_ZONE_CLASS_NAME,
  HUD_TABLET_MAIN_CLASS_NAME,
  HUD_TABLET_PANEL_ZONE_CLASS_NAME,
  HUD_ZONE_CLASS_NAME,
  HUD_ZONE_PADDING_CLASS_NAMES,
} from './hudStyles';

interface HudLayoutSkeletonProps {
  label: string;
  zones: HudSkeletonZonesValue;
}

interface SkeletonListsProps {
  hasHeader: boolean;
  isHeaderInPanel?: boolean | undefined;
  panelClassName?: string | undefined;
  tabIds: readonly string[];
}

interface SkeletonStackProps {
  className: string;
  ids: readonly string[];
  itemClassName: string;
}

interface SkeletonZoneProps {
  children: ReactNode;
  className?: string | undefined;
  padding?: HudZonePaddingValue | undefined;
  testId: string;
}

interface SkeletonZonesProps {
  zones: HudSkeletonZonesValue;
}

const GROUP_CLASS_NAME = 'flex flex-1 flex-col';

const LAYER_CLASS_NAME = 'bg-canvas';

const ZONE_CLASS_NAME = 'pointer-events-none';

const STACK_CLASS_NAME = 'flex flex-col gap-3';

const LISTS_ROOT_CLASS_NAME = 'flex min-h-0 flex-1 flex-col gap-3';

const LISTS_TABS_CLASS_NAME = 'flex min-h-0 flex-1 flex-col';

const LISTS_HEADER_CLASS_NAME = 'flex flex-col gap-1 rounded-panel border border-line p-4';

const PANEL_NARROW_LINE_CLASS_NAME = '@max-[27rem]:my-1 @max-[27rem]:h-4';

const STEP_IDS = ['first', 'second', 'third', 'fourth'] as const;

const ROW_IDS = ['first', 'second'] as const;

const HEADED_ROW_IDS = ['first', 'second', 'third'] as const;

const TAB_IDS = ['first', 'second', 'third'] as const;

const BOTTOM_TAB_IDS = [...TAB_IDS, 'fourth'] as const;

const SkeletonZone = ({
  children,
  className,
  padding = 'zone',
  testId,
}: SkeletonZoneProps): ReactElement => {
  return (
    <Panel
      className={cn(HUD_ZONE_CLASS_NAME, HUD_ZONE_PADDING_CLASS_NAMES[padding], ZONE_CLASS_NAME, className)}
      data-testid={testId}
    >
      {children}
    </Panel>
  );
};

const SkeletonStack = ({
  className,
  ids,
  itemClassName,
}: SkeletonStackProps): ReactElement => {
  return (
    <div className={className}>
      {ids.map(id => <Skeleton className={itemClassName} key={id} />)}
    </div>
  );
};

const KpiSkeleton = (): ReactElement => {
  return (
    <SkeletonStack
      className="grid grid-cols-2 gap-2 @xl:grid-cols-4"
      ids={STEP_IDS}
      itemClassName="h-18 w-full rounded-panel"
    />
  );
};

const TrackerSkeleton = (): ReactElement => {
  return <SkeletonStack className="flex flex-col gap-2" ids={STEP_IDS} itemClassName="h-8 w-full" />;
};

const InspectorSkeleton = (): ReactElement => {
  return (
    <div className={STACK_CLASS_NAME}>
      <Skeleton className="my-1.5 h-6 w-1/3" />
      <Skeleton className="h-32 w-full rounded-panel" />
    </div>
  );
};

const PanelSkeleton = (): ReactElement => {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-1/2" />
      <div className="flex flex-col">
        <Skeleton className={cn('h-6 w-3/4', PANEL_NARROW_LINE_CLASS_NAME)} />
        <Skeleton className={cn('hidden w-1/2 @max-[27rem]:block', PANEL_NARROW_LINE_CLASS_NAME)} />
      </div>
    </div>
  );
};

const ListsHeaderSkeleton = (): ReactElement => {
  return (
    <div className={LISTS_HEADER_CLASS_NAME}>
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-6 w-3/4" />
    </div>
  );
};

const ListsSkeleton = ({
  hasHeader,
  isHeaderInPanel = false,
  panelClassName,
  tabIds,
}: SkeletonListsProps): ReactElement => {
  const isHeaderAboveTabs = hasHeader && !isHeaderInPanel;
  const isHeaderAbovePanel = hasHeader && isHeaderInPanel;
  const rowIds = hasHeader ? HEADED_ROW_IDS : ROW_IDS;
  const rowClassName = hasHeader ? 'h-21.5 w-full rounded-panel' : 'h-8 w-full';

  return (
    <div className={LISTS_ROOT_CLASS_NAME}>
      {isHeaderAboveTabs && (
        <div className="px-3">
          <ListsHeaderSkeleton />
        </div>
      )}
      <div className={LISTS_TABS_CLASS_NAME}>
        <SkeletonStack className="flex shrink-0 gap-1 border-b border-line" ids={tabIds} itemClassName="m-3 h-5 w-16" />
        <div className={cn(STACK_CLASS_NAME, 'p-3', panelClassName)}>
          {isHeaderAbovePanel && <ListsHeaderSkeleton />}
          {rowIds.map(id => <Skeleton className={rowClassName} key={id} />)}
        </div>
      </div>
    </div>
  );
};

const DesktopSkeletonZones = ({ zones }: SkeletonZonesProps): ReactElement => {
  const isLeftColumnShown = zones.hasKpi || zones.hasTracker;
  const isRightColumnShown = zones.hasInspector || zones.lists !== undefined;

  return (
    <div className={HUD_DESKTOP_OVERLAY_CLASS_NAME}>
      {isLeftColumnShown && (
        <div className={HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME}>
          {zones.hasKpi && (
            <SkeletonZone className={HUD_DESKTOP_KPI_ZONE_CLASS_NAME} testId="hud-skeleton-kpi">
              <KpiSkeleton />
            </SkeletonZone>
          )}
          {zones.hasTracker && (
            <SkeletonZone className={HUD_DESKTOP_TRACKER_ZONE_CLASS_NAME} testId="hud-skeleton-tracker">
              <TrackerSkeleton />
            </SkeletonZone>
          )}
        </div>
      )}
      {zones.hasPanel && (
        <div className={HUD_DESKTOP_CENTER_COLUMN_CLASS_NAME}>
          <SkeletonZone className={HUD_DESKTOP_PANEL_ZONE_CLASS_NAME} testId="hud-skeleton-panel">
            <PanelSkeleton />
          </SkeletonZone>
        </div>
      )}
      {isRightColumnShown && (
        <div className={cn(HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME, 'ml-auto')}>
          {zones.hasInspector && (
            <SkeletonZone className={HUD_DESKTOP_INSPECTOR_ZONE_CLASS_NAME} testId="hud-skeleton-inspector">
              <InspectorSkeleton />
            </SkeletonZone>
          )}
          {zones.lists !== undefined && (
            <SkeletonZone className={HUD_DESKTOP_LISTS_ZONE_CLASS_NAME} testId="hud-skeleton-lists">
              <ListsSkeleton hasHeader={zones.lists.hasHeader} tabIds={TAB_IDS} />
            </SkeletonZone>
          )}
        </div>
      )}
    </div>
  );
};

const TabletBottomSkeleton = ({ zones }: SkeletonZonesProps): null | ReactElement => {
  const { lists } = zones;

  if (zones.hasTracker && lists !== undefined) {
    return (
      <SkeletonZone className={HUD_TABLET_BOTTOM_ZONE_CLASS_NAME} padding="flush-edge" testId="hud-skeleton-lists">
        <ListsSkeleton hasHeader={lists.hasHeader} isHeaderInPanel panelClassName="min-h-32" tabIds={BOTTOM_TAB_IDS} />
      </SkeletonZone>
    );
  }

  if (zones.hasTracker) {
    return (
      <SkeletonZone className={HUD_TABLET_BOTTOM_ZONE_CLASS_NAME} padding="edge" testId="hud-skeleton-tracker">
        <TrackerSkeleton />
      </SkeletonZone>
    );
  }

  if (lists !== undefined) {
    return (
      <SkeletonZone className={HUD_TABLET_BOTTOM_ZONE_CLASS_NAME} padding="edge" testId="hud-skeleton-lists">
        <ListsSkeleton hasHeader={lists.hasHeader} tabIds={TAB_IDS} />
      </SkeletonZone>
    );
  }

  return null;
};

const TabletSkeletonZones = ({ zones }: SkeletonZonesProps): ReactElement => {
  return (
    <>
      {zones.hasKpi && (
        <SkeletonZone className={HUD_TABLET_KPI_ZONE_CLASS_NAME} testId="hud-skeleton-kpi">
          <KpiSkeleton />
        </SkeletonZone>
      )}
      <div className={HUD_TABLET_MAIN_CLASS_NAME}>
        {zones.hasPanel && (
          <SkeletonZone className={HUD_TABLET_PANEL_ZONE_CLASS_NAME} testId="hud-skeleton-panel">
            <PanelSkeleton />
          </SkeletonZone>
        )}
      </div>
      <TabletBottomSkeleton zones={zones} />
    </>
  );
};

const PhoneSkeletonZones = ({ zones }: SkeletonZonesProps): ReactElement => {
  const { lists } = zones;

  const isPanelMain = lists === undefined && zones.hasPanel;

  return (
    <>
      {lists !== undefined && (
        <SkeletonZone className={HUD_PHONE_MAIN_CLASS_NAME} testId="hud-skeleton-lists">
          <ListsSkeleton hasHeader={lists.hasHeader} tabIds={TAB_IDS} />
        </SkeletonZone>
      )}
      {isPanelMain && (
        <SkeletonZone className={HUD_PHONE_MAIN_CLASS_NAME} testId="hud-skeleton-panel">
          <PanelSkeleton />
        </SkeletonZone>
      )}
    </>
  );
};

const SKELETON_ZONES: Readonly<Record<ViewportClassValue, (props: SkeletonZonesProps) => ReactElement>> = {
  desktop: DesktopSkeletonZones,
  phone: PhoneSkeletonZones,
  tablet: TabletSkeletonZones,
};

export const HudLayoutSkeleton = ({ label, zones }: HudLayoutSkeletonProps): ReactElement => {
  const viewportClass = useViewportClass();
  const isVisible = useDelayedVisibility(true);

  const SkeletonZones = SKELETON_ZONES[viewportClass];

  return (
    <SkeletonGroup className={GROUP_CLASS_NAME} isFilled={isVisible} label={label}>
      <div
        aria-hidden
        className={cn(HUD_ROOT_CLASS_NAMES[viewportClass], LAYER_CLASS_NAME, !isVisible && 'invisible')}
        data-testid="hud-layout-skeleton"
      >
        <SkeletonZones zones={zones} />
      </div>
    </SkeletonGroup>
  );
};
