import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import {
  ClipboardList,
  Package,
} from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';
import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { useCan } from '@/entities/session';
import {
  isReadAccessDenied,
  useDemoScenario,
  WAREHOUSE_YARD_MORNING,
  WAREHOUSE_YARD_MORNING_WAREHOUSE_ID,
} from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  createCachedModuleLoader,
  createLazyComponent,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  AccessButton,
  Button,
  ChunkLoadNotice,
  EmptyState,
  Skeleton,
  SkeletonGroup,
  Tabs,
  TextLink,
  useFocusHandoff,
  WidgetStates,
} from '@/shared/ui';
import { ScenePlaceholder } from '@/widgets/scene-viewport';

import type { WarehouseWorkspaceValue } from '../../api/useWarehouseWorkspace';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type {
  WarehouseConstructionChangeValue,
  WarehouseConstructionPreviewValue,
  WarehouseSceneScanValue,
} from '../../model/warehouseSceneInteraction';
import type {
  WarehouseYardDockChoiceValue,
  WarehouseYardDragOptionsValue,
  WarehouseYardDragValue,
} from '../../model/warehouseYardDockChoice';
import type { WarehouseYardVehicleMarkingVisualValue } from '../../model/warehouseYardVehicleMarkingVisual';
import type { WarehouseSceneViewToggleProps } from '../WarehouseWorkspaceScene';

import { useWarehouseWorkspace } from '../../api/useWarehouseWorkspace';
import { useWarehouseYardVehicleMarkings } from '../../api/useWarehouseYardVehicleMarkings';
import { warehouseWorkSection } from '../../i18n/workspaceSection';
import { getWarehouseCells } from '../../model/warehouseCells';
import { isWarehouseYardDockChoiceAllowed } from '../../model/warehouseYardDockChoice';
import { readCells } from './warehouseFormatting';
import { WarehouseObjectDialog } from './WarehouseObjectDialog';
import { WarehouseStaffSlot } from './WarehouseStaffSlot';

export type WarehouseLayoutRenderValue = (panel: ReactNode, scene?: ReactNode, sceneControls?: ReactNode) => ReactElement;

interface WarehouseQueryProps<TData> {
  children: (data: TData) => ReactNode;
  empty: string;
  isEmpty?: ((data: TData) => boolean) | undefined;
  query: UseQueryResult<TData>;
  t: WarehouseWorkTranslate;
}

interface WarehouseWorkspaceProps {
  focus: ObjectRefValue | undefined;
  renderLayout: WarehouseLayoutRenderValue;
  warehouse: Warehouse;
}

const loadWarehousePanels = createCachedModuleLoader(() => import('./warehousePanels'));
const loadWarehouseEquipment = createCachedModuleLoader(() => import('./WarehouseEquipment'));
const loadWarehouseRackPlacement = createCachedModuleLoader(() => import('../layout/WarehouseRackPlacement'));
const loadWarehouseStaffPresence = createCachedModuleLoader(() => import('./WarehouseStaffPresence'));
const loadWarehouseYardDispatch = createCachedModuleLoader(() => import('./WarehouseYardDispatch'));
const loadWarehouseYardPolicy = createCachedModuleLoader(() => import('./WarehouseYardPolicyEditor'));
const loadWarehouseSceneView = createCachedModuleLoader(() => import('../WarehouseWorkspaceScene'));
const WarehouseWorkspaceScene = createLazyComponent(loadWarehouseSceneView);
const WarehouseSceneControls = createLazyComponent<object>(createCachedModuleLoader(() => loadWarehouseSceneView().then(module => ({
  default: module.WarehouseSceneControls,
}))));
const WarehouseSceneViewToggle = createLazyComponent<WarehouseSceneViewToggleProps>(createCachedModuleLoader(() =>
  loadWarehouseSceneView().then(module => ({ default: module.WarehouseSceneViewToggle }))));

interface WarehousePanelSlotProps<TModule> {
  children: (module: TModule) => ReactNode;
  loader: CachedModuleLoader<TModule>;
}

const NO_CHANGE = (): void => undefined;
const isEmptyList = (items: readonly unknown[]): boolean => items.length === 0;

const WarehouseSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-2">
    <Skeleton className="h-11 w-2/3" />
    <Skeleton className="h-20 w-full" />
  </div>
);

interface WarehouseWorkspaceContentProps extends Omit<WarehouseWorkspaceProps, 'renderLayout'> {
  dockChoice: undefined | WarehouseYardDockChoiceValue;
  isEditingYard: boolean;
  onCellSelect: (id: string, taskId: string) => void;
  onConsumeDockChoice: (choice: WarehouseYardDockChoiceValue) => void;
  onDragOptionsChange: (options: undefined | WarehouseYardDragOptionsValue) => void;
  onEditingYardChange: (isEditing: boolean) => void;
  onEquipmentSelect: (id: string, trigger?: HTMLElement) => void;
  onPreviewChange: WarehouseConstructionChangeValue;
  t: WarehouseWorkTranslate;
  vehicleMarkings: ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined;
  workspace: WarehouseWorkspaceValue;
}

function WarehousePanelSlot<TModule>({ children, loader }: WarehousePanelSlotProps<TModule>): ReactNode {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loader);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    return children(state.module);
  }
  if (state.kind === 'failed') {
    return (
      <ChunkLoadNotice
        message={t('routing.chunkError.message')}
        onRetry={load}
        recovery={state.recovery}
        repeatedMessage={t('routing.chunkError.repeated')}
      />
    );
  }
  return <SkeletonGroup isFilled label={t('routing.section.loading')}><WarehouseSkeleton /></SkeletonGroup>;
}

function WarehouseQuery<TData>({ children, empty, isEmpty, query, t }: WarehouseQueryProps<TData>): ReactElement {
  const { t: baseText } = useI18n();

  const handleRetry = (): void => {
    void query.refetch();
  };

  if (isReadAccessDenied(query.error)) {
    return <EmptyState icon={Package} text={t('warehouseWork.noAccess')} />;
  }

  return (
    <WidgetStates
      data={query.data}
      empty={<EmptyState icon={Package} text={empty} />}
      error={query.error}
      isEmpty={isEmpty}
      isRetrying={query.isFetching}
      loadingLabel={baseText('routing.section.loading')}
      onRetry={handleRetry}
      skeleton={<WarehouseSkeleton />}
    >
      {children}
    </WidgetStates>
  );
}

const WarehouseWorkspaceContent = ({
  dockChoice, focus, isEditingYard, onCellSelect, onConsumeDockChoice, onDragOptionsChange, onEditingYardChange, onEquipmentSelect,
  onPreviewChange, t, vehicleMarkings, warehouse, workspace,
}: WarehouseWorkspaceContentProps): ReactElement => {
  const { t: baseText } = useI18n();
  const demoScenario = useDemoScenario();
  const canViewDeals = useCan(PermissionCode.DEAL_VIEW, { kind: 'organization' });
  const canViewPolicy = useCan(PermissionCode.YARD_VIEW, { kind: 'organization' });
  const canViewProfiles = useCan(PermissionCode.STAFF_PROFILE_VIEW, { kind: 'warehouse', warehouseId: warehouse.id });
  const canViewStaff = useCan(PermissionCode.STAFF_VIEW, { kind: 'warehouse', warehouseId: warehouse.id });
  const workPanelId = useId();
  const { ref: policyButtonRef, requestFocus: requestPolicyFocus } = useFocusHandoff<HTMLButtonElement>('warehouse-yard-policy');
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();
  const [isStaffOpen, setIsStaffOpen] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isSceneOpen, setIsSceneOpen] = useState(false);
  const canOpenScene = workspace.canViewTopology && workspace.topology.data != null && !isReadAccessDenied(workspace.topology.error);
  const hasEditor = editingTaskId !== undefined && workspace.receiving.data?.some(task => task.id === editingTaskId
    && task.status === ReceivingTaskStatus.IN_PROGRESS) === true;
  const isEditing = hasEditor || isEditingLayout || isEditingYard;
  const cells = readCells(workspace.topology.data);
  const productNames = new Map(workspace.receiving.data?.flatMap(task =>
    task.orderLines.map(({ productId, productName }) => [productId, productName] as const)));
  const tabs: TabsItemValue[] = [];

  const handleOpenPolicy = (): void => {
    setIsPolicyOpen(true);
  };

  const handleClosePolicy = (): void => {
    setIsPolicyOpen(false);
    requestPolicyFocus();
  };

  if (isSceneOpen && !canOpenScene) {
    setIsSceneOpen(false);
  }
  if (workspace.isSessionPending) {
    return <SkeletonGroup isFilled label={baseText('routing.section.loading')}><WarehouseSkeleton /></SkeletonGroup>;
  }

  if (workspace.canViewTasks) {
    const count = workspace.picking.data?.filter(task =>
      task.status !== PickingTaskStatus.CANCELLED && task.status !== PickingTaskStatus.SHIPPED).length;
    const receivingCount = workspace.receiving.data?.filter(task => task.status !== ReceivingTaskStatus.RECONCILED
      || task.receivedUnits.some(unit => unit.putAwayCellId === undefined)).length;
    const hasNoTasks = workspace.picking.data?.length === 0 && workspace.receiving.data?.length === 0;

    const taskContent = hasNoTasks
      ? <EmptyState icon={ClipboardList} text={t('warehouseWork.emptyTasks')} />
      : (
          <div className="flex flex-col gap-3" data-testid="warehouse-tasks">
            <WarehouseQuery empty={t('warehouseWork.emptyTasks')} query={workspace.picking} t={t}>
              {tasks => (
                <WarehousePanelSlot loader={loadWarehousePanels}>
                  {({ WarehousePicking }) => tasks.map(task => (
                    <WarehousePicking
                      canViewDeals={canViewDeals}
                      cells={cells}
                      key={task.id}
                      marking={vehicleMarkings?.get(task.id)}
                      onChanged={NO_CHANGE}
                      t={t}
                      task={task}
                    />
                  ))}
                </WarehousePanelSlot>
              )}
            </WarehouseQuery>
            <WarehouseQuery empty={t('warehouseWork.emptyTasks')} query={workspace.receiving} t={t}>
              {tasks => (
                <WarehousePanelSlot loader={loadWarehousePanels}>
                  {({ WarehouseReceivingTasks }) => (
                    <WarehouseReceivingTasks
                      canViewDeals={canViewDeals}
                      cells={cells}
                      editingTaskId={hasEditor ? editingTaskId : undefined}
                      onCellSelect={onCellSelect}
                      onChanged={NO_CHANGE}
                      onEditingChange={setEditingTaskId}
                      t={t}
                      tasks={tasks}
                      timeZone={warehouse.timeZone}
                      topology={workspace.topology.data}
                      warehouseId={warehouse.id}
                    />
                  )}
                </WarehousePanelSlot>
              )}
            </WarehouseQuery>
          </div>
        );
    const handleToggleStaff = (): void => {
      setIsStaffOpen(current => !current);
    };
    tabs.push({
      content: (
        <div className="flex flex-col gap-3">
          {canViewProfiles && !canViewStaff && (
            <>
              <Button
                aria-expanded={isStaffOpen}
                className="self-start"
                data-testid="warehouse-task-staff"
                onClick={handleToggleStaff}
                variant="secondary"
              >
                {t('warehouseWork.staffDirectory')}
              </Button>
              {isStaffOpen && <WarehouseStaffSlot warehouseId={warehouse.id} />}
            </>
          )}
          {taskContent}
        </div>
      ),
      count: count === undefined || receivingCount === undefined ? undefined : count + receivingCount,
      id: 'tasks',
      label: t('warehouseWork.tasks'),
    });
    tabs.push({
      content: (
        <WarehousePanelSlot key="yard" loader={loadWarehouseYardDispatch}>
          {({ WarehouseYardDispatch }) => (
            <WarehouseYardDispatch
              dockChoice={dockChoice}
              onConsumeDockChoice={onConsumeDockChoice}
              onDragOptionsChange={onDragOptionsChange}
              onEditingChange={onEditingYardChange}
              receiving={workspace.receiving}
              t={t}
              topology={workspace.canViewTopology ? workspace.topology : undefined}
              vehicleMarkings={vehicleMarkings}
              warehouse={warehouse}
            />
          )}
        </WarehousePanelSlot>
      ),
      id: 'yard',
      label: t('warehouseWork.yardDispatchTab'),
    });
  }

  if (workspace.canViewTopology) {
    tabs.push({
      content: (
        <WarehouseQuery
          empty={t('warehouseWork.emptyAddresses')}
          isEmpty={topology => readCells(topology).size === 0}
          query={workspace.topology}
          t={t}
        >
          {topology => (
            <WarehousePanelSlot loader={loadWarehousePanels}>
              {({ WarehouseAddresses }) => <WarehouseAddresses addresses={getWarehouseCells(topology)} focus={focus} t={t} />}
            </WarehousePanelSlot>
          )}
        </WarehouseQuery>
      ),
      id: 'addresses',
      label: t('warehouseWork.addresses'),
    });
  }

  if (workspace.canViewInventory) {
    tabs.push(
      {
        content: (
          <WarehouseQuery empty={t('warehouseWork.emptyStock')} isEmpty={isEmptyList} query={workspace.balances} t={t}>
            {balances => (
              <WarehousePanelSlot loader={loadWarehousePanels}>
                {({ WarehouseStock }) => (
                  <WarehouseStock balances={balances} cells={cells} focus={focus} productNames={productNames} t={t} />
                )}
              </WarehousePanelSlot>
            )}
          </WarehouseQuery>
        ),
        id: 'stock',
        label: t('warehouseWork.stock'),
      },
      {
        content: (
          <WarehouseQuery empty={t('warehouseWork.emptyMovements')} isEmpty={isEmptyList} query={workspace.movements} t={t}>
            {movements => (
              <WarehousePanelSlot loader={loadWarehousePanels}>
                {({ WarehouseMovements }) => (
                  <WarehouseMovements
                    balances={workspace.balances.data}
                    canViewDeals={canViewDeals}
                    cells={cells}
                    movements={movements}
                    productNames={productNames}
                    t={t}
                    warehouse={warehouse}
                  />
                )}
              </WarehousePanelSlot>
            )}
          </WarehouseQuery>
        ),
        id: 'movements',
        label: t('warehouseWork.movements'),
      },
    );
  }

  if (workspace.canViewTopology) {
    tabs.push({
      content: (
        <WarehousePanelSlot key="layout" loader={loadWarehouseRackPlacement}>
          {({ WarehouseRackPlacement }) => (
            <WarehouseRackPlacement
              onEditingChange={setIsEditingLayout}
              onPreviewChange={onPreviewChange}
              query={workspace.topology}
              t={t}
              warehouseCapabilities={warehouse.capabilities}
              warehouseId={warehouse.id}
            />
          )}
        </WarehousePanelSlot>
      ),
      id: 'layout',
      label: t('warehouseWork.layout'),
    });
  }

  if (canViewStaff) {
    tabs.push({
      content: (
        <div className="flex flex-col gap-5">
          <WarehousePanelSlot key="staff" loader={loadWarehouseStaffPresence}>
            {({ WarehouseStaffPresence }) => <WarehouseStaffPresence t={t} warehouseId={warehouse.id} />}
          </WarehousePanelSlot>
          {canViewProfiles && <WarehouseStaffSlot warehouseId={warehouse.id} />}
        </div>
      ),
      id: 'staff',
      label: t('warehouseWork.staffTab'),
    });
  }

  if (workspace.canViewTopology) {
    tabs.push({
      content: (
        <div className="flex flex-1 flex-col rounded-control bg-panel-solid">
          <WarehousePanelSlot key="equipment" loader={loadWarehouseEquipment}>
            {({ WarehouseEquipmentList }) => <WarehouseEquipmentList onSelect={onEquipmentSelect} t={t} warehouseId={warehouse.id} />}
          </WarehousePanelSlot>
        </div>
      ),
      id: 'equipment',
      label: t('warehouseWork.equipmentTab'),
    });
  }

  const isCell = focus?.type === 'cell';
  const isUnit = focus?.type === 'handling_unit';
  const isMorningYard = demoScenario?.current === WAREHOUSE_YARD_MORNING && warehouse.id === WAREHOUSE_YARD_MORNING_WAREHOUSE_ID;
  const detailTabId = isUnit || (isCell && workspace.canViewInventory) ? 'stock' : isCell ? 'addresses' : undefined;
  const defaultTabId = detailTabId ?? (isMorningYard ? 'yard' : undefined);
  const cellLabel = isCell ? cells.get(focus.id) : undefined;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" data-testid="warehouse-workspace">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col items-start gap-1">
          {!isSceneOpen && <TextLink size="sm" to={{ kind: 'section', section: 'warehouse' }}>{t('warehouseWork.back')}</TextLink>}
          <h2 className="text-xl font-semibold wrap-anywhere" translate="no">{warehouse.name}</h2>
        </div>
        {canOpenScene && (
          <Suspense fallback={null}>
            <WarehouseSceneViewToggle isSceneOpen={isSceneOpen} onOpenChange={setIsSceneOpen} panelId={workPanelId} t={t} />
          </Suspense>
        )}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" hidden={isSceneOpen} id={workPanelId}>
        <div className="flex flex-col items-start gap-1 empty:hidden">
          {canViewPolicy && (isPolicyOpen
            ? (
                <WarehousePanelSlot loader={loadWarehouseYardPolicy}>
                  {({ WarehouseYardPolicyEditor }) => <WarehouseYardPolicyEditor onClose={handleClosePolicy} t={t} />}
                </WarehousePanelSlot>
              )
            : (
                <AccessButton
                  access={{ status: 'allowed' }}
                  data-testid="yard-queue-policy-open"
                  isDisabled={isEditing}
                  onClick={handleOpenPolicy}
                  ref={policyButtonRef}
                  variant="secondary"
                >
                  {t('warehouseWork.yardPolicyTitle')}
                </AccessButton>
              ))}
          {cellLabel !== undefined && (
            <p className="text-sm text-on-panel-muted">
              {t('warehouseWork.cell')}
              {' '}
              {cellLabel}
            </p>
          )}
          {(isCell || isUnit) && (
            <TextLink size="sm" to={{ kind: 'object', object: { id: warehouse.id, type: 'warehouse' } }}>
              {t('warehouseWork.open')}
            </TextLink>
          )}
        </div>
        {tabs.length > 0
          ? (
              <Tabs
                className={cn('[&>[role=tablist]>[role=tab]]:shrink-0', isEditing && '[&>[role=tablist]]:hidden')}
                defaultTabId={defaultTabId}
                items={tabs}
                label={t('warehouseWork.tabs')}
              />
            )
          : <EmptyState icon={Package} text={t('warehouseWork.noAccess')} />}
      </div>
    </section>
  );
};

export const WarehouseWorkspace = ({ focus, renderLayout, warehouse }: WarehouseWorkspaceProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(warehouseWorkSection);
  const workspace = useWarehouseWorkspace(warehouse.id);
  const receivingTasks = isReadAccessDenied(workspace.receiving.error) ? undefined : workspace.receiving.data;
  const pickingTasks = isReadAccessDenied(workspace.picking.error) ? undefined : workspace.picking.data;
  const taskIds = useMemo(
    () => [...receivingTasks ?? [], ...pickingTasks ?? []].map(({ id }) => id),
    [pickingTasks, receivingTasks],
  );
  const vehicleMarkings = useWarehouseYardVehicleMarkings(warehouse.id, taskIds, workspace.canViewTasks);
  const [construction, setConstruction] = useState<WarehouseConstructionPreviewValue>();
  const [dockChoice, setDockChoice] = useState<WarehouseYardDockChoiceValue>();
  const [dragOptions, setDragOptions] = useState<WarehouseYardDragOptionsValue>();
  const [isEditingYard, setIsEditingYard] = useState(false);
  const [equipmentId, setEquipmentId] = useState<string>();
  const equipmentTrigger = useRef<HTMLElement | null>(null);
  const [scannedCell, setScannedCell] = useState<WarehouseSceneScanValue>();
  const focusId = focus?.id;

  const handleCellSelect = useCallback((id: string): void => {
    setScannedCell({ cellId: id, focusId });
  }, [focusId]);

  const handleEquipmentSelect = useCallback((id: string, trigger?: HTMLElement): void => {
    equipmentTrigger.current = trigger ?? null;
    trigger?.focus({ preventScroll: true });
    setEquipmentId(id);
  }, []);

  const handleEquipmentClose = (): void => {
    setEquipmentId(undefined);
  };

  const handleDragOptionsChange = useCallback((options: undefined | WarehouseYardDragOptionsValue): void => {
    setDragOptions(options);
    if (options === undefined) {
      setDockChoice(undefined);
    }
  }, []);

  const handleDockDrop = useCallback((choice: WarehouseYardDockChoiceValue): void => {
    if (isWarehouseYardDockChoiceAllowed(dragOptions, choice)) {
      setDockChoice(choice);
    }
  }, [dragOptions]);

  const handleConsumeDockChoice = useCallback((choice: WarehouseYardDockChoiceValue): void => {
    setDockChoice(current => current === choice ? undefined : current);
  }, []);

  const yardDrag = useMemo<undefined | WarehouseYardDragValue>(() => (
    !workspace.canViewTasks || isEditingYard || construction !== undefined || dragOptions === undefined || dragOptions.size === 0
      ? undefined
      : { onDockDrop: handleDockDrop, options: dragOptions }
  ), [construction, dragOptions, handleDockDrop, isEditingYard, workspace.canViewTasks]);

  const topology = workspace.canViewTopology && !isReadAccessDenied(workspace.topology.error)
    ? workspace.topology.data
    : undefined;
  const receiving = workspace.canViewTasks && !isReadAccessDenied(workspace.receiving.error) ? workspace.receiving : undefined;
  const picking = workspace.canViewTasks && !isReadAccessDenied(workspace.picking.error) ? workspace.picking : undefined;
  const balances = workspace.canViewInventory && !isReadAccessDenied(workspace.balances.error) ? workspace.balances.data : undefined;
  const focusCellId = focus?.type === 'cell'
    ? focusId
    : focus?.type === 'handling_unit'
      ? balances?.find(balance => balance.handlingUnit?.id === focusId)?.cellId
      : undefined;
  const currentScan = scannedCell?.focusId === focusId ? scannedCell : undefined;
  if (scannedCell !== undefined && currentScan === undefined) {
    setScannedCell(undefined);
  }

  if (t !== undefined) {
    const panel = (
      <WarehouseWorkspaceContent
        dockChoice={dockChoice}
        focus={focus}
        isEditingYard={isEditingYard}
        key={focusId}
        onCellSelect={handleCellSelect}
        onConsumeDockChoice={handleConsumeDockChoice}
        onDragOptionsChange={handleDragOptionsChange}
        onEditingYardChange={setIsEditingYard}
        onEquipmentSelect={handleEquipmentSelect}
        onPreviewChange={setConstruction}
        t={t}
        vehicleMarkings={vehicleMarkings}
        warehouse={warehouse}
        workspace={workspace}
      />
    );
    const scene = (
      <Suspense fallback={<ScenePlaceholder isLoading label={baseText('routing.section.loading')} />}>
        <WarehouseWorkspaceScene
          balances={balances}
          construction={construction}
          isLoading={workspace.topology.isPending && workspace.canViewTopology}
          label={warehouse.name}
          onEquipmentSelect={handleEquipmentSelect}
          picking={picking}
          receiving={receiving}
          scannedCell={currentScan}
          selectedCellId={focusCellId}
          timeZone={warehouse.timeZone}
          topology={topology}
          vehicleMarkings={vehicleMarkings}
          warehouseId={warehouse.id}
          yardDrag={yardDrag}
        />
      </Suspense>
    );
    const controls = topology == null ? undefined : <Suspense fallback={null}><WarehouseSceneControls /></Suspense>;
    return (
      <>
        {renderLayout(panel, scene, controls)}
        {equipmentId !== undefined && workspace.canViewTopology && (
          <WarehouseObjectDialog
            closeTestId="warehouse-equipment-close"
            fallbackFocus={equipmentTrigger}
            onClose={handleEquipmentClose}
            testId="warehouse-equipment-inspector"
            title={t('warehouseWork.equipmentInspector')}
          >
            <WarehousePanelSlot loader={loadWarehouseEquipment}>
              {({ WarehouseEquipmentDetails }) => (
                <WarehouseEquipmentDetails equipmentId={equipmentId} receivingTasks={receiving?.data} t={t} warehouseId={warehouse.id} />
              )}
            </WarehousePanelSlot>
          </WarehouseObjectDialog>
        )}
      </>
    );
  }
  if (status === 'error') {
    return renderLayout(
      <ChunkLoadNotice
        message={baseText('routing.chunkError.message')}
        onRetry={retry}
        recovery="retry"
        repeatedMessage={baseText('routing.chunkError.repeated')}
      />,
    );
  }

  return renderLayout(<SkeletonGroup isFilled label={baseText('routing.section.loading')}><WarehouseSkeleton /></SkeletonGroup>);
};
