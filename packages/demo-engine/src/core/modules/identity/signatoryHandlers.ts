import type { ServiceImpl } from '@connectrpc/connect';
import type {
  OrganizationRequisites,
  Signatory,
} from '@skladburg/contracts/organization/v1/requisites';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  OrganizationRequisitesSchema,
  OrganizationRequisitesService,
  RemoveSignatoryResponseSchema,
  SaveSignatoryResponseSchema,
  SignatoryBasis,
  SignatorySchema,
} from '@skladburg/contracts/organization/v1/requisites';

import type { ViolationValue } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { toCalendarDate } from '../../calendar/zonedTime';
import { collectSignatoryViolations } from './signatoryRules';

export type SignatoryHandlersValue = Pick<ServiceImpl<typeof OrganizationRequisitesService>, 'removeSignatory' | 'saveSignatory'>;

const MAX_SIGNATORIES = 10;
const SIGNATORY_PATH = 'signatory';
const SIGNATORY_IS_DEFAULT_PATH = 'signatory.is_default';
const SIGNATORY_ID_PATH = 'signatory_id';
const COUNT_MAX_RULE_ID = 'signatory.count_max';
const DEFAULT_REQUIRED_RULE_ID = 'signatory.default_required';
const EXISTS_RULE_ID = 'signatory.exists';
const REQUIRED_RULE_ID = 'required';

const normalizeSignatory = (incoming: Signatory): Signatory => {
  const signatory = clone(SignatorySchema, incoming);

  if (signatory.basis === SignatoryBasis.CHARTER) {
    signatory.powerOfAttorneyNumber = '';
    signatory.powerOfAttorneyDate = undefined;
  }

  return signatory;
};

const demoteSignatory = (current: Signatory): Signatory => {
  const signatory = clone(SignatorySchema, current);

  signatory.isDefault = false;

  return signatory;
};

export const createSignatoryHandlers = (runtime: IModuleRuntime): SignatoryHandlersValue => {
  const {
    command,
    errors,
    guard,
    idempotency,
  } = runtime;

  const readVersionedRequisites = (
    transaction: IStateTransaction,
    organizationId: string,
    expectedVersion: bigint,
  ): OrganizationRequisites => {
    const current = transaction.get('organizationRequisites', organizationId);

    if (current === undefined) {
      throw errors.notFound(EntityKind.ORGANIZATION);
    }

    if (current.version !== expectedVersion) {
      throw errors.versionConflict(EntityKind.ORGANIZATION, Number(current.version));
    }

    return clone(OrganizationRequisitesSchema, current);
  };

  const writeRequisites = (
    transaction: IStateTransaction,
    requisites: OrganizationRequisites,
    signatories: Signatory[],
  ): void => {
    requisites.signatories = signatories;
    requisites.version += 1n;
    transaction.put('organizationRequisites', requisites);
  };

  return {
    removeSignatory: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(
        transaction,
        OrganizationRequisitesService.method.removeSignatory,
        request,
        context.requestHeader,
      );

      return idempotency.run(transaction, {
        handler: () => {
          const requisites = readVersionedRequisites(transaction, caller.organizationId, request.expectedVersion);
          const target = requisites.signatories.find(signatory => signatory.id === request.signatoryId);

          if (target === undefined) {
            throw errors.validationFailed([{ fieldPath: SIGNATORY_ID_PATH, ruleId: EXISTS_RULE_ID }]);
          }

          if (target.isDefault) {
            throw errors.validationFailed([{ fieldPath: SIGNATORY_ID_PATH, ruleId: DEFAULT_REQUIRED_RULE_ID }]);
          }

          writeRequisites(
            transaction,
            requisites,
            requisites.signatories.filter(signatory => signatory.id !== request.signatoryId),
          );

          return create(RemoveSignatoryResponseSchema, { requisites });
        },
        idempotencyKey: request.idempotencyKey,
        method: OrganizationRequisitesService.method.removeSignatory,
        request,
        scope: caller.organizationId,
      });
    }),
    saveSignatory: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(
        transaction,
        OrganizationRequisitesService.method.saveSignatory,
        request,
        context.requestHeader,
      );

      return idempotency.run(transaction, {
        handler: () => {
          const requisites = readVersionedRequisites(transaction, caller.organizationId, request.expectedVersion);

          if (request.signatory === undefined) {
            throw errors.validationFailed([{ fieldPath: SIGNATORY_PATH, ruleId: REQUIRED_RULE_ID }]);
          }

          const incoming = normalizeSignatory(request.signatory);
          const today = toCalendarDate(transaction.worldTimeMs, requisites.timeZone);
          const violations: ViolationValue[] = collectSignatoryViolations(incoming, today);
          const index = requisites.signatories.findIndex(signatory => signatory.id === incoming.id);
          const previous = requisites.signatories[index];

          if (previous === undefined && requisites.signatories.length >= MAX_SIGNATORIES) {
            violations.push({ fieldPath: SIGNATORY_PATH, ruleId: COUNT_MAX_RULE_ID });
          }

          if (previous?.isDefault === true && !incoming.isDefault) {
            violations.push({ fieldPath: SIGNATORY_IS_DEFAULT_PATH, ruleId: DEFAULT_REQUIRED_RULE_ID });
          }

          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const others = incoming.isDefault
            ? requisites.signatories.map(demoteSignatory)
            : requisites.signatories;
          const signatories = previous === undefined
            ? [...others, incoming]
            : others.map(signatory => (signatory.id === incoming.id ? incoming : signatory));

          writeRequisites(transaction, requisites, signatories);

          return create(SaveSignatoryResponseSchema, { requisites });
        },
        idempotencyKey: request.idempotencyKey,
        method: OrganizationRequisitesService.method.saveSignatory,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
