import type {
  KeyboardEvent,
  ReactElement,
} from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
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
import { ScenePlaceholder } from './ScenePlaceholder';

const catalog = defaultLocaleCatalog;

const PROBE_TEXT = 'Probe';
const FIELD_LABEL = 'Inside';
const PLACEHOLDER_LABEL = 'Map soon';
const LISTS_HEADER_TEXT = 'Lists header';
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

const ZONE_TEST_IDS: Readonly<Record<SlotNameValue, string>> = {
  inspector: 'hud-zone-inspector',
  kpi: 'hud-zone-kpi',
  lists: 'hud-zone-lists',
  panel: 'hud-zone-panel',
  scene: 'hud-zone-scene',
  tracker: 'hud-zone-tracker',
};

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

interface EscapeHandlerProps {
  label: string;
}

const EscapeHandler = ({ label }: EscapeHandlerProps): ReactElement => {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
    }
  };

  return <input aria-label={label} onKeyDown={handleKeyDown} />;
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

const expectInZone = (slot: SlotNameValue): void => {
  expect(within(screen.getByTestId(ZONE_TEST_IDS[slot])).getByText(SLOT_TEXT[slot])).toBeDefined();
};

const SIDE_FAMILIES = {
  m: ['top', 'right', 'bottom', 'left'],
  mb: ['bottom'],
  ml: ['left'],
  mr: ['right'],
  mt: ['top'],
  mx: ['right', 'left'],
  my: ['top', 'bottom'],
  p: ['top', 'right', 'bottom', 'left'],
  pb: ['bottom'],
  pl: ['left'],
  pr: ['right'],
  pt: ['top'],
  px: ['right', 'left'],
  py: ['top', 'bottom'],
} as const;

const SPACING_UTILITY_PATTERN = /^(?<family>[mp][xytrbl]?)-/;

const findSpacingConflicts = (className: string): string[] => {
  const tokensBySide = new Map<string, string[]>();

  for (const token of className.split(/\s+/)) {
    const family = SPACING_UTILITY_PATTERN.exec(token)?.groups?.family as keyof typeof SIDE_FAMILIES | undefined;

    if (family === undefined) {
      continue;
    }

    for (const side of SIDE_FAMILIES[family]) {
      const key = `${family.startsWith('m') ? 'margin' : 'padding'}-${side}`;
      tokensBySide.set(key, [...(tokensBySide.get(key) ?? []), token]);
    }
  }

  return [...tokensBySide.entries()]
    .filter(([, tokens]) => tokens.length > 1)
    .map(([side, tokens]) => `${side}: ${tokens.join(' ')}`);
};

const expectNoSpacingConflicts = (container: HTMLElement): void => {
  const conflicts = [...container.querySelectorAll('[class]')]
    .flatMap(element => findSpacingConflicts(element.getAttribute('class') ?? '').map(conflict => `${element.tagName} ${conflict}`));

  expect(conflicts).toEqual([]);
};

const expectNoSpacingConflictsOf = (className: string): void => {
  expect(findSpacingConflicts(className)).toEqual([]);
};

const expectNoSideOverrides = (className: string): void => {
  expect(className).not.toMatch(/(?:^|\s)(?:border-[xytrbl]-0|rounded-[trbl]{1,2}-none)(?:\s|$)/);
};

const expectNoZone = (slot: SlotNameValue): void => {
  expect(screen.queryByTestId(ZONE_TEST_IDS[slot])).toBeNull();
  expect(screen.queryByText(SLOT_TEXT[slot])).toBeNull();
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

  describe('on a desktop', () => {
    it.each(['inspector', 'kpi', 'lists', 'panel', 'scene', 'tracker'] as const)('puts the %s slot into its own zone', (slot) => {
      renderLayout(createProps());

      expectInZone(slot);
    });

    it('names the zones with sections from the catalog', () => {
      renderLayout(createProps());

      expect(screen.getByRole('region', { name: catalog['hud.kpi.label'] })).toBe(screen.getByTestId('hud-zone-kpi'));
      expect(screen.getByRole('region', { name: catalog['hud.inspector.title'] })).toBe(screen.getByTestId('hud-zone-inspector'));
      expect(screen.getByRole('region', { name: catalog['hud.tracker.label'] })).toBe(screen.getByTestId('hud-zone-tracker'));
      expect(screen.getByRole('region', { name: catalog['hud.lists.label'] })).toBe(screen.getByTestId('hud-zone-lists'));
      expect(screen.getByRole('region', { name: catalog['hud.panel.label'] })).toBe(screen.getByTestId('hud-zone-panel'));
    });

    it('does not add landmarks that the page frame already owns', () => {
      renderLayout(createProps());

      expect(screen.queryByRole('main')).toBeNull();
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(screen.queryByRole('banner')).toBeNull();
    });

    it.each([
      ['kpi', { kpi: undefined }],
      ['tracker', { tracker: null }],
      ['lists', { listTabs: [] }],
      ['panel', { panel: undefined }],
    ] as const)('draws no zone for an empty %s slot', (slot, overrides) => {
      renderLayout(createProps(overrides));

      expect(screen.queryByTestId(ZONE_TEST_IDS[slot])).toBeNull();
    });

    it('puts the header of the lists above their tabs in the lists zone', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p> }));

      const zone = screen.getByTestId('hud-zone-lists');
      const header = within(zone).getByText(LISTS_HEADER_TEXT);
      const tablist = within(zone).getByRole('tablist', { name: catalog['hud.lists.label'] });

      expect(header.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(tablist).getAllByRole('tab').map(tab => tab.textContent)).toEqual([DEALS_TAB_LABEL, TRIPS_TAB_LABEL]);
    });

    it('draws the lists zone for a header without tabs', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p>, listTabs: undefined }));

      expect(within(screen.getByTestId('hud-zone-lists')).getByText(LISTS_HEADER_TEXT)).toBeDefined();
      expect(screen.queryByRole('tablist')).toBeNull();
    });

    it('keeps the tracker out of the tabs of the lists', () => {
      renderLayout(createProps());

      expect(within(screen.getByTestId('hud-zone-lists')).getAllByRole('tab')).toHaveLength(2);
      expect(within(screen.getByTestId('hud-zone-tracker')).queryByRole('tab')).toBeNull();
    });

    it('keeps the inspector visible without an open object', () => {
      renderLayout(createProps({ isInspectorOpen: false }));

      expectInZone('inspector');
    });

    it('keeps the inspector and the scene when every other slot is empty', () => {
      renderLayout({
        inspector: <p>{SLOT_TEXT.inspector}</p>,
        isInspectorOpen: false,
        onInspectorClose: vi.fn(),
        scene: <p>{SLOT_TEXT.scene}</p>,
      });

      expectInZone('inspector');
      expectInZone('scene');
      expectNoZone('kpi');
      expectNoZone('tracker');
      expectNoZone('lists');
      expectNoZone('panel');
    });

    it('lets the pointer through to the scene wherever there is no zone', () => {
      renderLayout(createProps());
      const zone = screen.getByTestId('hud-zone-kpi');
      const overlay = zone.parentElement?.parentElement;

      expect(overlay?.className).toContain('pointer-events-none');
      expect(zone.className).toContain('pointer-events-auto');
    });

    it('makes every zone a container for container queries', () => {
      renderLayout(createProps());

      for (const slot of ['inspector', 'kpi', 'lists', 'panel', 'tracker'] as const) {
        expect(screen.getByTestId(ZONE_TEST_IDS[slot]).className).toContain('@container');
      }
    });

    it('does not call the close handler on Escape', () => {
      const props = createProps();
      renderLayout(props);

      fireEvent.keyDown(screen.getByTestId('hud-zone-inspector'), { key: 'Escape' });

      expect(props.onInspectorClose).not.toHaveBeenCalled();
    });
  });

  describe('on a tablet', () => {
    beforeEach(() => {
      viewport.setViewportClass('tablet');
    });

    it.each(['kpi', 'panel', 'scene'] as const)('puts the %s slot into its own zone', (slot) => {
      renderLayout(createProps());

      expectInZone(slot);
    });

    it('draws no inspector until an object is open', () => {
      renderLayout(createProps({ isInspectorOpen: false }));

      expectNoZone('inspector');
    });

    it('slides the inspector in over the page when an object is open', () => {
      renderLayout(createProps({ isInspectorOpen: true }));

      expectInZone('inspector');
      expect(screen.getByTestId('hud-zone-inspector').className).toContain('absolute');
    });

    it('asks to close the inspector on Escape inside it', () => {
      const props = createProps({ isInspectorOpen: true });
      renderLayout(props);

      fireEvent.keyDown(within(screen.getByTestId('hud-zone-inspector')).getByText(SLOT_TEXT.inspector), { key: 'Escape' });

      expect(props.onInspectorClose).toHaveBeenCalledTimes(1);
    });

    it('does not close the inspector on Escape that a nested layer has handled', () => {
      const props = createProps({ inspector: <EscapeHandler label={FIELD_LABEL} />, isInspectorOpen: true });
      renderLayout(props);

      fireEvent.keyDown(screen.getByLabelText(FIELD_LABEL), { key: 'Escape' });

      expect(props.onInspectorClose).not.toHaveBeenCalled();
    });

    it('ignores the other keys inside the inspector', () => {
      const props = createProps({ isInspectorOpen: true });
      renderLayout(props);

      fireEvent.keyDown(screen.getByTestId('hud-zone-inspector'), { key: 'Enter' });

      expect(props.onInspectorClose).not.toHaveBeenCalled();
    });

    it('puts the tracker and the tabs of the lists into one flat row of tabs', () => {
      renderLayout(createProps());

      const tablist = screen.getByRole('tablist', { name: catalog['hud.bottom.label'] });

      expect(screen.getAllByRole('tablist')).toHaveLength(1);
      expect(within(tablist).getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        catalog['hud.tracker.label'],
        DEALS_TAB_LABEL,
        TRIPS_TAB_LABEL,
      ]);
    });

    it('selects the tracker first and shows only its content', () => {
      renderLayout(createProps());

      expect(screen.getByRole('tab', { name: catalog['hud.tracker.label'] }).getAttribute('aria-selected')).toBe('true');
      expect(within(screen.getByTestId('hud-zone-tracker')).getByText(SLOT_TEXT.tracker)).toBeDefined();
      expect(screen.queryByText(SLOT_TEXT.lists)).toBeNull();
    });

    it('marks the root of the bottom zone as the lists zone and the row as the bottom tabs', () => {
      renderLayout(createProps());

      const zone = screen.getByTestId('hud-zone-lists');
      const tabs = screen.getByTestId('hud-bottom-tabs');

      expect(zone).toBe(screen.getByRole('region', { name: catalog['hud.bottom.label'] }));
      expect(zone.contains(tabs)).toBe(true);
      expect(within(tabs).getByRole('tablist')).toBe(screen.getByRole('tablist'));
      expect(tabs.contains(screen.getByTestId('hud-zone-tracker'))).toBe(true);
    });

    it('shows the content of a list after its tab is pressed', () => {
      renderLayout(createProps());

      fireEvent.mouseDown(screen.getByRole('tab', { name: DEALS_TAB_LABEL }));

      expect(within(screen.getByTestId('hud-zone-lists')).getByText(SLOT_TEXT.lists)).toBeDefined();
      expect(screen.queryByText(SLOT_TEXT.tracker)).toBeNull();

      fireEvent.mouseDown(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }));

      expect(screen.getByText(TRIPS_TEXT)).toBeDefined();
      expect(screen.queryByText(SLOT_TEXT.lists)).toBeNull();
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

    it('puts the header of the lists above the content of every list tab and not into the tracker', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p> }));

      expect(screen.queryByText(LISTS_HEADER_TEXT)).toBeNull();

      fireEvent.mouseDown(screen.getByRole('tab', { name: DEALS_TAB_LABEL }));

      const header = screen.getByText(LISTS_HEADER_TEXT);
      const content = screen.getByText(SLOT_TEXT.lists);

      expect(header.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getAllByRole('tablist')).toHaveLength(1);

      fireEvent.mouseDown(screen.getByRole('tab', { name: TRIPS_TAB_LABEL }));

      expect(screen.getByText(LISTS_HEADER_TEXT)).toBeDefined();
    });

    it('keeps one bottom zone with two tabs for the tracker and a header without tabs', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p>, listTabs: undefined }));

      const tablist = screen.getByRole('tablist', { name: catalog['hud.bottom.label'] });

      expect(screen.getAllByRole('region', { name: catalog['hud.bottom.label'] })).toHaveLength(1);
      expect(screen.getAllByTestId('hud-zone-lists')).toHaveLength(1);
      expect(screen.queryByRole('region', { name: catalog['hud.tracker.label'] })).toBeNull();
      expect(screen.queryByRole('region', { name: catalog['hud.lists.label'] })).toBeNull();
      expect(within(tablist).getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        catalog['hud.tracker.label'],
        catalog['hud.lists.label'],
      ]);
      expect(within(screen.getByTestId('hud-zone-tracker')).getByText(SLOT_TEXT.tracker)).toBeDefined();
      expect(screen.queryByText(LISTS_HEADER_TEXT)).toBeNull();
    });

    it('shows the header without tabs as the content of the lists tab', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p>, listTabs: undefined }));

      fireEvent.mouseDown(screen.getByRole('tab', { name: catalog['hud.lists.label'] }));

      expect(within(screen.getByTestId('hud-zone-lists')).getByText(LISTS_HEADER_TEXT)).toBeDefined();
      expect(screen.queryByText(SLOT_TEXT.tracker)).toBeNull();
    });

    it('keeps the tabs of the lists without the extra lists tab when there are tabs and a header', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p> }));

      expect(screen.queryByRole('tab', { name: catalog['hud.lists.label'] })).toBeNull();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('puts the only tracker into the bottom zone without tabs', () => {
      renderLayout(createProps({ listTabs: undefined }));

      expect(screen.queryByRole('tablist')).toBeNull();
      expect(screen.queryByTestId('hud-bottom-tabs')).toBeNull();
      expectInZone('tracker');
      expectNoZone('lists');
    });

    it('puts the only lists into the bottom zone with their own tabs and without the tracker', () => {
      renderLayout(createProps({ tracker: undefined }));

      const tablist = screen.getByRole('tablist', { name: catalog['hud.lists.label'] });

      expect(within(tablist).getAllByRole('tab').map(tab => tab.textContent)).toEqual([DEALS_TAB_LABEL, TRIPS_TAB_LABEL]);
      expect(screen.queryByTestId('hud-bottom-tabs')).toBeNull();
      expectInZone('lists');
      expectNoZone('tracker');
    });

    it('puts the header of the only lists above their tabs', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p>, tracker: undefined }));

      const header = screen.getByText(LISTS_HEADER_TEXT);
      const tablist = screen.getByRole('tablist', { name: catalog['hud.lists.label'] });

      expect(header.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    it('draws no bottom zone and no empty main zone without the slots', () => {
      renderLayout(createProps({
        kpi: undefined,
        listTabs: undefined,
        panel: undefined,
        tracker: undefined,
      }));

      expect(screen.queryByTestId('hud-zone-kpi')).toBeNull();
      expect(screen.queryByTestId('hud-zone-panel')).toBeNull();
      expect(screen.queryByTestId('hud-zone-lists')).toBeNull();
      expect(screen.queryByRole('tablist')).toBeNull();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => {
      viewport.setViewportClass('phone');
    });

    it('shows the lists as the only main zone when both slots are filled', () => {
      renderLayout(createProps());

      expectInZone('lists');
      expectNoZone('panel');
    });

    it('shows the panel as the main zone when there are no lists', () => {
      renderLayout(createProps({ listTabs: undefined }));

      expectInZone('panel');
      expectNoZone('lists');
    });

    it('puts the header of the lists above their tabs in the main zone', () => {
      renderLayout(createProps({ listsHeader: <p>{LISTS_HEADER_TEXT}</p> }));

      const zone = screen.getByTestId('hud-zone-lists');
      const header = within(zone).getByText(LISTS_HEADER_TEXT);
      const tablist = within(zone).getByRole('tablist', { name: catalog['hud.lists.label'] });

      expect(header.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('does not mount the kpi and the tracker', () => {
      renderLayout(createProps());

      expectNoZone('kpi');
      expectNoZone('tracker');
    });

    it('keeps the scene', () => {
      renderLayout(createProps());

      expectInZone('scene');
    });

    it('draws no sheet until an object is open', () => {
      renderLayout(createProps({ isInspectorOpen: false }));

      expect(screen.queryByTestId('hud-inspector-sheet')).toBeNull();
      expectNoZone('inspector');
    });

    it('opens the sheet expanded', () => {
      renderLayout(createProps({ isInspectorOpen: true }));
      const toggle = screen.getByRole('button', { name: catalog['hud.inspector.collapse'] });

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText(SLOT_TEXT.inspector)).toBeDefined();
      expect(screen.getByTestId('hud-inspector-sheet')).toBe(screen.getByRole('region', { name: catalog['hud.inspector.title'] }));
    });

    it('controls the content of the sheet with the toggle', () => {
      renderLayout(createProps({ isInspectorOpen: true }));
      const toggle = screen.getByRole('button', { name: catalog['hud.inspector.collapse'] });
      const content = screen.getByText(SLOT_TEXT.inspector).parentElement;

      expect(content).not.toBeNull();
      expect(toggle.getAttribute('aria-controls')).toBe(content?.id);
    });

    it('collapses and expands the sheet with the toggle', () => {
      renderLayout(createProps({ isInspectorOpen: true }));

      fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }));

      const expandToggle = screen.getByRole('button', { name: catalog['hud.inspector.expand'] });

      expect(expandToggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByText(SLOT_TEXT.inspector, { selector: 'p' }).parentElement?.hidden).toBe(true);

      fireEvent.click(expandToggle);

      expect(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText(SLOT_TEXT.inspector).parentElement?.hidden).toBe(false);
    });

    it('collapses the expanded sheet on Escape and returns the focus to the toggle', () => {
      renderLayout(createProps({
        inspector: <input aria-label={FIELD_LABEL} />,
        isInspectorOpen: true,
      }));
      const field = screen.getByLabelText(FIELD_LABEL);
      field.focus();

      fireEvent.keyDown(field, { key: 'Escape' });

      const toggle = screen.getByRole('button', { name: catalog['hud.inspector.expand'] });

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle);
    });

    it('keeps the sheet expanded on Escape that a nested layer has handled', () => {
      renderLayout(createProps({ inspector: <EscapeHandler label={FIELD_LABEL} />, isInspectorOpen: true }));
      const field = screen.getByLabelText(FIELD_LABEL);
      field.focus();

      fireEvent.keyDown(field, { key: 'Escape' });

      expect(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }).getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(field);
    });

    it('keeps the collapsed sheet collapsed on Escape', () => {
      renderLayout(createProps({ isInspectorOpen: true }));
      fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }));
      const toggle = screen.getByRole('button', { name: catalog['hud.inspector.expand'] });
      toggle.focus();

      fireEvent.keyDown(toggle, { key: 'Escape' });

      expect(screen.getByRole('button', { name: catalog['hud.inspector.expand'] }).getAttribute('aria-expanded')).toBe('false');
    });

    it('does not trap the focus and does not close the inspector on Escape', () => {
      const props = createProps({ isInspectorOpen: true });
      renderLayout(props);

      fireEvent.keyDown(screen.getByTestId('hud-inspector-sheet'), { key: 'Escape' });

      expect(props.onInspectorClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
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

    it('keeps the touch target of the toggle at 44 px', () => {
      renderLayout(createProps({ isInspectorOpen: true }));

      expect(screen.getByRole('button', { name: catalog['hud.inspector.collapse'] }).className).toContain('min-h-11');
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

    it('moves the slots into the zones of the new class', () => {
      renderLayout(createProps({ isInspectorOpen: true }));

      act(() => {
        viewport.setViewportClass('phone');
      });

      expectNoZone('kpi');
      expect(screen.getByTestId('hud-inspector-sheet')).toBeDefined();

      act(() => {
        viewport.setViewportClass('desktop');
      });

      expectInZone('kpi');
      expect(screen.queryByTestId('hud-inspector-sheet')).toBeNull();
      expectInZone('inspector');
    });
  });

  describe('classes of the zones', () => {
    it.each(['desktop', 'tablet', 'phone'] as const)('has no competing margins or paddings on a %s', (viewportClass) => {
      viewport.setViewportClass(viewportClass);
      const { container } = render(withTestLocalizer(<HudLayout {...createProps({ isInspectorOpen: true })} />));

      expectNoSpacingConflicts(container);
    });

    it('detects the competing paddings and margins', () => {
      expect(findSpacingConflicts('p-4 pb-2')).toEqual(['padding-bottom: p-4 pb-2']);
      expect(findSpacingConflicts('mx-2 ml-1 hover:p-2')).toEqual(['margin-left: mx-2 ml-1']);
      expect(findSpacingConflicts('px-4 pt-4 pb-4')).toEqual([]);
    });

    it('puts the tabs of the bottom zone flush to the edge with the one safe area padding', () => {
      viewport.setViewportClass('tablet');
      renderLayout(createProps());
      const zone = screen.getByRole('region', { name: catalog['hud.bottom.label'] });

      expect(zone.className).toContain('px-0 pt-0 pb-[env(safe-area-inset-bottom)]');
      expect(zone.className).not.toMatch(/(?:^|\s)p-[04](?:\s|$)/);
      expectNoSpacingConflictsOf(zone.className);
    });

    it.each([
      ['tracker', { listTabs: undefined }],
      ['lists', { tracker: undefined }],
    ] as const)('keeps the lone %s zone of a tablet above the safe area', (slot, overrides) => {
      viewport.setViewportClass('tablet');
      renderLayout(createProps(overrides));
      const { className } = screen.getByTestId(ZONE_TEST_IDS[slot]);

      expect(className).toContain('pb-[max(1rem,env(safe-area-inset-bottom))]');
      expect(className).not.toMatch(/(?:^|\s)p-4(?:\s|$)/);
    });

    it('keeps the main zone of a phone off the safe areas', () => {
      viewport.setViewportClass('phone');
      renderLayout(createProps());
      const { className } = screen.getByTestId('hud-zone-lists');

      expect(className).toContain('mb-[max(0.75rem,env(safe-area-inset-bottom))]');
      expect(className).toContain('ml-[max(0.75rem,env(safe-area-inset-left))]');
      expect(className).toContain('mr-[max(0.75rem,env(safe-area-inset-right))]');
    });

    it('shapes the drawer and the sheet without overriding the sides of a base class', () => {
      viewport.setViewportClass('tablet');
      renderLayout(createProps({ isInspectorOpen: true }));

      expectNoSideOverrides(screen.getByTestId('hud-zone-inspector').className);

      act(() => {
        viewport.setViewportClass('phone');
      });

      expectNoSideOverrides(screen.getByTestId('hud-inspector-sheet').className);
    });
  });

  describe('heights of the zones', () => {
    it('gives the kpi and the tracker of a desktop the same minimum height', () => {
      renderLayout(createProps());
      const kpi = screen.getByTestId('hud-zone-kpi').className;
      const tracker = screen.getByTestId('hud-zone-tracker').className;

      expect(kpi).toContain('min-h-48');
      expect(tracker).toContain('min-h-48');
    });

    it('splits the right column of a desktop without overflowing it', () => {
      renderLayout(createProps());

      expect(screen.getByTestId('hud-zone-inspector').className).toContain('max-h-[calc(55%-0.5rem)]');
      expect(screen.getByTestId('hud-zone-lists').className).toContain('max-h-[calc(45%-0.5rem)]');
    });

    it('keeps the minimum content height of every panel of the bottom tabs of a tablet', () => {
      viewport.setViewportClass('tablet');
      renderLayout(createProps());

      expect(screen.getByTestId('hud-bottom-tabs').className).toContain('[&_[role=tabpanel]]:min-h-32');
    });

    it('keeps the tracker tab of a tablet centered like the other tabs', () => {
      viewport.setViewportClass('tablet');
      renderLayout(createProps());

      expect(screen.getByTestId('hud-zone-tracker').className).toContain('flex-1');
    });
  });

  describe('motion of the drawer and the sheet', () => {
    it('slides the drawer on the panel tokens', () => {
      viewport.setViewportClass('tablet');
      renderLayout(createProps({ isInspectorOpen: true }));
      const { className } = screen.getByTestId('hud-zone-inspector');

      expect(className).toContain('motion-safe:duration-(--duration-panel)');
      expect(className).toContain('motion-safe:ease-out');
      expect(className).not.toMatch(/duration-300|cubic-bezier/);
    });

    it('lifts the sheet on the panel tokens', () => {
      viewport.setViewportClass('phone');
      renderLayout(createProps({ isInspectorOpen: true }));
      const { className } = screen.getByTestId('hud-inspector-sheet');

      expect(className).toContain('motion-safe:duration-(--duration-panel)');
      expect(className).toContain('motion-safe:ease-out');
      expect(className).not.toMatch(/duration-300|cubic-bezier/);
    });
  });

  describe('ScenePlaceholder', () => {
    it('draws a wider and quieter grid that is not denser around the label', () => {
      const { container } = render(<ScenePlaceholder label={PLACEHOLDER_LABEL} />);
      const html = container.innerHTML;

      expect(html).toContain('transparent_0_95px');
      expect(html).toContain('color-mix(in_srgb,var(--color-line)_55%,transparent)');
      expect(html).toContain('radial-gradient(ellipse_at_center,transparent_0,black_70%)');
    });

    it('shows its label and hides itself from screen readers as a decoration', () => {
      render(<ScenePlaceholder label={PLACEHOLDER_LABEL} />);
      const label = screen.getByText(PLACEHOLDER_LABEL);

      expect(label.parentElement?.getAttribute('aria-hidden')).toBe('true');
      expect(label.parentElement?.className).toContain('bg-canvas');
    });
  });
});
