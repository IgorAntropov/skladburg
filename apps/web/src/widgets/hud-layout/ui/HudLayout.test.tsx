import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useEffect } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { TabsItemValue } from '@/shared/ui';

import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';

import type { HudLayoutProps } from '../lib/hudLayoutTypes';

import { HudLayout } from './HudLayout';

const catalog = defaultLocaleCatalog;

const PROBE_TEXT = 'Probe';
const TRIPS_TEXT = 'Trips slot';
const DEALS_TAB_LABEL = 'Deals tab';
const TRIPS_TAB_LABEL = 'Trips tab';

const SLOT_TEXT = {
  inspector: 'Inspector slot',
  kpi: 'Kpi slot',
  lists: 'Lists slot',
  panel: 'Panel slot',
  scene: 'Scene slot',
  tracker: 'Tracker slot',
} as const;

type SlotNameValue = keyof typeof SLOT_TEXT;

const createListTabs = (): readonly TabsItemValue[] => [
  { content: <p>{SLOT_TEXT.lists}</p>, id: 'deals', label: DEALS_TAB_LABEL },
  { content: <p>{TRIPS_TEXT}</p>, id: 'trips', label: TRIPS_TAB_LABEL },
];

interface MountProbeProps {
  onMount: () => void;
  onUnmount?: (() => void) | undefined;
}

const MountProbe = ({ onMount, onUnmount }: MountProbeProps): ReactElement => {
  useEffect(() => {
    onMount();

    return onUnmount;
  }, [onMount, onUnmount]);

  return <p>{PROBE_TEXT}</p>;
};

interface LifecycleCounterValue {
  active: number;
  onMount: () => void;
  onUnmount: () => void;
  peak: number;
}

const createLifecycleCounter = (): LifecycleCounterValue => {
  const counter: LifecycleCounterValue = {
    active: 0,
    onMount: () => {
      counter.active += 1;
      counter.peak = Math.max(counter.peak, counter.active);
    },
    onUnmount: () => {
      counter.active -= 1;
    },
    peak: 0,
  };

  return counter;
};

const createProps = (overrides: Partial<HudLayoutProps> = {}): HudLayoutProps => ({
  inspector: <p>{SLOT_TEXT.inspector}</p>,
  isInspectorOpen: false,
  kpi: <p>{SLOT_TEXT.kpi}</p>,
  listTabs: createListTabs(),
  onInspectorClose: vi.fn(),
  panel: <p>{SLOT_TEXT.panel}</p>,
  scene: <p>{SLOT_TEXT.scene}</p>,
  tracker: <p>{SLOT_TEXT.tracker}</p>,
  ...overrides,
});

const renderLayout = (props: HudLayoutProps): void => {
  render(withTestLocalizer(<HudLayout {...props} />));
};

describe('HudLayout', () => {
  let viewport: IFakeViewport;

  beforeEach(() => {
    viewport = installFakeViewport('desktop');
  });

  afterEach(() => {
    cleanup();
    viewport.restore();
  });

  describe('on a tablet', () => {
    beforeEach(() => {
      viewport.setViewportClass('tablet');
    });

    it('keeps the pressed tab while the tabs get new counts', () => {
      const { rerender } = render(withTestLocalizer(<HudLayout {...createProps()} />));
      fireEvent.mouseDown(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }));

      const countedTabs = createListTabs().map(tab => ({ ...tab, count: 5 }));
      rerender(withTestLocalizer(<HudLayout {...createProps({ listTabs: countedTabs })} />));

      expect(screen.getByRole('tab', { name: `${TRIPS_TAB_LABEL} 5` }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText(TRIPS_TEXT)).toBeDefined();
    });

    it('keeps the pressed tab when other zones change', () => {
      const { rerender } = render(withTestLocalizer(<HudLayout {...createProps()} />));
      fireEvent.mouseDown(screen.getByRole('tab', { name: DEALS_TAB_LABEL }));

      rerender(withTestLocalizer(<HudLayout {...createProps({ kpi: undefined, panel: undefined })} />));

      expect(screen.getByRole('tab', { name: DEALS_TAB_LABEL }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText(SLOT_TEXT.lists)).toBeDefined();
    });

    describe('when the tracker comes and goes', () => {
      const selectedTabLabel = (): string | undefined => {
        return screen.getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent ?? undefined;
      };

      it('selects the first list tab again when the tracker leaves the tabs while another tab is pressed', () => {
        const { rerender } = render(withTestLocalizer(<HudLayout {...createProps()} />));
        fireEvent.mouseDown(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }));

        expect(selectedTabLabel()).toBe(TRIPS_TAB_LABEL);

        rerender(withTestLocalizer(<HudLayout {...createProps({ tracker: undefined })} />));

        expect(selectedTabLabel()).toBe(DEALS_TAB_LABEL);
        expect(screen.queryByTestId('hud-bottom-tabs')).toBeNull();
      });

      it('selects the tracker when it joins the lists while a list tab is pressed', () => {
        const { rerender } = render(withTestLocalizer(<HudLayout {...createProps({ tracker: undefined })} />));
        fireEvent.mouseDown(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }));

        expect(selectedTabLabel()).toBe(TRIPS_TAB_LABEL);

        rerender(withTestLocalizer(<HudLayout {...createProps()} />));

        expect(selectedTabLabel()).toBe(catalog['hud.tracker.label']);
        expect(screen.getByTestId('hud-bottom-tabs')).toBeDefined();
      });

      it('selects the tracker again when the lists leave and come back', () => {
        const { rerender } = render(withTestLocalizer(<HudLayout {...createProps()} />));
        fireEvent.mouseDown(screen.getByRole('tab', { name: DEALS_TAB_LABEL }));

        rerender(withTestLocalizer(<HudLayout {...createProps({ listTabs: undefined })} />));

        expect(screen.queryByRole('tablist')).toBeNull();

        rerender(withTestLocalizer(<HudLayout {...createProps()} />));

        expect(selectedTabLabel()).toBe(catalog['hud.tracker.label']);
      });

      it('keeps the pressed tab while the tracker stays and only its content changes', () => {
        const { rerender } = render(withTestLocalizer(<HudLayout {...createProps()} />));
        fireEvent.mouseDown(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }));

        rerender(withTestLocalizer(<HudLayout {...createProps({ tracker: <p>{SLOT_TEXT.lists}</p> })} />));

        expect(selectedTabLabel()).toBe(TRIPS_TAB_LABEL);
      });
    });
  });

  describe('on a phone', () => {
    beforeEach(() => {
      viewport.setViewportClass('phone');
    });

    describe('with the key of the inspector', () => {
      const collapseSheet = (): void => {
        fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }));
      };

      it('keeps the collapsed sheet collapsed while the key stays the same', () => {
        const props = createProps({ inspectorKey: 'deal:first', isInspectorOpen: true });
        const { rerender } = render(withTestLocalizer(<HudLayout {...props} />));
        collapseSheet();

        rerender(withTestLocalizer(<HudLayout {...props} />));

        expect(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }).getAttribute('aria-expanded')).toBe('false');
      });

      it('opens the sheet expanded again when the key changes', () => {
        const firstProps = createProps({ inspectorKey: 'deal:first', isInspectorOpen: true });
        const { rerender } = render(withTestLocalizer(<HudLayout {...firstProps} />));
        collapseSheet();

        rerender(withTestLocalizer(<HudLayout {...createProps({ inspectorKey: 'deal:second', isInspectorOpen: true })} />));

        expect(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }).getAttribute('aria-expanded')).toBe('true');
      });

      it('does not mount the other slots again when the key changes', () => {
        const onListsMount = vi.fn();
        const onSceneMount = vi.fn();
        const firstProps = createProps({
          inspectorKey: 'deal:first',
          isInspectorOpen: true,
          listTabs: [{ content: <MountProbe onMount={onListsMount} />, id: 'deals', label: DEALS_TAB_LABEL }],
          scene: <MountProbe onMount={onSceneMount} />,
        });
        const { rerender } = render(withTestLocalizer(<HudLayout {...firstProps} />));

        rerender(withTestLocalizer(<HudLayout {...firstProps} inspectorKey="deal:second" />));

        expect(onListsMount).toHaveBeenCalledTimes(1);
        expect(onSceneMount).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when the viewport class changes', () => {
    it('never mounts a slot twice at once', () => {
      const slotNames = ['inspector', 'kpi', 'lists', 'panel', 'scene', 'tracker'] as const;
      const counters = Object.fromEntries(
        slotNames.map(name => [name, createLifecycleCounter()]),
      ) as Record<SlotNameValue, LifecycleCounterValue>;
      const createProbe = (name: SlotNameValue): ReactElement => (
        <MountProbe onMount={counters[name].onMount} onUnmount={counters[name].onUnmount} />
      );

      renderLayout({
        inspector: createProbe('inspector'),
        isInspectorOpen: true,
        kpi: createProbe('kpi'),
        listTabs: [{ content: createProbe('lists'), id: 'deals', label: DEALS_TAB_LABEL }],
        onInspectorClose: vi.fn(),
        panel: createProbe('panel'),
        scene: createProbe('scene'),
        tracker: createProbe('tracker'),
      });

      for (const viewportClass of ['tablet', 'phone', 'tablet', 'desktop', 'phone'] as const) {
        act(() => {
          viewport.setViewportClass(viewportClass);
        });
      }

      for (const slotName of slotNames) {
        expect(counters[slotName].peak).toBeLessThanOrEqual(1);
        expect(counters[slotName].active).toBeLessThanOrEqual(1);
      }
    });

    it('mounts the scene once for the whole series of transitions', () => {
      const onSceneMount = vi.fn();

      renderLayout(createProps({ scene: <MountProbe onMount={onSceneMount} /> }));
      const sceneZone = screen.getByTestId('hud-zone-scene');

      for (const viewportClass of ['tablet', 'phone', 'desktop', 'phone', 'tablet'] as const) {
        act(() => {
          viewport.setViewportClass(viewportClass);
        });

        expect(screen.getByTestId('hud-zone-scene')).toBe(sceneZone);
      }

      expect(onSceneMount).toHaveBeenCalledTimes(1);
    });
  });
});
