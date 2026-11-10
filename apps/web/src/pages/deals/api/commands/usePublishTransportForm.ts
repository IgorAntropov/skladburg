import type { PublishTransportRequestResponse } from '@skladburg/contracts/logistics/v1/logistics';

import { PublishTransportRequestRequestFormRules } from '@skladburg/contracts/forms/logistics/v1/logistics';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';

import type {
  CommandFormValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import { useRefreshTransport } from '@/entities/transport';
import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type {
  PublishTransportInputValue,
  PublishTransportOutputValue,
} from '../../lib/publishTransportFormValues';
import type { DealTransportTranslate } from '../../ui/transport/dealTransportSection';
import type { DealCommandContextValue } from './dealCommandContext';

import {
  collectPublishTransportIssues,
  getTransportBodyTypes,
  mapPublishTransportViolationPath,
  PUBLISH_TRANSPORT_DEFAULT_VALUES,
  toTransportWindow,
} from '../../lib/publishTransportFormValues';
import { dealCommandVersion } from './dealCommandContext';

interface PublishTransportFormOptionsValue extends Pick<DealCommandContextValue, 'deal'> {
  onPublished: () => void;
  t: DealTransportTranslate;
}

type ViolationMessageValue = Extract<Parameters<DealTransportTranslate>[0], `dealTransport.validation.${string}`>;

const WATCHED_FIELDS: readonly FormFieldPathValue<PublishTransportInputValue>[] = ['cargo.cargoKind'];

const VIOLATION_MESSAGES: Readonly<Partial<Record<string, ViolationMessageValue>>> = {
  'int32.gte_lte': 'dealTransport.validation.temperatureRange',
  'logistics.temperature_range_order': 'dealTransport.validation.temperatureOrder',
  'logistics.window_invalid': 'dealTransport.validation.windowOrder',
  'logistics.windows_unreachable': 'dealTransport.validation.windowsUnreachable',
  'repeated.min_items': 'dealTransport.validation.bodyTypes',
  'transport.date': 'dealTransport.validation.date',
  'transport.time': 'dealTransport.validation.time',
};

export const usePublishTransportForm = ({ deal, onPublished, t }: PublishTransportFormOptionsValue):
CommandFormValue<PublishTransportInputValue> => {
  const client = useApiClient();
  const refreshTransport = useRefreshTransport();

  const execute = (values: PublishTransportOutputValue, idempotencyKey: string): Promise<PublishTransportRequestResponse> => {
    const pickupWindow = toTransportWindow(values.pickupWindow);
    const deliveryWindow = toTransportWindow(values.deliveryWindow);
    if (pickupWindow === undefined || deliveryWindow === undefined) {
      return Promise.reject(new Error('Transport request windows are invalid'));
    }

    const { maxCelsius, minCelsius } = values.cargo.temperature;
    const temperature = maxCelsius === undefined || minCelsius === undefined ? undefined : { maxCelsius, minCelsius };

    return client.service(LogisticsService).publishTransportRequest({
      ...dealCommandVersion(deal, idempotencyKey),
      cargo: {
        ...values.cargo,
        bodyTypes: getTransportBodyTypes(values.bodyTypes),
        temperature,
      },
      deliveryWindow,
      pickupWindow,
    });
  };

  const handlePublished = (): void => {
    onPublished();
    void refreshTransport();
  };

  const translateViolation = (ruleId: string): string | undefined => {
    const key = Object.hasOwn(VIOLATION_MESSAGES, ruleId) ? VIOLATION_MESSAGES[ruleId] : undefined;
    return key === undefined ? undefined : t(key);
  };

  return useCommandForm<PublishTransportInputValue, PublishTransportRequestResponse, PublishTransportOutputValue>({
    defaultValues: PUBLISH_TRANSPORT_DEFAULT_VALUES,
    execute,
    mapViolationPath: mapPublishTransportViolationPath,
    method: LogisticsService.method.publishTransportRequest,
    onSuccess: handlePublished,
    rules: PublishTransportRequestRequestFormRules,
    translateViolation,
    validateValues: collectPublishTransportIssues,
    watchedFields: WATCHED_FIELDS,
  });
};
