export const COLLECTED_PAGE_SIZE = 200;

export interface PageRequestValue {
  pageSize: number;
  pageToken: string;
}

export interface PageValue<TItem> {
  items: readonly TItem[];
  nextPageToken: string;
}

export const collectPages = async <TItem>(fetchPage: (page: PageRequestValue) => Promise<PageValue<TItem>>): Promise<TItem[]> => {
  const items: TItem[] = [];
  const requestedTokens = new Set<string>();
  let pageToken = '';

  for (;;) {
    requestedTokens.add(pageToken);

    const page = await fetchPage({ pageSize: COLLECTED_PAGE_SIZE, pageToken });

    items.push(...page.items);

    if (page.nextPageToken === '') {
      return items;
    }

    if (requestedTokens.has(page.nextPageToken)) {
      throw new Error(`The server repeated the page token "${page.nextPageToken}" while the pages were being collected`);
    }

    pageToken = page.nextPageToken;
  }
};
