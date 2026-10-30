import type {
  DescMessage,
  MessageShape,
} from '@bufbuild/protobuf';
import type { FormRulesValue } from '@skladburg/contracts/forms';

import { create } from '@bufbuild/protobuf';
import {
  runFieldCheck,
  validateFormValues,
} from '@skladburg/contracts/forms';
import {
  OrganizationRequisitesFormRules,
  UpdateOrganizationRequisitesRequestFormRules,
} from '@skladburg/contracts/forms/organization/v1/requisites';
import {
  BankAccountSchema,
  OrganizationRequisitesSchema,
  UpdateOrganizationRequisitesRequestSchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import { getContractRegistry } from '@skladburg/contracts/registry';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../errors/index';
import { createSeededRandom } from '../ports/index';
import { createRequestValidator } from './requestValidator';

interface BankCaseValue {
  bankName: string;
  bik: string;
  correspondentAccount: string;
  settlementAccount: string;
}

interface IssueValue {
  protoName: string;
  ruleId: string;
}

const UUID = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const BANK_NAME = 'АО «Банк Складбург»';

const BIKS: readonly string[] = [
  '',
  '040000777',
  '040012345',
  '040000778',
  '04000077',
  '0400007777',
  '050000777',
  '04000077a',
  '٠٤٠٠٠٠٧٧٧',
];

const SETTLEMENT_ACCOUNTS: readonly string[] = [
  '',
  '40702810700000000123',
  '40702810500000000456',
  '40702810800000000123',
  '40702810700000000124',
  '4070281070000000012',
  '407028107000000001234',
  '4070281070000000012a',
  '40702810700000000123\n',
];

const CORRESPONDENT_ACCOUNTS: readonly string[] = [
  '',
  '30101810900000000777',
  '30101810500000000345',
  '30101810800000000777',
  '30101810900000000778',
  '3010181090000000077',
  '301018109000000007777',
  '3010181090000000077x',
];

const BANK_NAMES: readonly string[] = [BANK_NAME, ''];

const buildCorpus = (): BankCaseValue[] =>
  BIKS.flatMap(bik =>
    SETTLEMENT_ACCOUNTS.flatMap(settlementAccount =>
      CORRESPONDENT_ACCOUNTS.flatMap(correspondentAccount =>
        BANK_NAMES.map(bankName => ({ bankName, bik, correspondentAccount, settlementAccount })))));

const registry = getContractRegistry();
const validator = createRequestValidator(createDomainErrors(createSeededRandom(1)), registry);

const sortIssues = (issues: readonly IssueValue[]): IssueValue[] =>
  issues.toSorted((current, next) => `${current.protoName}:${current.ruleId}`.localeCompare(`${next.protoName}:${next.ruleId}`));

const toBank = (bank: BankCaseValue): MessageShape<typeof BankAccountSchema> => create(BankAccountSchema, bank);

const collectEngineIssues = <TDesc extends DescMessage>(
  schema: TDesc,
  message: MessageShape<TDesc>,
  prefix: string,
): IssueValue[] =>
  sortIssues(
    validator.collect(schema, message)
      .filter(violation => violation.fieldPath.startsWith(prefix))
      .map(violation => ({ protoName: violation.fieldPath, ruleId: violation.ruleId })),
  );

const collectClientIssues = (rules: FormRulesValue, bank: BankCaseValue): IssueValue[] => {
  const valueByProtoName: Readonly<Record<string, string>> = {
    'bank.bank_name': bank.bankName,
    'bank.bik': bank.bik,
    'bank.correspondent_account': bank.correspondentAccount,
    'bank.settlement_account': bank.settlementAccount,
  };
  const entries = Object.entries(rules.fields).filter(([, field]) => field.protoName in valueByProtoName);
  const values = Object.fromEntries(entries.map(([key, field]) => [key, valueByProtoName[field.protoName] ?? '']));

  return sortIssues(
    validateFormValues(rules, values, entries.map(([key]) => key), { runCheck: runFieldCheck }).map(issue => ({
      protoName: rules.fields[issue.field]?.protoName ?? issue.field,
      ruleId: issue.ruleId,
    })),
  );
};

describe('field checks parity between the client tables and the engine', () => {
  const corpus = buildCorpus();

  it('covers correct values, wrong keys, wrong lengths, foreign digits and empty values', () => {
    expect(corpus.length).toBeGreaterThan(1000);
    expect(new Set(corpus.map(bank => bank.bik)).size).toBe(BIKS.length);
  });

  it('gives the same rule ids for UpdateOrganizationRequisitesRequest', () => {
    const mismatches = corpus.flatMap((bank) => {
      const request = create(UpdateOrganizationRequisitesRequestSchema, {
        bank: toBank(bank),
        expectedVersion: 1n,
        idempotencyKey: UUID,
        legalAddress: '000000, г. Москва, Чайный пер., д. 4',
        vatMode: VatMode.GENERAL,
      });
      const engine = collectEngineIssues(UpdateOrganizationRequisitesRequestSchema, request, 'bank.');
      const client = collectClientIssues(UpdateOrganizationRequisitesRequestFormRules, bank);

      return JSON.stringify(engine) === JSON.stringify(client) ? [] : [{ bank, client, engine }];
    });

    expect(mismatches).toEqual([]);
  });

  it('gives the same rule ids for the bank inside OrganizationRequisites', () => {
    const mismatches = corpus.flatMap((bank) => {
      const requisites = create(OrganizationRequisitesSchema, {
        bank: toBank(bank),
        legalAddress: '000000, г. Москва, Чайный пер., д. 4',
        organizationId: UUID,
        timeZone: 'Europe/Moscow',
        vatMode: VatMode.GENERAL,
        version: 1n,
      });
      const engine = collectEngineIssues(OrganizationRequisitesSchema, requisites, 'bank.');
      const client = collectClientIssues(OrganizationRequisitesFormRules, bank);

      return JSON.stringify(engine) === JSON.stringify(client) ? [] : [{ bank, client, engine }];
    });

    expect(mismatches).toEqual([]);
  });

  it('reports a check violation in some cases, so the comparison is not empty', () => {
    const withChecks = corpus.filter((bank) => {
      const request = create(UpdateOrganizationRequisitesRequestSchema, { bank: toBank(bank) });

      return collectEngineIssues(UpdateOrganizationRequisitesRequestSchema, request, 'bank.')
        .some(issue => issue.ruleId.startsWith('field_check.'));
    });

    expect(withChecks.length).toBeGreaterThan(100);
  });
});
