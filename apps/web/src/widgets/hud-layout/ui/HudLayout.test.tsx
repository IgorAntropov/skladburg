import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  StrictMode,
  useEffect,
} from 'react';
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

import {
  CollapseHudPanelsButton,
  requestHudMapView,
} from '@/features/collapse-hud-panels';
import { resetHudPanelsStore } from '@/features/collapse-hud-panels/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';

import type { HudLayoutProps } from '../lib/hudLayoutTypes';

import { HudLayout } from './HudLayout';
import { ListsZoneContent } from './ListsZoneContent';

vi.mock('./ListsZoneContent', async (importOriginal) => {
  const actual = await importOriginal<{ ListsZoneContent: typeof ListsZoneContent }>();

  return { ListsZoneContent: vi.fn(actual.ListsZoneContent) };
});

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
  sceneControls: 'Scene controls slot',
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

const withPanelsToggle = (props: HudLayoutProps): ReactElement => (
  withTestLocalizer(
    <>
      <CollapseHudPanelsButton />
      <HudLayout {...props} />
    </>,
  )
);

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
          panel: undefined,
          scene: <MountProbe onMount={onSceneMount} />,
        });
        const { rerender } = render(withTestLocalizer(<HudLayout {...firstProps} />));

        rerender(withTestLocalizer(<HudLayout {...firstProps} inspectorKey="deal:second" />));

        expect(onListsMount).toHaveBeenCalledTimes(1);
        expect(onSceneMount).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('on a phone with collapsible panels', () => {
    const panelsToggleName = catalog['hud.panels.mapView'];

    const pressPanelsToggle = (): void => {
      fireEvent.click(screen.getByRole('button', { name: panelsToggleName }));
    };

    const readListsZone = (): HTMLElement => {
      const zone = document.querySelector<HTMLElement>(`section[aria-label="${catalog['hud.lists.label']}"]`);

      if (zone === null) {
        throw new Error('The lists zone is not rendered');
      }

      return zone;
    };

    const inspectorButtonText = 'Inspector action';

    const createInspectorProps = (overrides: Partial<HudLayoutProps> = {}): HudLayoutProps => createProps({
      canCollapsePanels: true,
      inspector: <button type="button">{inspectorButtonText}</button>,
      inspectorKey: 'site:first',
      isInspectorOpen: true,
      panel: undefined,
      ...overrides,
    });

    const readSheetToggle = (): HTMLElement => {
      const toggle = document.querySelector<HTMLElement>(`section[aria-label="${catalog['hud.inspector.title']}"] > button`);

      if (toggle === null) {
        throw new Error('The sheet handle is not rendered');
      }

      return toggle;
    };

    beforeEach(() => {
      resetHudPanelsStore();
      viewport.setViewportClass('phone');
    });

    afterEach(() => {
      resetHudPanelsStore();
    });

    it('hides the main zone without mounting it again and keeps the pressed tab', () => {
      const onTripsMount = vi.fn();
      const onTripsUnmount = vi.fn();
      const props = createProps({
        canCollapsePanels: true,
        listTabs: [
          { content: <p>{SLOT_TEXT.lists}</p>, id: 'deals', label: DEALS_TAB_LABEL },
          { content: <MountProbe onMount={onTripsMount} onUnmount={onTripsUnmount} />, id: 'trips', label: TRIPS_TAB_LABEL },
        ],
        panel: undefined,
      });
      render(withPanelsToggle(props));
      fireEvent.mouseDown(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }));
      const zone = readListsZone();

      pressPanelsToggle();

      expect(readListsZone()).toBe(zone);
      expect(zone.hidden).toBe(true);

      pressPanelsToggle();

      expect(readListsZone()).toBe(zone);
      expect(zone.hidden).toBe(false);
      expect(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }).getAttribute('aria-selected')).toBe('true');
      expect(onTripsMount).toHaveBeenCalledTimes(1);
      expect(onTripsUnmount).not.toHaveBeenCalled();
    });

    it('opens a new inspector collapsed while the panels are hidden and expanded while they are shown', () => {
      const baseProps = createProps({ canCollapsePanels: true, inspectorKey: 'site:first', isInspectorOpen: false, panel: undefined });
      const { rerender } = render(withPanelsToggle(baseProps));

      rerender(withPanelsToggle({ ...baseProps, inspectorKey: 'site:first', isInspectorOpen: true }));

      expect(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }).getAttribute('aria-expanded')).toBe('true');

      pressPanelsToggle();
      rerender(withPanelsToggle({ ...baseProps, inspectorKey: 'site:second', isInspectorOpen: true }));

      expect(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }).getAttribute('aria-expanded')).toBe('false');

      pressPanelsToggle();
      rerender(withPanelsToggle({ ...baseProps, inspectorKey: 'site:third', isInspectorOpen: true }));

      expect(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }).getAttribute('aria-expanded')).toBe('true');
    });

    it('collapses an expanded inspector when the panels hide and leaves it alone when they return', () => {
      render(withPanelsToggle(createProps({
        canCollapsePanels: true,
        inspectorKey: 'site:first',
        isInspectorOpen: true,
        panel: undefined,
      })));

      expect(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }).getAttribute('aria-expanded')).toBe('true');

      pressPanelsToggle();

      expect(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }).getAttribute('aria-expanded')).toBe('false');

      pressPanelsToggle();

      expect(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }).getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps the focus that is outside of the sheet', () => {
      render(withPanelsToggle(createInspectorProps()));
      const panelsToggle = screen.getByRole('button', { name: panelsToggleName });
      panelsToggle.focus();

      pressPanelsToggle();

      expect(document.activeElement).toBe(panelsToggle);
      expect(readSheetToggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('does not render the hidden lists again on a repeated map view request and still collapses the sheet', () => {
      render(withPanelsToggle(createInspectorProps()));
      pressPanelsToggle();
      fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }));

      expect(readSheetToggle().getAttribute('aria-expanded')).toBe('true');

      vi.mocked(ListsZoneContent).mockClear();

      act(() => {
        requestHudMapView(0);
      });

      expect(readSheetToggle().getAttribute('aria-expanded')).toBe('false');
      expect(readListsZone().hidden).toBe(true);
      expect(ListsZoneContent).not.toHaveBeenCalled();
    });

    it('collapses an expanded sheet when the layout starts to allow collapsing while the mode is on', () => {
      const baseProps = createInspectorProps({ canCollapsePanels: false });
      const { rerender } = render(withPanelsToggle(createInspectorProps({ canCollapsePanels: true })));
      pressPanelsToggle();
      rerender(withPanelsToggle(baseProps));
      fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }));

      expect(readSheetToggle().getAttribute('aria-expanded')).toBe('true');

      rerender(withPanelsToggle({ ...baseProps, canCollapsePanels: true }));

      expect(readSheetToggle().getAttribute('aria-expanded')).toBe('false');
    });

    describe('when the map view is requested', () => {
      const requestMapView = (): void => {
        act(() => {
          requestHudMapView(0);
        });
      };

      it('collapses the inspector the person expanded by hand while the panels are already hidden', () => {
        render(withPanelsToggle(createInspectorProps()));
        pressPanelsToggle();
        fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }));

        expect(readSheetToggle().getAttribute('aria-expanded')).toBe('true');

        requestMapView();

        expect(readSheetToggle().getAttribute('aria-expanded')).toBe('false');
        expect(readListsZone().hidden).toBe(true);
      });

      it('moves the focus from the inspector body to the sheet handle', () => {
        render(withPanelsToggle(createInspectorProps()));
        screen.getByRole('button', { name: inspectorButtonText }).focus();

        requestMapView();

        expect(document.activeElement).toBe(readSheetToggle());
      });

      it('moves the focus to the sheet handle when nothing holds it', () => {
        render(withPanelsToggle(createInspectorProps()));

        requestMapView();

        expect(document.activeElement).toBe(readSheetToggle());
      });

      it('does not collapse or focus a new inspector with the signal that was raised before it opened', () => {
        const baseProps = createInspectorProps({ isInspectorOpen: false });
        const { rerender } = render(withPanelsToggle(baseProps));

        requestMapView();
        pressPanelsToggle();
        rerender(withPanelsToggle({ ...baseProps, isInspectorOpen: true }));

        expect(readSheetToggle().getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).not.toBe(readSheetToggle());

        rerender(withPanelsToggle({ ...baseProps, inspectorKey: 'site:second', isInspectorOpen: true }));

        expect(readSheetToggle().getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).not.toBe(readSheetToggle());
      });

      it('collapses the inspector once under strict mode', () => {
        render(<StrictMode>{withPanelsToggle(createInspectorProps())}</StrictMode>);
        screen.getByRole('button', { name: inspectorButtonText }).focus();

        requestMapView();

        expect(readSheetToggle().getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(readSheetToggle());
      });
    });
  });

  describe('on a phone with both the lists and the panel', () => {
    beforeEach(() => {
      viewport.setViewportClass('phone');
    });

    it('shows the panel and no lists, and brings the lists back when the panel leaves', () => {
      const { rerender } = render(withTestLocalizer(<HudLayout {...createProps()} />));

      expect(screen.getByText(SLOT_TEXT.panel)).toBeDefined();
      expect(screen.queryByText(SLOT_TEXT.lists)).toBeNull();
      expect(screen.queryByRole('tablist')).toBeNull();

      rerender(withTestLocalizer(<HudLayout {...createProps({ panel: undefined })} />));

      expect(screen.getByText(SLOT_TEXT.lists)).toBeDefined();
      expect(screen.queryByText(SLOT_TEXT.panel)).toBeNull();
    });
  });

  describe('with the scene controls', () => {
    it.each(['desktop', 'tablet'] as const)('shows them on a %s', (viewportClass) => {
      viewport.setViewportClass(viewportClass);

      renderLayout(createProps({ sceneControls: <p>{SLOT_TEXT.sceneControls}</p> }));

      expect(screen.getByText(SLOT_TEXT.sceneControls)).toBeDefined();
    });

    it('does not render them on a phone', () => {
      viewport.setViewportClass('phone');

      renderLayout(createProps({ sceneControls: <p>{SLOT_TEXT.sceneControls}</p> }));

      expect(screen.queryByText(SLOT_TEXT.sceneControls)).toBeNull();
    });
  });

  describe('with the free area', () => {
    it('keeps a single free area while the viewport class changes', () => {
      renderLayout(createProps());

      for (const viewportClass of ['tablet', 'phone', 'desktop'] as const) {
        act(() => {
          viewport.setViewportClass(viewportClass);
        });

        expect(screen.queryAllByTestId('hud-free-area')).toHaveLength(viewportClass === 'phone' ? 0 : 1);
      }
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
