import type { ReactElement } from 'react';

import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import { Suspense } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createCachedModuleLoader } from './createCachedModuleLoader';
import { createLazyComponent } from './createLazyComponent';

const FALLBACK_TEXT = 'loading';
const CONTENT_TEXT = 'content';
const FIRST_TITLE = 'one';
const SECOND_TITLE = 'two';

interface TestPageProps {
  title: string;
}

const TestPage = ({ title }: TestPageProps): ReactElement => <p>{`${CONTENT_TEXT} ${title}`}</p>;

describe('createLazyComponent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the loaded component with its props', async () => {
    const Lazy = createLazyComponent<TestPageProps>(createCachedModuleLoader(() => Promise.resolve({ default: TestPage })));

    render(
      <Suspense fallback={<p>{FALLBACK_TEXT}</p>}>
        <Lazy title={FIRST_TITLE} />
      </Suspense>,
    );

    expect(await screen.findByText(`${CONTENT_TEXT} ${FIRST_TITLE}`)).toBeDefined();
  });

  it('shows the component at once without the fallback when the module is already loaded', async () => {
    const load = createCachedModuleLoader(() => Promise.resolve({ default: TestPage }));
    await load();
    const Lazy = createLazyComponent<TestPageProps>(load);

    render(
      <Suspense fallback={<p>{FALLBACK_TEXT}</p>}>
        <Lazy title={SECOND_TITLE} />
      </Suspense>,
    );

    expect(screen.queryByText(FALLBACK_TEXT)).toBeNull();
    expect(screen.getByText(`${CONTENT_TEXT} ${SECOND_TITLE}`)).toBeDefined();
  });

  it('shows the component at once when the module was loaded after the lazy component was created', async () => {
    const load = createCachedModuleLoader(() => Promise.resolve({ default: TestPage }));
    const Lazy = createLazyComponent<TestPageProps>(load);
    await load();

    render(
      <Suspense fallback={<p>{FALLBACK_TEXT}</p>}>
        <Lazy title={FIRST_TITLE} />
      </Suspense>,
    );

    expect(screen.queryByText(FALLBACK_TEXT)).toBeNull();
    expect(screen.getByText(`${CONTENT_TEXT} ${FIRST_TITLE}`)).toBeDefined();
  });

  it('shows the fallback while the module loads and the component once it is loaded', async () => {
    let finishLoading: () => void = () => undefined;
    const load = createCachedModuleLoader(() => new Promise<{ default: typeof TestPage }>((resolve) => {
      finishLoading = (): void => {
        resolve({ default: TestPage });
      };
    }));
    const Lazy = createLazyComponent<TestPageProps>(load);

    render(
      <Suspense fallback={<p>{FALLBACK_TEXT}</p>}>
        <Lazy title={FIRST_TITLE} />
      </Suspense>,
    );

    expect(screen.getByText(FALLBACK_TEXT)).toBeDefined();

    finishLoading();

    expect(await screen.findByText(`${CONTENT_TEXT} ${FIRST_TITLE}`)).toBeDefined();
    expect(screen.queryByText(FALLBACK_TEXT)).toBeNull();
  });
});
