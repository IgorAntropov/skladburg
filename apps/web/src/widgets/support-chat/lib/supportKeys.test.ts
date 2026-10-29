import { create } from '@bufbuild/protobuf';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DeviceBrowserFamily,
  DeviceFormFactor,
  DeviceOsFamily,
  SupportDeviceSchema,
  SupportReplySchema,
  SupportReplyTemplate,
  SupportTicketCategory,
  SupportTicketMessageSchema,
  SupportTicketStatus,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SupportTranslate } from './supportTranslate';

import { supportSection } from '../i18n/supportSection';
import {
  findSupportCategory,
  getSupportCategoryDescriptor,
  resolveDefaultSupportCategory,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_DESCRIPTORS,
} from './supportCategories';
import {
  formatSupportDevice,
  SUPPORT_BROWSER_KEYS,
  SUPPORT_FORM_FACTOR_KEYS,
  SUPPORT_OS_KEYS,
} from './supportDevice';
import {
  formatSupportMessage,
  formatSupportReply,
  resolveSupportReplyKey,
  SUPPORT_REPLY_KEYS,
  SUPPORT_REPLY_NO_TRACE_KEY,
} from './supportReply';
import {
  formatSupportTicketStatus,
  isSupportReplyArrived,
  SUPPORT_STATUS_KEYS,
} from './supportTicketStatus';

const translate: SupportTranslate = (key, ...params) => `${key}|${JSON.stringify(params.at(0) ?? {})}`;

const listMembers = (enumObject: Record<string, number | string>): number[] => Object.values(enumObject)
  .filter((value): value is number => typeof value === 'number' && value !== 0)
  .sort((current, prev) => current - prev);

const listMapMembers = (map: Record<number, unknown>): number[] => Object.keys(map).map(Number).sort((current, prev) => current - prev);

const catalogKeys: ReadonlySet<string> = new Set(Object.keys(await supportSection.load('ru')));

describe('support key maps', () => {
  it.each([
    ['categories', listMapMembers(SUPPORT_CATEGORY_DESCRIPTORS), listMembers(SupportTicketCategory)],
    ['browsers', listMapMembers(SUPPORT_BROWSER_KEYS), listMembers(DeviceBrowserFamily)],
    ['form factors', listMapMembers(SUPPORT_FORM_FACTOR_KEYS), listMembers(DeviceFormFactor)],
    ['operating systems', listMapMembers(SUPPORT_OS_KEYS), listMembers(DeviceOsFamily)],
    ['reply templates', listMapMembers(SUPPORT_REPLY_KEYS), listMembers(SupportReplyTemplate)],
    ['statuses', listMapMembers(SUPPORT_STATUS_KEYS), listMembers(SupportTicketStatus)],
  ])('covers every member of the contract enum for %s', (_name, mapMembers, enumMembers) => {
    expect(mapMembers).toEqual(enumMembers);
  });

  it('points every map entry to a key of the support catalog', () => {
    const keys = [
      ...Object.values(SUPPORT_CATEGORY_DESCRIPTORS).flatMap(descriptor => [descriptor.hintKey, descriptor.nameKey, descriptor.optionKey]),
      ...Object.values(SUPPORT_BROWSER_KEYS),
      ...Object.values(SUPPORT_FORM_FACTOR_KEYS),
      ...Object.values(SUPPORT_OS_KEYS),
      ...Object.values(SUPPORT_REPLY_KEYS),
      ...Object.values(SUPPORT_STATUS_KEYS),
      SUPPORT_REPLY_NO_TRACE_KEY,
    ];

    expect(keys.filter(key => !catalogKeys.has(key))).toEqual([]);
  });
});

describe('support categories', () => {
  it('lists every selectable category once', () => {
    expect([...SUPPORT_CATEGORIES].sort()).toEqual(listMapMembers(SUPPORT_CATEGORY_DESCRIPTORS));
  });

  it('marks money and blocked receiving as urgent and nothing else', () => {
    const urgent = SUPPORT_CATEGORIES.filter(category => SUPPORT_CATEGORY_DESCRIPTORS[category].isUrgent);

    expect(urgent).toEqual([SupportTicketCategory.MONEY, SupportTicketCategory.RECEIVING_BLOCKED]);
  });

  it('preselects the error topic only when the journal has records', () => {
    expect(resolveDefaultSupportCategory(true)).toBe(SupportTicketCategory.ERROR);
    expect(resolveDefaultSupportCategory(false)).toBe(SupportTicketCategory.GENERAL);
  });

  it('finds a category by the select value and rejects anything else', () => {
    expect(findSupportCategory(String(SupportTicketCategory.MONEY))).toBe(SupportTicketCategory.MONEY);
    expect(findSupportCategory('0')).toBeUndefined();
    expect(findSupportCategory('')).toBeUndefined();
  });

  it('has no descriptor for the unspecified category', () => {
    expect(getSupportCategoryDescriptor(SupportTicketCategory.UNSPECIFIED)).toBeUndefined();
    expect(getSupportCategoryDescriptor(SupportTicketCategory.ERROR)?.nameKey).toBe('support.category.error');
  });
});

describe('resolveSupportReplyKey', () => {
  it('maps the plain templates to their own keys', () => {
    const acknowledged = create(SupportReplySchema, { template: SupportReplyTemplate.ACKNOWLEDGED });
    const urgentAcknowledged = create(SupportReplySchema, { template: SupportReplyTemplate.URGENT_ACKNOWLEDGED });

    expect(resolveSupportReplyKey(acknowledged)).toBe('support.reply.acknowledged');
    expect(resolveSupportReplyKey(urgentAcknowledged)).toBe('support.reply.urgentAcknowledged');
  });

  it('picks the long text of the error template when the support code exists', () => {
    const reply = create(SupportReplySchema, {
      errorCode: ErrorCode.INTERNAL,
      template: SupportReplyTemplate.ERROR_EXPLAINED,
      traceId: '0a1b2c3d-0000-4000-8000-000000000001',
    });

    expect(resolveSupportReplyKey(reply)).toBe('support.reply.errorExplained');
  });

  it('picks the short text of the error template when the support code is empty', () => {
    const reply = create(SupportReplySchema, {
      errorCode: ErrorCode.INTERNAL,
      template: SupportReplyTemplate.ERROR_EXPLAINED,
      traceId: '',
    });

    expect(resolveSupportReplyKey(reply)).toBe(SUPPORT_REPLY_NO_TRACE_KEY);
  });

  it('falls back to the plain acknowledgement for a template it does not know', () => {
    const unknown = create(SupportReplySchema, { template: SupportReplyTemplate.UNSPECIFIED });

    expect(resolveSupportReplyKey(unknown)).toBe('support.reply.acknowledged');
  });
});

describe('formatSupportReply', () => {
  it('passes the error name and the support code to the long text', () => {
    const reply = create(SupportReplySchema, {
      errorCode: ErrorCode.PERMISSION_DENIED,
      template: SupportReplyTemplate.ERROR_EXPLAINED,
      traceId: 'trace',
    });

    expect(formatSupportReply(translate, reply)).toBe(
      'support.reply.errorExplained|{"errorCode":"PERMISSION_DENIED","traceId":"trace"}',
    );
  });

  it('passes only the error name to the short text', () => {
    const reply = create(SupportReplySchema, {
      errorCode: ErrorCode.NOT_FOUND,
      template: SupportReplyTemplate.ERROR_EXPLAINED,
    });

    expect(formatSupportReply(translate, reply)).toBe('support.reply.errorExplainedNoTrace|{"errorCode":"NOT_FOUND"}');
  });
});

describe('formatSupportMessage', () => {
  it('formats a template reply and passes a plain text as it is', () => {
    const replyMessage = create(SupportTicketMessageSchema, {
      body: { case: 'reply', value: create(SupportReplySchema, { template: SupportReplyTemplate.ACKNOWLEDGED }) },
    });
    const textMessage = create(SupportTicketMessageSchema, { body: { case: 'text', value: 'Готово' } });

    expect(formatSupportMessage(translate, replyMessage)).toBe('support.reply.acknowledged|{}');
    expect(formatSupportMessage(translate, textMessage)).toBe('Готово');
    expect(formatSupportMessage(translate, create(SupportTicketMessageSchema))).toBe('');
  });
});

describe('formatSupportDevice', () => {
  const device = {
    browserFamily: DeviceBrowserFamily.SAFARI,
    formFactor: DeviceFormFactor.PHONE,
    isInstalled: false,
    osFamily: DeviceOsFamily.IOS,
  };

  it('joins the three families through their keys', () => {
    const parts = [
      '"browser":"support.device.browser.safari|{}"',
      '"formFactor":"support.device.formFactor.phone|{}"',
      '"os":"support.device.os.ios|{}"',
    ];

    expect(formatSupportDevice(translate, create(SupportDeviceSchema, device))).toBe(
      `support.device.summary|{${parts.join(',')}}`,
    );
  });

  it('adds the installed tail for the installed application', () => {
    const installed = create(SupportDeviceSchema, { ...device, isInstalled: true });

    expect(formatSupportDevice(translate, installed)).toMatch(/^support\.device\.summary\.installed\|/);
  });

  it('says that the device is unknown when a family is not set', () => {
    const unknown = create(SupportDeviceSchema, { ...device, osFamily: DeviceOsFamily.UNSPECIFIED });

    expect(formatSupportDevice(translate, unknown)).toBe('support.device.unknown|{}');
  });
});

describe('support ticket status', () => {
  it('passes the due time only to the open status', () => {
    const format = (status: SupportTicketStatus): string => formatSupportTicketStatus(translate, status, '14:05');

    expect(format(SupportTicketStatus.OPEN)).toBe('support.ticket.status.open|{"dueAt":"14:05"}');
    expect(format(SupportTicketStatus.ANSWERED)).toBe('support.ticket.status.answered|{}');
    expect(format(SupportTicketStatus.CLOSED)).toBe('support.ticket.status.closed|{}');
    expect(format(SupportTicketStatus.UNSPECIFIED)).toBe('');
  });

  it('announces a reply only when an open ticket becomes answered', () => {
    expect(isSupportReplyArrived(SupportTicketStatus.ANSWERED, SupportTicketStatus.OPEN)).toBe(true);
    expect(isSupportReplyArrived(SupportTicketStatus.ANSWERED, SupportTicketStatus.ANSWERED)).toBe(false);
    expect(isSupportReplyArrived(SupportTicketStatus.OPEN, SupportTicketStatus.OPEN)).toBe(false);
    expect(isSupportReplyArrived(SupportTicketStatus.CLOSED, SupportTicketStatus.OPEN)).toBe(false);
  });
});
