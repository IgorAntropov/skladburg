import type {
  Page,
  Request,
  Response,
} from '@playwright/test';

import { expect } from '@playwright/test';

export interface BasePathRobotValue {
  expectLicensesServed: () => Promise<void>;
  expectNoBrokenRequests: () => void;
  expectOwnRequestsUnderBasePath: (baseUrl: string) => void;
}

const LICENSES_FILE_NAME = 'third-party-licenses.txt';
const HTTP_ERROR_STATUS_MIN = 400;

export const createBasePathRobot = (page: Page): BasePathRobotValue => {
  const requestUrls: string[] = [];
  const failedUrls: string[] = [];
  const errorResponses: string[] = [];

  page.on('request', (request: Request) => {
    requestUrls.push(request.url());
  });
  page.on('requestfailed', (request: Request) => {
    failedUrls.push(request.url());
  });
  page.on('response', (response: Response) => {
    if (response.status() >= HTTP_ERROR_STATUS_MIN) {
      errorResponses.push(`${String(response.status())} ${response.url()}`);
    }
  });

  return {
    async expectLicensesServed(): Promise<void> {
      const response = await page.request.get(`./${LICENSES_FILE_NAME}`);
      const body = await response.text();

      expect(response.status()).toBe(200);
      expect(body.trim().length).toBeGreaterThan(0);
    },
    expectNoBrokenRequests(): void {
      expect(failedUrls).toEqual([]);
      expect(errorResponses).toEqual([]);
    },
    expectOwnRequestsUnderBasePath(baseUrl: string): void {
      const { origin, pathname } = new URL(baseUrl);
      const ownRequests = requestUrls
        .map(url => new URL(url))
        .filter(url => url.origin === origin);

      expect(ownRequests.length).toBeGreaterThan(0);
      expect(ownRequests.filter(url => !url.pathname.startsWith(pathname)).map(url => url.href)).toEqual([]);
    },
  };
};
