import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { Panel } from './Panel';

const CONTENT = 'Panel content';
const PANEL_LABEL = 'Top';

describe('Panel', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a div by default', () => {
    render(<Panel data-testid="panel">{CONTENT}</Panel>);

    expect(screen.getByTestId('panel').tagName).toBe('DIV');
  });

  it.each([
    ['aside', 'ASIDE'],
    ['div', 'DIV'],
    ['header', 'HEADER'],
    ['section', 'SECTION'],
  ] as const)('renders the %s tag when asked for it', (as, tagName) => {
    render(<Panel as={as} data-testid="panel">{CONTENT}</Panel>);

    expect(screen.getByTestId('panel').tagName).toBe(tagName);
  });

  it('is the banner landmark as a header outside of sections', () => {
    render(<Panel as="header">{CONTENT}</Panel>);

    expect(screen.getByRole('banner')).toBeTruthy();
  });

  it('passes the attributes and the children through', () => {
    render(<Panel aria-label={PANEL_LABEL} data-testid="panel" id="top">{CONTENT}</Panel>);
    const panel = screen.getByTestId('panel');

    expect(panel.getAttribute('aria-label')).toBe(PANEL_LABEL);
    expect(panel.id).toBe('top');
    expect(panel.textContent).toBe(CONTENT);
  });

  it('uses the panel tokens and keeps the caller class name last', () => {
    render(<Panel className="w-full" data-testid="panel" />);
    const { className } = screen.getByTestId('panel');

    expect(className).toContain('bg-panel');
    expect(className).toContain('text-on-panel');
    expect(className.endsWith('w-full')).toBe(true);
  });
});
