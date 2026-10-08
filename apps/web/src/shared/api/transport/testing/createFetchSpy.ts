export interface FetchSpyValue {
  fetch: typeof globalThis.fetch;
  requests: { headers: Headers; url: string }[];
}

export const createFetchSpy = (): FetchSpyValue => {
  const requests: FetchSpyValue['requests'] = [];

  return {
    fetch: (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      requests.push({ headers: new Headers(init?.headers), url });

      return Promise.resolve(new Response(null, { status: 503 }));
    },
    requests,
  };
};
