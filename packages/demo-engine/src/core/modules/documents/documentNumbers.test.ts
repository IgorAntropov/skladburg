import { create } from '@bufbuild/protobuf';
import {
  DocumentSchema,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { DocumentNumberPrefixesSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { SeedOrganizationId } from '../../seed/index';
import { createTestRuntime } from '../testing/testRuntime';
import { assignDocumentNumber } from './documentNumbers';

describe('document number sequences', () => {
  it('keeps independent sequences for issuer, type and the issuer’s local year', () => {
    const { runtime, state } = createTestRuntime();
    const firstIssuer = SeedOrganizationId.SUPPLIER_1;
    const secondIssuer = SeedOrganizationId.SUPPLIER_2;
    const run = (worldTimeMs: number, issuerOrganizationId: string, types: readonly DocumentType[]): string[] => {
      const outcome = state.transact(worldTimeMs, (transaction) => {
        const requisites = transaction.get('organizationRequisites', issuerOrganizationId);
        const settings = transaction.get('organizationSettings', issuerOrganizationId);
        if (requisites === undefined || settings === undefined) {
          throw new Error('Missing issuer data');
        }
        transaction.put('organizationRequisites', { ...requisites, timeZone: 'Asia/Tomsk' });
        transaction.put('organizationSettings', {
          ...settings,
          documentNumberPrefixes: create(DocumentNumberPrefixesSchema, { invoice: 'С-' }),
        });
        return types.map((type) => {
          const document = create(DocumentSchema, { issuerOrganizationId, type });
          assignDocumentNumber(runtime.errors, transaction, document);
          return `${String(document.date?.year)}:${document.displayNumber}`;
        });
      }, state.getMeta);
      outcome.apply();
      return outcome.result;
    };

    const lastSecond = Date.UTC(2026, 11, 31, 16, 59, 59);
    const newYear = lastSecond + 1_000;
    expect(run(lastSecond, firstIssuer, [DocumentType.INVOICE, DocumentType.INVOICE, DocumentType.SPECIFICATION]))
      .toEqual(['2026:С-1', '2026:С-2', '2026:1']);
    expect(run(lastSecond, secondIssuer, [DocumentType.INVOICE])).toEqual(['2026:С-1']);
    expect(run(newYear, firstIssuer, [DocumentType.INVOICE])).toEqual(['2027:С-1']);
  });
});
