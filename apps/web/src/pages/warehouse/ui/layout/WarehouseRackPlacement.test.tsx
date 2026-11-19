import type { ConfigureWarehouseReceivingLayoutRequest } from '@skladburg/contracts/wms/v1/receiving_layout';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  AccessService,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  ConfigureWarehouseReceivingLayoutResponseSchema,
  WarehouseReceivingLayoutService,
} from '@skladburg/contracts/wms/v1/receiving_layout';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  afterEach,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { catalog } from '../../i18n/workspaceRu';
import { WarehouseRackPlacement } from './WarehouseRackPlacement';

const WAREHOUSE_ID = '80000000-0000-4000-8000-000000000001';
const WAREHOUSE_PATH = `/warehouses/${WAREHOUSE_ID}`;
const TOPOLOGY_KEY = ['warehouse-rack-placement-topology'] as const;
const NO_CHANGE = (): void => undefined;
const INITIAL_TOPOLOGY = create(WarehouseTopologySchema, {
  revision: 2,
  storageZones: [{ code: 'Z01', id: 'zone-1', rows: [{ code: 'R01', id: 'row-1' }] }],
  warehouseId: WAREHOUSE_ID,
});

interface HarnessProps {
  topology: null | WarehouseTopology;
}

const Harness = ({ topology }: HarnessProps): ReactElement => {
  const query = useQuery<null | WarehouseTopology>({
    initialData: topology,
    queryFn: () => topology,
    queryKey: TOPOLOGY_KEY,
    staleTime: Infinity,
  });

  return (
    <WarehouseRackPlacement
      onEditingChange={NO_CHANGE}
      onPreviewChange={NO_CHANGE}
      query={query}
      t={(key, ..._params) => catalog[key]}
      warehouseCapabilities={[]}
      warehouseId={WAREHOUSE_ID}
    />
  );
};

const renderWarehouseLayout = (
  topology: null | WarehouseTopology,
  configure?: ((request: ConfigureWarehouseReceivingLayoutRequest) => void),
): {
  location: ReturnType<typeof createMemoryLocation>;
  queryClient: ReturnType<typeof createQueryClient>;
} => {
  const location = createMemoryLocation(WAREHOUSE_PATH);
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(AccessService, {
        getSession: () => create(GetSessionResponseSchema, {
          permissions: [{ permission: 'layout_edit', warehouseIds: [WAREHOUSE_ID] }],
        }),
      });
      router.service(WarehouseReceivingLayoutService, {
        configureWarehouseReceivingLayout: (request) => {
          configure?.(request);

          return create(ConfigureWarehouseReceivingLayoutResponseSchema, { revision: (topology?.revision ?? 0) + 1 });
        },
      });
    },
  });

  render(withTestLocalizer(
    <RoutingProvider location={location}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <Harness topology={topology} />
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </RoutingProvider>,
  ));

  return { location, queryClient };
};

afterEach(cleanup);

it.each([
  { name: 'an empty topology', topology: create(WarehouseTopologySchema, { revision: 3, warehouseId: WAREHOUSE_ID }) },
  { name: 'no topology', topology: null },
])('keeps the draft protected when a rollback leaves the warehouse with $name', async ({ topology }) => {
  const { location, queryClient } = renderWarehouseLayout(INITIAL_TOPOLOGY);

  const submit = await screen.findByTestId('warehouse-rack-submit');
  await waitFor(() => {
    expect(submit.getAttribute('aria-disabled')).toBeNull();
  });

  fireEvent.keyDown(screen.getByTestId('warehouse-rack-grid'), { key: 'ArrowRight' });
  expect(screen.getByTestId('warehouse-rack-grid-selection').getAttribute('data-x-mm')).toBe('100');

  act(() => {
    queryClient.setQueryData(TOPOLOGY_KEY, topology);
  });
  await screen.findByText(catalog['warehouseWork.rackGridRowUnavailable']);
  expect(screen.getByTestId('warehouse-rack-grid-selection').getAttribute('data-x-mm')).toBe('100');
  expect(screen.getByTestId('warehouse-rack-submit').getAttribute('aria-disabled')).toBe('true');

  act(() => {
    location.navigate('/deals');
  });
  expect(screen.getByTestId('warehouse-rack-leave')).toBeTruthy();
  expect(location.read().path).toBe(WAREHOUSE_PATH);
});

it('preserves the first-zone draft and blocks saving when another editor initializes the warehouse', async () => {
  const { location, queryClient } = renderWarehouseLayout(null);
  const form = await screen.findByTestId('warehouse-layout-initialize');
  const offsetInput = within(within(form).getByTestId('warehouse-layout-zone-x')).getByRole('textbox');
  fireEvent.change(offsetInput, { target: { value: '1800' } });
  await screen.findByTestId('warehouse-layout-initialize-cancel');

  act(() => {
    queryClient.setQueryData(TOPOLOGY_KEY, INITIAL_TOPOLOGY);
  });
  await screen.findByText(catalog['warehouseWork.initializeChanged']);
  expect(offsetInput).toHaveProperty('value', '1800');
  expect(screen.getByTestId('warehouse-layout-initialize-submit').getAttribute('aria-disabled')).toBe('true');
  expect(screen.queryByTestId('warehouse-rack-submit')).toBeNull();

  act(() => {
    location.navigate('/deals');
  });
  expect(screen.getByTestId('warehouse-layout-initialize-leave')).toBeTruthy();
  expect(location.read().path).toBe(WAREHOUSE_PATH);
});

it('sends the configured footprint and only visible docks with the current revision', async () => {
  const configure = vi.fn<(request: ConfigureWarehouseReceivingLayoutRequest) => void>();
  renderWarehouseLayout(INITIAL_TOPOLOGY, configure);
  fireEvent.click(screen.getByTestId('warehouse-receiving-layout-open'));
  const edit = await screen.findByTestId('warehouse-receiving-layout-edit');
  await waitFor(() => {
    expect(edit.getAttribute('aria-disabled')).toBeNull();
  });
  fireEvent.click(edit);

  const form = await screen.findByTestId('warehouse-receiving-layout-form');
  const fields = within(form);
  const width = within(fields.getByTestId('warehouse-receiving-layout-width')).getByRole('textbox');
  fireEvent.change(width, { target: { value: '6200' } });
  fireEvent.click(fields.getByTestId('warehouse-receiving-layout-add-dock'));
  const entries = fields.getAllByTestId('warehouse-receiving-layout-dock-entry');
  const secondDock = entries.at(1);
  if (secondDock === undefined) {
    throw new Error('Expected an editable second dock');
  }
  const secondX = within(within(secondDock).getByTestId('warehouse-receiving-layout-dock-x')).getByRole('textbox');
  fireEvent.change(secondX, { target: { value: '4600' } });
  fireEvent.click(fields.getByTestId('warehouse-receiving-layout-submit'));

  await waitFor(() => {
    expect(configure).toHaveBeenCalledOnce();
  });
  const request = configure.mock.lastCall?.[0];
  expect(request?.docks.map(({ xMm }) => xMm)).toEqual([1_300, 4_600]);
  expect(request?.expectedRevision).toBe(2);
  expect(request?.receivingFootprint).toMatchObject({ origin: { xMm: 0, zMm: 0 }, widthMm: 6_200 });
  expect(request?.warehouseId).toBe(WAREHOUSE_ID);
  expect(await screen.findByTestId('warehouse-receiving-layout-edit')).toBeTruthy();
});
