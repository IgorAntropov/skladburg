import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  SupportErrorRefFormRules,
  SupportTicketContextFormRules,
} from '@skladburg/contracts/forms/support/v1/support_ticket';
import {
  type SupportDevice,
  type SupportErrorRef,
  SupportErrorRefSchema,
  type SupportTicketContext,
  SupportTicketContextSchema,
} from '@skladburg/contracts/support/v1/support_ticket';

import type { ErrorJournalEntryValue } from '@/shared/api';
import type { AppAddressValue } from '@/shared/routing';

import { isKnownErrorCode } from '@/shared/api';
import { formatAddressPath } from '@/shared/routing';

export interface CollectSupportContextInputValue {
  address: AppAddressValue | undefined;
  appVersion: string;
  device: SupportDevice;
  errors: readonly ErrorJournalEntryValue[];
}

const MAX_ERRORS = SupportTicketContextFormRules.fields.errors.maxItems;

const ROOT_PATH = '/';

const DEV_VERSION = 'dev';

const JOURNAL_UNKNOWN_METHOD = 'unknown';

const SCREEN_PATH_PATTERN = new RegExp(SupportTicketContextFormRules.fields.screenPath.pattern, 'u');

const APP_VERSION_PATTERN = new RegExp(SupportTicketContextFormRules.fields.appVersion.pattern, 'u');

const METHOD_PATTERN = new RegExp(SupportErrorRefFormRules.fields.method.pattern, 'u');

const METHOD_MAX_LENGTH = SupportErrorRefFormRules.fields.method.maxLen;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveScreenPath = (address: AppAddressValue | undefined): string => {
  if (address === undefined) {
    return ROOT_PATH;
  }

  const path = formatAddressPath(address);

  return SCREEN_PATH_PATTERN.test(path) ? path : ROOT_PATH;
};

const resolveAppVersion = (appVersion: string): string => (
  APP_VERSION_PATTERN.test(appVersion) ? appVersion : DEV_VERSION
);

const resolveMethod = (method: string): string => {
  if (method === JOURNAL_UNKNOWN_METHOD || method.length > METHOD_MAX_LENGTH) {
    return '';
  }

  return METHOD_PATTERN.test(method) ? method : '';
};

const resolveTraceId = (traceId: string | undefined): string => (
  traceId !== undefined && UUID_PATTERN.test(traceId) ? traceId : ''
);

const toErrorRef = (entry: ErrorJournalEntryValue): SupportErrorRef => create(SupportErrorRefSchema, {
  code: entry.code,
  method: resolveMethod(entry.method),
  occurredAt: timestampFromMs(entry.occurredAt),
  traceId: resolveTraceId(entry.traceId),
});

const pickLatestErrors = (errors: readonly ErrorJournalEntryValue[]): SupportErrorRef[] => errors
  .filter(entry => isKnownErrorCode(entry.code))
  .slice(-MAX_ERRORS)
  .reverse()
  .map(toErrorRef);

export const collectSupportContext = ({
  address,
  appVersion,
  device,
  errors,
}: CollectSupportContextInputValue): SupportTicketContext => create(SupportTicketContextSchema, {
  appVersion: resolveAppVersion(appVersion),
  device,
  errors: pickLatestErrors(errors),
  screenPath: resolveScreenPath(address),
});
