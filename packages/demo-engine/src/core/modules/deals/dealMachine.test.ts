import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../../errors/index';
import { createSeededRandom } from '../../ports/index';
import { captureFailure } from '../catalog/testing/catalogFixtures';
import {
  type DealCommand,
  dealMachine,
} from './dealMachine';

const statuses = Object.values(DealStatus).filter(status => typeof status === 'number');
const expectedRows = [
  { command: 'acceptCounterOffer',
    from: DealStatus.COUNTER_OFFERED,
    permission: 'deal_approve',
    side: 'customer',
    status: DealStatus.AGREED },
  { command: 'acceptDeal', from: DealStatus.ARRIVED, permission: 'document_sign', side: 'customer', status: DealStatus.ACCEPTED },
  { command: 'acceptDeal', from: DealStatus.ACCEPTING, permission: 'document_sign', side: 'customer', status: DealStatus.ACCEPTED },
  { command: 'arrive', from: DealStatus.IN_TRANSIT, permission: '', side: 'system', status: DealStatus.ARRIVED },
  { command: 'autoAccept', from: DealStatus.ARRIVED, permission: '', side: 'system', status: DealStatus.ACCEPTED },
  { command: 'autoAccept', from: DealStatus.ACCEPTING, permission: '', side: 'system', status: DealStatus.ACCEPTED },
  { command: 'cancelDeal', from: DealStatus.DRAFT, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.SUBMITTED, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.COUNTER_OFFERED, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.AGREED, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.AWAITING_LOGISTICS, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.LOGISTICS_CHOSEN, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.DOCUMENTS_CONFIRMED, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.AWAITING_PAYMENT, permission: 'deal_edit', side: 'either', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.PAID, permission: 'deal_edit', side: 'customer', status: DealStatus.CANCELLED },
  { command: 'cancelDeal', from: DealStatus.PICKING, permission: 'deal_edit', side: 'customer', status: DealStatus.CANCELLED },
  { command: 'chooseDelivery', from: DealStatus.AGREED, permission: 'deal_edit', side: 'customer', status: DealStatus.LOGISTICS_CHOSEN },
  { command: 'chooseDelivery',
    from: DealStatus.AWAITING_LOGISTICS,
    permission: 'deal_edit',
    side: 'customer',
    status: DealStatus.LOGISTICS_CHOSEN },
  { command: 'close', from: DealStatus.SETTLEMENT, permission: '', side: 'system', status: DealStatus.CLOSED },
  { command: 'confirmDeal', from: DealStatus.SUBMITTED, permission: 'deal_approve', side: 'supplier', status: DealStatus.AGREED },
  { command: 'confirmDocuments',
    from: DealStatus.LOGISTICS_CHOSEN,
    permission: '',
    side: 'system',
    status: DealStatus.DOCUMENTS_CONFIRMED },
  { command: 'confirmReceipt', from: DealStatus.ACCEPTING, permission: 'document_sign', side: 'customer', status: DealStatus.ACCEPTED },
  { command: 'confirmReceipt', from: DealStatus.CLAIM, permission: 'document_sign', side: 'customer', status: DealStatus.CLAIM },
  { command: 'confirmTransportOrder',
    from: DealStatus.AWAITING_LOGISTICS,
    permission: '',
    side: 'system',
    status: DealStatus.LOGISTICS_CHOSEN },
  { command: 'counterDeal', from: DealStatus.SUBMITTED, permission: 'deal_edit', side: 'supplier', status: DealStatus.COUNTER_OFFERED },
  { command: 'fund', from: DealStatus.AWAITING_PAYMENT, permission: '', side: 'system', status: DealStatus.PAID },
  { command: 'markDealShipped', from: DealStatus.PAID, permission: 'deal_edit', side: 'supplier', status: DealStatus.SHIPPED },
  { command: 'markDealShipped', from: DealStatus.PICKING, permission: 'deal_edit', side: 'supplier', status: DealStatus.SHIPPED },
  { command: 'openClaim', from: DealStatus.ACCEPTING, permission: 'claim_create', side: 'customer', status: DealStatus.CLAIM },
  { command: 'rejectCounterOffer',
    from: DealStatus.COUNTER_OFFERED,
    permission: 'deal_edit',
    side: 'customer',
    status: DealStatus.REJECTED },
  { command: 'rejectDeal', from: DealStatus.SUBMITTED, permission: 'deal_edit', side: 'supplier', status: DealStatus.REJECTED },
  { command: 'requestPayment', from: DealStatus.DOCUMENTS_CONFIRMED, permission: '', side: 'system', status: DealStatus.AWAITING_PAYMENT },
  { command: 'resolveClaim', from: DealStatus.CLAIM, permission: '', side: 'system', status: DealStatus.ACCEPTED },
  { command: 'settle', from: DealStatus.ACCEPTED, permission: '', side: 'system', status: DealStatus.SETTLEMENT },
  { command: 'startAccepting', from: DealStatus.ARRIVED, permission: '', side: 'system', status: DealStatus.ACCEPTING },
  { command: 'startPicking', from: DealStatus.PAID, permission: '', side: 'system', status: DealStatus.PICKING },
  { command: 'startTransit', from: DealStatus.SHIPPED, permission: '', side: 'system', status: DealStatus.IN_TRANSIT },
  { command: 'submitDeal', from: DealStatus.DRAFT, permission: 'deal_approve', side: 'customer', status: DealStatus.SUBMITTED },
  { command: 'updateDealDraft', from: DealStatus.DRAFT, permission: 'deal_edit', side: 'customer', status: DealStatus.DRAFT },
  { command: 'publishTransportRequest', from: DealStatus.AGREED, permission: 'transport_request_create', side: 'either',
    status: DealStatus.AWAITING_LOGISTICS },
] satisfies { command: DealCommand; from: DealStatus; permission: string; side: string; status: DealStatus }[];
const commands = [...new Set(expectedRows.map(row => row.command))];

const errors = createDomainErrors(createSeededRandom(1));

describe('deal state machine', () => {
  it.each(commands.flatMap(command => statuses.map(status => ({ command, status }))))(
    'resolves only the table row $command from $status', async ({ command, status }) => {
      const expected = expectedRows.find(row => row.command === command && row.from === status);
      if (expected === undefined) {
        const failure = await captureFailure(Promise.resolve().then(() => dealMachine.requireTransition(errors,
          command,
          { status,
            version: 7 },
          7)));
        expect(failure.code).toBe(ErrorCode.INVALID_TRANSITION);
      }
      else {
        const transition = { permission: expected.permission, side: expected.side, status: expected.status };
        expect(dealMachine.findTransition(command, status)).toEqual(transition);
        expect(dealMachine.requireTransition(errors, command, { status, version: 7 }, 7)).toEqual(transition);
      }
    },
  );

  it.each(commands)('checks a stale version before the transition for %s', async (command) => {
    const failure = await captureFailure(Promise.resolve().then(() => dealMachine.requireTransition(errors,
      command,
      { status: DealStatus.CLOSED,
        version: 7 },
      6)));
    expect(failure.code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(failure.currentVersion).toBe(7);
    expect(failure.entity).toBe(EntityKind.DEAL);
  });
});
