import type { Mock } from 'vitest';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  PageRequestValue,
  PageValue,
} from './collectPages';

import { collectPages } from './collectPages';

type FetchPageType = (page: PageRequestValue) => Promise<PageValue<number>>;

const createPagedSource = (pages: readonly PageValue<number>[]): Mock<FetchPageType> => {
  const requestedTokens = new Map<string, number>([['', 0]]);

  pages.forEach((page, index) => {
    if (page.nextPageToken !== '') {
      requestedTokens.set(page.nextPageToken, index + 1);
    }
  });

  return vi.fn<FetchPageType>(async (request) => {
    const pageIndex = requestedTokens.get(request.pageToken) ?? 0;
    const page = pages[pageIndex];

    return await Promise.resolve(page ?? { items: [], nextPageToken: '' });
  });
};

describe('collectPages', () => {
  it('requests every page with the page size of 200 and joins the items in order', async () => {
    const fetchPage = createPagedSource([
      { items: [1, 2], nextPageToken: 'second' },
      { items: [3], nextPageToken: 'third' },
      { items: [4, 5], nextPageToken: '' },
    ]);

    const items = await collectPages(fetchPage);

    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage.mock.calls.map(([request]) => request)).toEqual([
      { pageSize: 200, pageToken: '' },
      { pageSize: 200, pageToken: 'second' },
      { pageSize: 200, pageToken: 'third' },
    ]);
  });

  it('stops after the first page when there is no next page token', async () => {
    const fetchPage = createPagedSource([{ items: [7], nextPageToken: '' }]);

    expect(await collectPages(fetchPage)).toEqual([7]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list for an empty source', async () => {
    const fetchPage = createPagedSource([{ items: [], nextPageToken: '' }]);

    expect(await collectPages(fetchPage)).toEqual([]);
  });

  it('fails with a readable error when the server repeats a page token', async () => {
    const fetchPage = vi.fn((request: PageRequestValue): Promise<PageValue<number>> => Promise.resolve({
      items: [request.pageToken.length],
      nextPageToken: 'again',
    }));

    await expect(collectPages(fetchPage)).rejects.toThrow('The server repeated the page token "again"');
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('passes a failure of a page through', async () => {
    const fetchPage = vi.fn((): Promise<PageValue<number>> => Promise.reject(new Error('the page is unavailable')));

    await expect(collectPages(fetchPage)).rejects.toThrow('the page is unavailable');
  });
});
