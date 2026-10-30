import type {
  DescField,
  DescFile,
  DescMessage,
} from '@bufbuild/protobuf';

import {
  hasOption,
  ScalarType,
} from '@bufbuild/protobuf';
import { reflect } from '@bufbuild/protobuf/reflect';
import {
  field as fieldRulesExtension,
  message as messageRulesExtension,
  oneof as oneofRulesExtension,
} from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  FormFieldRulesValue,
  FormIntegerRuleValue,
  FormIntegerTypeValue,
  FormRulesValue,
  FormScalarRuleValue,
  FormStringRuleValue,
} from './formRuleTypes';

import { field_check as fieldCheckExtension } from '../gen/common/v1/field_options_pb';
import { getContractRegistry } from '../registry/contractRegistry';
import { collectViolations } from '../validation/collectViolations';
import { runFieldCheck } from './checks/runFieldCheck';
import { findFormField } from './findFormField';
import { validateFormValues } from './validateFormValues';

type CaseValue = Readonly<Record<string, unknown>>;

interface IntegerRangeValue {
  isWide: boolean;
  max: bigint;
  min: bigint;
}

interface PatternSamplesValue {
  matching: readonly string[];
  nonMatching: readonly string[];
}

interface RuleFieldValue {
  field: DescField;
  key: string;
  path: readonly DescField[];
}

interface RuleMessageValue {
  exportName: string;
  file: DescFile;
  message: DescMessage;
}

const MAX_NESTING_DEPTH = 3;
const CHECK_RULE_PREFIX = 'field_check.';

const EXTERNAL_FILE_PREFIXES: readonly string[] = ['buf/validate/', 'google/'];

const EXPECTED_SERVER_ONLY_FIELDS: readonly string[] = [
  'common.v1.MethodAccess.permission',
  'organization.v1.ListSpheresRequest.page',
  'organization.v1.ListWarehousesRequest.page',
  'access.v1.RoleAssignment.amountLimit',
  'access.v1.EffectivePermission.amountLimit',
  'access.v1.ListPermissionsRequest.page',
  'access.v1.ListRolesRequest.page',
  'access.v1.SetMyAvatarRequest.image',
  'access.v1.SetMyAvatarRequest.mediaType',
  'catalog.v1.Product.minPrice',
  'catalog.v1.Product.storageTemperature',
  'catalog.v1.Listing.priceUnit',
  'catalog.v1.OwnListing.listing',
  'catalog.v1.OwnListing.listing.priceUnit',
  'catalog.v1.OwnListing.product',
  'catalog.v1.OwnListing.product.minPrice',
  'catalog.v1.OwnListing.product.storageTemperature',
  'catalog.v1.PriceTier.price',
  'catalog.v1.PriceList.validUntil',
  'catalog.v1.OwnDeliveryTerms.minimumCharge',
  'catalog.v1.OwnDeliveryTerms.pricePerKm',
  'catalog.v1.SalesTerms.ownDelivery',
  'catalog.v1.SalesTerms.ownDelivery.minimumCharge',
  'catalog.v1.SalesTerms.ownDelivery.pricePerKm',
  'catalog.v1.ListProductsRequest.page',
  'catalog.v1.SaveProductRequest.minPrice',
  'catalog.v1.SaveProductRequest.packagings',
  'catalog.v1.SaveProductRequest.storageTemperature',
  'catalog.v1.SaveProductResponse.product',
  'catalog.v1.SaveProductResponse.product.minPrice',
  'catalog.v1.SaveProductResponse.product.storageTemperature',
  'catalog.v1.ListOwnListingsRequest.page',
  'catalog.v1.GetOwnListingResponse.listing',
  'catalog.v1.GetOwnListingResponse.listing.listing',
  'catalog.v1.GetOwnListingResponse.listing.listing.priceUnit',
  'catalog.v1.GetOwnListingResponse.listing.product',
  'catalog.v1.GetOwnListingResponse.listing.product.minPrice',
  'catalog.v1.GetOwnListingResponse.listing.product.storageTemperature',
  'catalog.v1.SaveListingRequest.availability',
  'catalog.v1.SaveListingRequest.priceUnit',
  'catalog.v1.SaveListingResponse.listing',
  'catalog.v1.SaveListingResponse.listing.priceUnit',
  'catalog.v1.SetListingPublishedResponse.listing',
  'catalog.v1.SetListingPublishedResponse.listing.priceUnit',
  'catalog.v1.ListListingPricesRequest.page',
  'catalog.v1.SaveListingPriceRequest.tiers',
  'catalog.v1.GetPriceListResponse.priceList',
  'catalog.v1.GetPriceListResponse.priceList.validUntil',
  'catalog.v1.SavePriceListRequest.validUntil',
  'catalog.v1.SavePriceListResponse.priceList',
  'catalog.v1.SavePriceListResponse.priceList.validUntil',
  'catalog.v1.GetSalesTermsResponse.terms',
  'catalog.v1.GetSalesTermsResponse.terms.ownDelivery',
  'catalog.v1.GetSalesTermsResponse.terms.ownDelivery.minimumCharge',
  'catalog.v1.GetSalesTermsResponse.terms.ownDelivery.pricePerKm',
  'catalog.v1.SaveSalesTermsRequest.ownDelivery',
  'catalog.v1.SaveSalesTermsRequest.ownDelivery.minimumCharge',
  'catalog.v1.SaveSalesTermsRequest.ownDelivery.pricePerKm',
  'catalog.v1.SaveSalesTermsResponse.terms',
  'catalog.v1.SaveSalesTermsResponse.terms.ownDelivery',
  'catalog.v1.SaveSalesTermsResponse.terms.ownDelivery.minimumCharge',
  'catalog.v1.SaveSalesTermsResponse.terms.ownDelivery.pricePerKm',
  'common.v1.LimitExceededParams.limit',
  'common.v1.LimitExceededParams.requested',
  'common.v1.ErrorDetail.limitExceeded',
  'common.v1.ErrorDetail.limitExceeded.limit',
  'common.v1.ErrorDetail.limitExceeded.requested',
  'common.v1.ObjectLink.cameraFocus',
  'common.v1.ObjectLink.target',
  'network.v1.ListCitiesRequest.page',
  'network.v1.ListMapNodesRequest.page',
  'network.v1.ListRouteLegsRequest.page',
  'network.v1.ListMapSitesRequest.page',
  'notification.v1.Notification.links',
  'notification.v1.DigestItem.link',
  'notification.v1.DigestItem.link.cameraFocus',
  'notification.v1.DigestItem.link.target',
  'notification.v1.ListNotificationsRequest.page',
  'organization.v1.Signatory.powerOfAttorneyDate',
  'organization.v1.OrganizationRequisites.bank',
  'organization.v1.OrganizationRequisites.signatories',
  'organization.v1.GetOrganizationRequisitesResponse.requisites',
  'organization.v1.GetOrganizationRequisitesResponse.requisites.bank',
  'organization.v1.GetOrganizationRequisitesResponse.requisites.signatories',
  'organization.v1.UpdateOrganizationRequisitesRequest.bank',
  'organization.v1.UpdateOrganizationRequisitesResponse.requisites',
  'organization.v1.UpdateOrganizationRequisitesResponse.requisites.bank',
  'organization.v1.UpdateOrganizationRequisitesResponse.requisites.signatories',
  'organization.v1.SaveSignatoryRequest.signatory',
  'organization.v1.SaveSignatoryRequest.signatory.powerOfAttorneyDate',
  'organization.v1.SaveSignatoryResponse.requisites',
  'organization.v1.SaveSignatoryResponse.requisites.bank',
  'organization.v1.SaveSignatoryResponse.requisites.signatories',
  'organization.v1.RemoveSignatoryResponse.requisites',
  'organization.v1.RemoveSignatoryResponse.requisites.bank',
  'organization.v1.RemoveSignatoryResponse.requisites.signatories',
  'organization.v1.ListOrganizationShowcasesRequest.page',
  'support.v1.ListSupportAccessSessionsRequest.page',
  'support.v1.ListSupportAuditEntriesRequest.page',
  'support.v1.SupportErrorRef.occurredAt',
  'support.v1.SupportTicketContext.device',
  'support.v1.SupportTicketContext.errors',
  'support.v1.SupportTicket.context',
  'support.v1.SupportTicket.context.device',
  'support.v1.SupportTicket.context.errors',
  'support.v1.CreateSupportTicketRequest.context',
  'support.v1.CreateSupportTicketRequest.context.device',
  'support.v1.CreateSupportTicketRequest.context.errors',
  'support.v1.CreateSupportTicketResponse.ticket',
  'support.v1.CreateSupportTicketResponse.ticket.context',
  'support.v1.CreateSupportTicketResponse.ticket.context.device',
  'support.v1.CreateSupportTicketResponse.ticket.context.errors',
  'support.v1.ListMySupportTicketsRequest.page',
  'support.v1.GetSupportTicketResponse.ticket',
  'support.v1.GetSupportTicketResponse.ticket.context',
  'support.v1.GetSupportTicketResponse.ticket.context.device',
  'support.v1.GetSupportTicketResponse.ticket.context.errors',
];
const EXPECTED_SERVER_ONLY_MESSAGES: readonly string[] = ['common.v1.MethodAccess'];

const VALID_UUID = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_UUID = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const FILLERS: readonly string[] = ['a', 'ж', '😀'];

const GENERIC_STRINGS: readonly string[] = [
  '',
  'a',
  ' ',
  'ж',
  '😀',
  'абв',
  '😀😀',
  'text\n',
  '\n',
  'Склад Северный',
  VALID_UUID,
  OTHER_UUID,
  VALID_UUID.toUpperCase(),
  `${VALID_UUID}\n`,
  `\n${VALID_UUID}`,
  ` ${VALID_UUID}`,
  `${VALID_UUID} `,
  VALID_UUID.replaceAll('-', ''),
  `{${VALID_UUID}}`,
  VALID_UUID.slice(0, -1),
  `${VALID_UUID}0`,
  VALID_UUID.replace('3f2b', 'zf2b'),
  '00000000-0000-0000-0000-000000000000',
  'city',
  'garbage-value',
];

const PATTERN_SAMPLES: Readonly<Record<string, PatternSamplesValue>> = {
  '^04[0-9]{7}$': {
    matching: ['040000501', '040000000', '040099999'],
    nonMatching: [
      '',
      '04000050',
      '0400005011',
      '050000501',
      '140000501',
      '04000050a',
      '04000050\n',
      '\n04000050',
      ' 040000501',
      '040000501 ',
      '٠٤٠٠٠٠٥٠١',
    ],
  },
  '^([0-9]{8}|[0-9]{12,14})$': {
    matching: ['20000011', '200000000004', '2000000000008', '20000000000011', '12345678', '00000000'],
    nonMatching: [
      '',
      '2000001',
      '200000110',
      '20000000008',
      '2000000000000000',
      '2000000000O08',
      '2000000000008\n',
      '\n2000000000008',
      ' 2000000000008',
      '2000000000008 ',
      '2000 00000008',
      '٢٠٠٠٠٠٠٠٠٠٠٠٨',
    ],
  },
  '^([a-z][a-z0-9_]*)?$': {
    matching: ['', 'a', 'abc', 'a1', 'a_b', 'a_1_b', 'deal_id', 'a__'],
    nonMatching: ['A', '1a', '_a', 'a-b', 'a b', 'a\n', '\n', 'Ab', 'я', 'a.b', ' a', 'a '],
  },
  '^(dev|[0-9a-f]{7,40}|[0-9]{1,4}\\.[0-9]{1,4}\\.[0-9]{1,4}(\\+[0-9a-f]{7,40})?)$': {
    matching: [
      'dev',
      '3f9c2ab',
      '3f9c2ab0d1e24f5a6b7c8d9e0f1a2b3c4d5e6f70',
      '0.1.0',
      '12.345.6789',
      '1.0.0+3f9c2ab',
      '1.0.0+3f9c2ab0d1e24f5a6b7c8d9e0f1a2b3c4d5e6f70',
    ],
    nonMatching: [
      '',
      'Dev',
      'DEV',
      'dev\n',
      '\ndev',
      ' dev',
      'dev ',
      'dev-1',
      'development',
      'unknown',
      '3f9c2a',
      '3f9c2ab0d1e24f5a6b7c8d9e0f1a2b3c4d5e6f701',
      '3F9C2AB',
      '3f9c2ag',
      '3f9c2ab\n',
      '1.0',
      '1.0.0.0',
      '12345.0.0',
      '1.0.0+',
      '1.0.0+3f9c2a',
      '1.0.0-rc.1',
      '1.0.0 +3f9c2ab',
      '1.0.0\n',
      'v1.0.0',
      '1.0.0+3f9c2ab+3f9c2ab',
      'Иван 8 495 123 45 67',
      '+7 495 123-45-67',
      'ivan@example.test',
    ],
  },
  '^/([a-z][a-z-]{0,31}(/[A-Za-z0-9][A-Za-z0-9_-]{0,63})?)?$': {
    matching: [
      '/',
      '/network',
      '/deals',
      '/handling-units',
      '/warehouses/w-42',
      '/deals/3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153',
      '/cells/A1_b-2',
      `/${'a'.repeat(32)}`,
      `/a/${'1'.repeat(64)}`,
    ],
    nonMatching: [
      '',
      'map',
      '//',
      '/ ',
      '/network ',
      ' /network',
      '/network\n',
      '/network\r',
      '/\n',
      '\n/network',
      '/network/',
      '/network?',
      '/map?inn=7701234567',
      '/map?inn=7701234567#top',
      '/deals#top',
      '/deals/42?tab=docs',
      '/deals/42#top',
      '/deals/42/extra',
      '/deals//42',
      '/deals/-42',
      '/deals/_42',
      '/deals/4 2',
      '/Deals',
      '/1deals',
      '/-deals',
      '/../etc',
      '/./deals',
      '/deals/..',
      '/deals/4.2',
      '/deals/%20',
      '/deals/\t42',
      '/сделки',
      '/deals/сделка',
      `/${'a'.repeat(33)}`,
      `/a/${'1'.repeat(65)}`,
      'https://example.test/deals',
    ],
  },
  '^[0-9]{20}$': {
    matching: ['40702810300000000001', '30101810600000000501', '00000000000000000000'],
    nonMatching: [
      '',
      '4070281030000000000',
      '407028103000000000012',
      '4070281030000000000a',
      '40702810300000000001\n',
      '\n40702810300000000001',
      ' 40702810300000000001',
      '40702810 300000000001',
      '٤٠٧٠٢٨١٠٣٠٠٠٠٠٠٠٠٠٠١',
    ],
  },
  '^[a-z][a-z0-9]*(_[a-z0-9]+)*_(view|create|edit|delete|approve|sign|fund|release|export|manage)$': {
    matching: [
      'deal_view',
      'deal_create',
      'deal_edit',
      'deal_delete',
      'deal_approve',
      'deal_sign',
      'deal_fund',
      'deal_release',
      'deal_export',
      'deal_manage',
      'warehouse_item_edit',
      'a1_b2_c3_view',
      'a_manage',
    ],
    nonMatching: [
      '',
      'view',
      '_view',
      'deal_',
      'deal_unknown',
      'deal_views',
      'Deal_view',
      'deal_VIEW',
      'deal__view',
      'deal_view_',
      'deal_view\n',
      '\ndeal_view',
      ' deal_view',
      'dealview',
      '1deal_view',
      'deal-view',
      'сделка_view',
      'deal_view_edit_',
    ],
  },
  '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*\\.v[0-9]+\\.[A-Z][A-Za-z0-9]*/[A-Z][A-Za-z0-9]*$': {
    matching: [
      'support.v1.SupportTicketService/CreateSupportTicket',
      'organization.v1.OrganizationService/CreateWarehouse',
      'common.v1.Service/A',
      'a.v2.B/C',
      'warehouse_ops.v10.StockService/MoveStock2',
      'trade.market.v1.DealService/GetDeal',
    ],
    nonMatching: [
      '',
      'unknown',
      'CreateSupportTicket',
      'support.v1.SupportTicketService',
      'support.v1.SupportTicketService/',
      'support.v1.SupportTicketService/createSupportTicket',
      'support.v1.supportTicketService/CreateSupportTicket',
      'support.SupportTicketService/CreateSupportTicket',
      'support.v1/SupportTicketService/CreateSupportTicket',
      'support.v1.SupportTicketService/Create SupportTicket',
      'support.v1.SupportTicketService/Create-SupportTicket',
      'support.v1.SupportTicketService/Create/SupportTicket',
      'support.v1.SupportTicketService/CreateSupportTicket\n',
      '\nsupport.v1.SupportTicketService/CreateSupportTicket',
      ' support.v1.SupportTicketService/CreateSupportTicket',
      'support.v1.SupportTicketService/CreateSupportTicket ',
      'Support.v1.SupportTicketService/CreateSupportTicket',
      '1support.v1.SupportTicketService/CreateSupportTicket',
      'support..v1.SupportTicketService/CreateSupportTicket',
      '.support.v1.SupportTicketService/CreateSupportTicket',
      'support.v1.SupportTicketService/CreateSupportTicket?id=1',
      'support.v1.SupportTicketService/ИзменитьСклад',
      'support-ops.v1.SupportTicketService/CreateSupportTicket',
    ],
  },
  '^[A-Z]{3}$': {
    matching: ['RUB', 'USD', 'EUR', 'ABC'],
    nonMatching: ['', 'rub', 'RU', 'RUBL', 'RUB\n', '\nRUB', ' RUB', 'RUB ', 'РУБ', 'R1B', 'Rub', 'ЯЯЯ'],
  },
  '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$': {
    matching: [
      'Europe/Moscow',
      'America/Argentina/Buenos_Aires',
      'Etc/GMT+3',
      'Etc/GMT-12',
      'Asia/Ho_Chi_Minh',
      'UTC/a',
      '_/_',
    ],
    nonMatching: [
      '',
      'Moscow',
      'Europe/',
      '/Moscow',
      'Europe//Moscow',
      'Europe/Moscow\n',
      'Europe/Moscow\r',
      ' Europe/Moscow',
      'Europe/Moscow ',
      'Europe/Mos cow',
      'Europe/Mos.cow',
      'Europe1/Moscow',
      'Европа/Москва',
      'Europe/Москва',
    ],
  },
};

const INTEGER_RANGES: Readonly<Record<FormIntegerTypeValue, IntegerRangeValue>> = {
  fixed32: { isWide: false, max: 2n ** 32n - 1n, min: 0n },
  fixed64: { isWide: true, max: 2n ** 64n - 1n, min: 0n },
  int32: { isWide: false, max: 2n ** 31n - 1n, min: -(2n ** 31n) },
  int64: { isWide: true, max: 2n ** 63n - 1n, min: -(2n ** 63n) },
  sfixed32: { isWide: false, max: 2n ** 31n - 1n, min: -(2n ** 31n) },
  sfixed64: { isWide: true, max: 2n ** 63n - 1n, min: -(2n ** 63n) },
  sint32: { isWide: false, max: 2n ** 31n - 1n, min: -(2n ** 31n) },
  sint64: { isWide: true, max: 2n ** 63n - 1n, min: -(2n ** 63n) },
  uint32: { isWide: false, max: 2n ** 32n - 1n, min: 0n },
  uint64: { isWide: true, max: 2n ** 64n - 1n, min: 0n },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFormRules = (value: unknown): value is FormRulesValue =>
  isRecord(value) && isRecord(value.fields);

const hasOwnFieldRules = (field: DescField): boolean =>
  hasOption(field, fieldRulesExtension) || hasOption(field, fieldCheckExtension);

const hasOwnMessageRules = (message: DescMessage): boolean =>
  message.oneofs.some(oneof => hasOption(oneof, oneofRulesExtension)) || hasOption(message, messageRulesExtension);

const isNestable = (field: DescField, ancestors: readonly string[]): field is DescField & { fieldKind: 'message' } =>
  field.fieldKind === 'message'
  && ancestors.length <= MAX_NESTING_DEPTH
  && !ancestors.includes(field.message.typeName);

const collectRuleFields = (
  message: DescMessage,
  ancestors: readonly string[] = [message.typeName],
  path: readonly DescField[] = [],
): RuleFieldValue[] =>
  message.fields.flatMap((field) => {
    const own = hasOwnFieldRules(field)
      ? [{ field, key: [...path, field].map(step => step.localName).join('.'), path }]
      : [];

    if (!isNestable(field, ancestors)) {
      return own;
    }

    const nested = collectRuleFields(field.message, [...ancestors, field.message.typeName], [...path, field]);
    const parent = !hasOwnFieldRules(field) && nested.length > 0
      ? [{ field, key: [...path, field].map(step => step.localName).join('.'), path }]
      : [];

    return [...own, ...parent, ...nested];
  });

const hasNestedMessageRules = (message: DescMessage, ancestors: readonly string[] = [message.typeName]): boolean =>
  message.fields.some(field => isNestable(field, ancestors)
    && (hasOwnMessageRules(field.message)
      || hasNestedMessageRules(field.message, [...ancestors, field.message.typeName])));

const hasContractRules = (message: DescMessage): boolean =>
  collectRuleFields(message).length > 0 || hasOwnMessageRules(message) || hasNestedMessageRules(message);

const collectMessages = (messages: readonly DescMessage[]): DescMessage[] =>
  messages.flatMap(message => [message, ...collectMessages(message.nestedMessages)]);

const getExportName = (message: DescMessage): string => {
  const { package: packageName } = message.file.proto;
  const localTypeName = packageName === '' ? message.typeName : message.typeName.slice(packageName.length + 1);

  return `${localTypeName.replaceAll('.', '_')}FormRules`;
};

const getRuleMessages = (): RuleMessageValue[] =>
  [...getContractRegistry().files]
    .filter(file => !EXTERNAL_FILE_PREFIXES.some(prefix => file.name.startsWith(prefix)))
    .flatMap(file =>
      collectMessages(file.messages)
        .filter(hasContractRules)
        .map(message => ({ exportName: getExportName(message), file, message })));

const GENERATED_FORMS_DIRECTORY = join(import.meta.dirname, '..', 'gen', 'forms');

const importTables = async (fileName: string): Promise<unknown> => {
  const modulePath = join(GENERATED_FORMS_DIRECTORY, `${fileName.replace(/\.proto$/, '')}_rules.ts`);

  return import(modulePath);
};

const loadTable = async (item: RuleMessageValue): Promise<FormRulesValue | undefined> => {
  const loaded = await importTables(item.file.name);

  if (!isRecord(loaded)) {
    return undefined;
  }

  const table = loaded[item.exportName];

  return isFormRules(table) ? table : undefined;
};

const repeatText = (filler: string, length: number): string => filler.repeat(Math.max(0, length));

const around = (borders: readonly (number | undefined)[]): number[] =>
  borders.flatMap(border => (border === undefined ? [] : [border - 1, border, border + 1])).filter(length => length >= 0);

const buildStringCorpus = (rule: FormStringRuleValue): string[] => {
  const lengths = around([rule.minLen, rule.maxLen, rule.len]);
  const samples = new Set<string>(GENERIC_STRINGS);

  for (const length of [0, 1, 2, ...lengths]) {
    for (const filler of FILLERS) {
      samples.add(repeatText(filler, length));
    }
  }

  const { contains, notContains, pattern, prefix, suffix } = rule;

  for (const text of [contains, notContains, prefix, suffix]) {
    if (text !== undefined) {
      samples.add(text);
      samples.add(`x${text}`);
      samples.add(`${text}x`);
      samples.add(`x${text}x`);
    }
  }

  if (pattern !== undefined) {
    const patternSamples = PATTERN_SAMPLES[pattern];

    if (patternSamples === undefined) {
      throw new Error(`No pattern samples for ${pattern}; add matching and non-matching strings to PATTERN_SAMPLES`);
    }

    for (const sample of [...patternSamples.matching, ...patternSamples.nonMatching]) {
      samples.add(sample);
    }
  }

  return [...samples];
};

const buildIntegerCorpus = (rule: FormIntegerRuleValue): (bigint | number)[] => {
  const range = INTEGER_RANGES[rule.type];
  const bounds = [rule.gt, rule.gte, rule.lt, rule.lte].flatMap(bound => (bound === undefined ? [] : [BigInt(bound)]));
  const candidates = new Set<bigint>([
    -1n,
    0n,
    1n,
    2n,
    2n ** 31n,
    2n ** 31n - 1n,
    2n ** 32n - 1n,
    2n ** 53n,
    100n,
    -(2n ** 31n),
    range.max,
    range.max - 1n,
    range.min,
    range.min + 1n,
    ...bounds.flatMap(bound => [bound - 1n, bound, bound + 1n]),
  ]);

  return [...candidates]
    .filter(candidate => candidate >= range.min && candidate <= range.max)
    .map(candidate => (range.isWide ? candidate : Number(candidate)));
};

const buildEnumCorpus = (definedValues: readonly number[], rule: Extract<FormScalarRuleValue, { kind: 'enum' }>): number[] => {
  const highest = Math.max(0, ...definedValues, ...(rule.in ?? []), ...(rule.notIn ?? []));
  const candidates = new Set<number>([
    ...definedValues,
    ...(rule.in ?? []),
    ...(rule.notIn ?? []),
    -1,
    0,
    2 ** 31 - 1,
    9999,
    highest + 1,
    highest + 2,
    rule.equalTo ?? 0,
  ]);

  return [...candidates];
};

const buildScalarCorpus = (rule: FormScalarRuleValue, definedValues: readonly number[]): unknown[] => {
  switch (rule.kind) {
    case 'enum':
      return buildEnumCorpus(definedValues, rule);
    case 'integer':
      return buildIntegerCorpus(rule);
    case 'string':
      return buildStringCorpus(rule);
  }
};

const distinctElement = (rule: FormScalarRuleValue, definedValues: readonly number[], index: number): unknown => {
  switch (rule.kind) {
    case 'enum':
      return definedValues[index % Math.max(1, definedValues.length)] ?? 0;
    case 'integer':
      return INTEGER_RANGES[rule.type].isWide ? BigInt(index) : index;
    case 'string':
      return `item-${String(index)}`;
  }
};

const buildListCorpus = (
  rule: Extract<FormFieldRulesValue, { kind: 'repeated' }>,
  elementRule: FormScalarRuleValue,
  definedValues: readonly number[],
): unknown[][] => {
  const elements = buildScalarCorpus(elementRule, definedValues);
  const lists: unknown[][] = [[]];

  for (const element of elements) {
    lists.push([element], [element, element]);
  }

  const first = elements[0];
  const last = elements.at(-1);

  lists.push(elements.slice(0, 5), [...elements.slice(0, 3), ...elements.slice(0, 3)]);

  if (first !== undefined && last !== undefined) {
    lists.push([first, last, first, last]);
  }

  for (const length of around([rule.minItems, rule.maxItems])) {
    lists.push(Array.from({ length }, (_, index) => distinctElement(elementRule, definedValues, index)));
  }

  return lists;
};

const getDefinedValues = (field: DescField): number[] => {
  if (field.fieldKind === 'enum') {
    return field.enum.values.map(value => value.number);
  }

  if (field.fieldKind === 'list' && field.listKind === 'enum') {
    return field.enum.values.map(value => value.number);
  }

  return [];
};

const getElementRule = (rule: Extract<FormFieldRulesValue, { kind: 'repeated' }>, field: DescField): FormScalarRuleValue => {
  if (rule.items !== undefined) {
    return rule.items;
  }

  if (field.fieldKind === 'list' && field.listKind === 'enum') {
    return { kind: 'enum' };
  }

  if (field.fieldKind === 'list' && field.listKind === 'scalar' && field.scalar === ScalarType.STRING) {
    return { kind: 'string' };
  }

  return { kind: 'integer', type: 'int32' };
};

const buildFieldCorpus = (rule: FormFieldRulesValue, field: DescField, name: string): CaseValue[] => {
  const definedValues = getDefinedValues(field);
  const values = ((): unknown[] => {
    switch (rule.kind) {
      case 'opaque':
        return [];
      case 'repeated':
        return buildListCorpus(rule, getElementRule(rule, field), definedValues);
      default:
        return buildScalarCorpus(rule, definedValues);
    }
  })();

  return [{}, ...values.map(value => ({ [name]: value }))];
};

const setFieldValue = (reflected: ReturnType<typeof reflect>, field: DescField, value: unknown): void => {
  if (field.fieldKind !== 'list') {
    reflected.set(field, value);
    return;
  }

  const list = reflected.get(field);

  if (!Array.isArray(value)) {
    throw new TypeError('Expected a list value');
  }

  for (const element of value) {
    list.add(element);
  }
};

const buildMessageWithValue = (message: DescMessage, entry: RuleFieldValue, values: CaseValue): ReturnType<typeof reflect> | undefined => {
  const reflected = reflect(message);
  let current = reflected;

  for (const step of entry.path) {
    if (step.fieldKind !== 'message') {
      return undefined;
    }

    const next = reflect(step.message);

    current.set(step, next);
    current = next;
  }

  if (Object.hasOwn(values, entry.key)) {
    try {
      setFieldValue(current, entry.field, values[entry.key]);
    }
    catch {
      return undefined;
    }
  }

  return reflected;
};

const sortedUnique = (ruleIds: readonly string[]): string[] => [...new Set(ruleIds)].toSorted();

interface ComparisonValue {
  compared: number;
  skipped: number;
}

const compareField = (
  item: RuleMessageValue,
  rules: FormRulesValue,
  entry: RuleFieldValue,
  corpus: readonly CaseValue[],
): ComparisonValue => {
  const result: ComparisonValue = { compared: 0, skipped: 0 };

  for (const values of corpus) {
    const reflected = buildMessageWithValue(item.message, entry, values);

    if (reflected === undefined) {
      result.skipped += 1;
      continue;
    }

    const violations = collectViolations(item.message, reflected.message);
    const unresolvedPaths = violations
      .filter(violation => violation.fieldPath !== '')
      .filter(violation => findFormField(rules, violation.fieldPath) === undefined)
      .map(violation => violation.fieldPath);
    const expected = sortedUnique(
      violations
        .filter(violation => findFormField(rules, violation.fieldPath) === entry.key)
        .map(violation => violation.ruleId),
    );
    const actual = sortedUnique(
      validateFormValues(rules, values, [entry.key], { runCheck: runFieldCheck })
        .map(issue => issue.ruleId)
        .filter(ruleId => !ruleId.startsWith(CHECK_RULE_PREFIX)),
    );

    expect({ actual, unresolvedPaths, values }).toEqual({ actual: expected, unresolvedPaths: [], values });
    result.compared += 1;
  }

  return result;
};

const ruleMessages = getRuleMessages();
const typeName = (item: RuleMessageValue): string => item.message.typeName;

describe('form rules parity with protovalidate', () => {
  it('finds the messages with rules in the contract image', () => {
    expect(ruleMessages.map(typeName)).toEqual(expect.arrayContaining([
      'common.v1.MethodAccess',
      'common.v1.Money',
      'common.v1.PageRequest',
      'organization.v1.CreateWarehouseRequest',
    ]));
  });

  describe.each(ruleMessages.map(item => [typeName(item), item] as const))('%s', (_name, item) => {
    const ruleFields = collectRuleFields(item.message);

    it('has a generated table with one entry per field that has rules', async () => {
      const rules = await loadTable(item);

      expect(rules, `${item.exportName} is not generated for ${item.file.name}`).toBeDefined();
      expect(Object.keys(rules?.fields ?? {}).toSorted()).toEqual(ruleFields.map(entry => entry.key).toSorted());
    });

    it.each(ruleFields.map(entry => [entry.key, entry] as const))(
      'reports the same rule ids as protovalidate for %s',
      async (_fieldName, entry) => {
        const rules = await loadTable(item);
        const fieldRules = rules?.fields[entry.key];

        expect(rules).toBeDefined();
        expect(fieldRules).toBeDefined();

        if (rules === undefined || fieldRules === undefined || fieldRules.isServerOnly === true) {
          return;
        }

        const corpus = buildFieldCorpus(fieldRules, entry.field, entry.key);
        const comparison = compareField(item, rules, entry, corpus);

        expect(comparison.compared).toBeGreaterThan(0);
        expect(comparison.skipped).toBeLessThan(comparison.compared);
      },
    );
    const nestedFields = ruleFields.filter(entry => entry.path.length > 0);

    if (nestedFields.length > 0) {
      it.each(nestedFields.map(entry => [entry.key, entry] as const))(
        'reports nothing at protovalidate and on the client for %s when its parent is not set',
        async (_fieldName, entry) => {
          const rules = await loadTable(item);

          expect(rules).toBeDefined();

          if (rules === undefined) {
            return;
          }

          const parentKey = entry.path.map(step => step.localName).join('.');
          const values: CaseValue = { [parentKey]: undefined };
          const violations = collectViolations(item.message, reflect(item.message).message);
          const expected = sortedUnique(
            violations
              .filter(violation => findFormField(rules, violation.fieldPath) === entry.key)
              .map(violation => violation.ruleId),
          );
          const actual = sortedUnique(
            validateFormValues(rules, values, [entry.key], { runCheck: runFieldCheck }).map(issue => issue.ruleId),
          );

          expect(expected).toEqual([]);
          expect(actual).toEqual(expected);
        },
      );
    }
  });

  it.each(['name', 'timeZone'])('requires %s of CreateWarehouseRequest on the client and at protovalidate', async (fieldName) => {
    const item = ruleMessages.find(candidate => typeName(candidate) === 'organization.v1.CreateWarehouseRequest');
    const rules = item === undefined ? undefined : await loadTable(item);
    const field = item?.message.fields.find(candidate => candidate.localName === fieldName);

    expect(item).toBeDefined();
    expect(field).toBeDefined();
    expect(rules?.fields[fieldName]?.isRequired).toBe(true);

    if (item === undefined || rules === undefined || field === undefined) {
      return;
    }

    const emptyMessage = buildMessageWithValue(item.message, { field, key: fieldName, path: [] }, { [fieldName]: '' });
    const violations = emptyMessage === undefined ? [] : collectViolations(item.message, emptyMessage.message);

    expect(violations.filter(violation => violation.fieldPath === field.name).map(violation => violation.ruleId)).toEqual(['required']);
    expect(validateFormValues(rules, { [fieldName]: '' }, [fieldName]).map(issue => issue.ruleId)).toEqual(['required']);
    expect(validateFormValues(rules, { [fieldName]: fieldName === 'name' ? 'Склад' : 'Europe/Moscow' }, [fieldName])).toEqual([]);
  });

  it('lists the fields that stay on the server', async () => {
    const serverOnlyFields: string[] = [];

    for (const item of ruleMessages) {
      const rules = await loadTable(item);

      for (const [name, fieldRules] of Object.entries(rules?.fields ?? {})) {
        if (fieldRules.isServerOnly === true) {
          serverOnlyFields.push(`${typeName(item)}.${name}`);
        }
      }
    }

    expect(serverOnlyFields).toEqual(EXPECTED_SERVER_ONLY_FIELDS);
  });

  it('lists the messages whose own rules stay on the server', async () => {
    const serverOnlyMessages: string[] = [];

    for (const item of ruleMessages) {
      const rules = await loadTable(item);

      if (rules?.hasServerOnlyMessageRules === true) {
        serverOnlyMessages.push(typeName(item));
      }
    }

    expect(serverOnlyMessages).toEqual(EXPECTED_SERVER_ONLY_MESSAGES);
  });

  it('exports no table for a message without rules', async () => {
    const exportNames = new Map<string, string[]>();

    for (const item of ruleMessages) {
      exportNames.set(item.file.name, [...(exportNames.get(item.file.name) ?? []), item.exportName]);
    }

    for (const [fileName, expected] of exportNames) {
      const loaded = await importTables(fileName);

      expect(isRecord(loaded) ? Object.keys(loaded).toSorted() : []).toEqual(expected.toSorted());
    }
  });
});

describe('pattern samples', () => {
  const entries = Object.entries(PATTERN_SAMPLES);

  it.each(entries)('%s: matching and non-matching samples really match and miss', (pattern, samples) => {
    const regex = new RegExp(pattern, 'u');

    expect(samples.matching.filter(sample => !regex.test(sample))).toEqual([]);
    expect(samples.nonMatching.filter(sample => regex.test(sample))).toEqual([]);
    expect(samples.matching.length).toBeGreaterThan(0);
    expect(samples.nonMatching.length).toBeGreaterThan(0);
  });

  it('has samples for every pattern in the generated tables', async () => {
    const patterns = new Set<string>();

    for (const item of ruleMessages) {
      const rules = await loadTable(item);

      for (const fieldRules of Object.values(rules?.fields ?? {})) {
        if (fieldRules.kind === 'string' && fieldRules.pattern !== undefined) {
          patterns.add(fieldRules.pattern);
        }

        if (fieldRules.kind === 'repeated' && fieldRules.items?.kind === 'string' && fieldRules.items.pattern !== undefined) {
          patterns.add(fieldRules.items.pattern);
        }
      }
    }

    expect([...patterns].filter(pattern => PATTERN_SAMPLES[pattern] === undefined)).toEqual([]);
    expect(Object.keys(PATTERN_SAMPLES).filter(pattern => !patterns.has(pattern))).toEqual([]);
  });
});
