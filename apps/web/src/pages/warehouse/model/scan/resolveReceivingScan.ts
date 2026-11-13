import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import type { ReceiveUnitSelectionValue } from '../receiveUnitInput';
import type { WarehouseScanValue } from './parseWarehouseScan';

import { parseWarehouseScan } from './parseWarehouseScan';
import { splitMarkingCodes } from './splitMarkingCodes';

export interface ReceivingScanContextValue {
  batch?: string | undefined;
  currentSscc: string;
  expectedCodes: readonly string[];
  expectedSsccs: readonly string[];
  gtin: string | undefined;
  hasMarking: boolean;
  isLabelled: boolean;
  markingCodes: string;
  receivedCodes: readonly string[];
  receivedSsccs: readonly string[];
  sscc: string | undefined;
}

export type ReceivingScanResultValue
  = | { error: WarehouseScanErrorValue }
    | { field: 'gtin' | 'markingCodes' | 'sscc'; value: string };

export type WarehouseScanErrorValue = 'warehouseWork.error.duplicate' | 'warehouseWork.error.invalidCode';

const normalizeGtin = (gtin: string | undefined): string | undefined => gtin?.padStart(14, '0');

const markingIdentity = (scan: undefined | WarehouseScanValue, raw: string): string =>
  scan?.kind === 'product' && scan.serial !== undefined ? `${scan.gtin.padStart(14, '0')}:${scan.serial}` : raw;

export const resolveReceivingScan = (
  raw: string,
  context: ReceivingScanContextValue,
): ReceivingScanResultValue => {
  const scan = parseWarehouseScan(raw);
  if (scan?.kind === 'unit') {
    if (context.currentSscc === scan.sscc || context.receivedSsccs.includes(scan.sscc)) {
      return { error: 'warehouseWork.error.duplicate' };
    }
    if (context.isLabelled && (context.sscc === undefined ? context.expectedSsccs.includes(scan.sscc) : scan.sscc === context.sscc)) {
      return { field: 'sscc', value: scan.sscc };
    }
  }
  if (scan?.kind === 'product' && normalizeGtin(scan.gtin) === normalizeGtin(context.gtin)
    && (scan.batch === undefined || context.batch === undefined || scan.batch === context.batch)) {
    if (scan.serial === undefined && !context.isLabelled) {
      return { field: 'gtin', value: scan.gtin };
    }
  }
  if (context.hasMarking && scan !== undefined) {
    const identity = markingIdentity(scan, raw.trim());
    const isMatchingMarking = (code: string): boolean => markingIdentity(parseWarehouseScan(code), code) === identity;
    const expected = context.expectedCodes.find(isMatchingMarking);
    const isMatchingProduct = scan.kind === 'product' && scan.serial !== undefined
      && normalizeGtin(scan.gtin) === normalizeGtin(context.gtin)
      && (scan.batch === undefined || context.batch === undefined || scan.batch === context.batch);
    if (expected !== undefined || isMatchingProduct) {
      const currentCodes = splitMarkingCodes(context.markingCodes);
      if (currentCodes.some(isMatchingMarking) || context.receivedCodes.some(isMatchingMarking)) {
        return { error: 'warehouseWork.error.duplicate' };
      }
      const value = expected ?? (scan.kind === 'product'
        ? [
            `01${scan.gtin}21${scan.serial ?? ''}`,
            scan.cryptoTail,
          ].filter(part => part !== undefined).join('\u001D')
        : raw.trim());
      return { field: 'markingCodes', value: [...currentCodes, value].join(' ') };
    }
  }
  return { error: 'warehouseWork.error.invalidCode' };
};

export const resolveTaskReceivingScan = (
  raw: string,
  task: ReceivingTask,
  selection: ReceiveUnitSelectionValue,
  hasMarking: boolean,
  current: { markingCodes: string; sscc: string },
): ReceivingScanResultValue => {
  const unit = task.expectedUnits.find(candidate => candidate.id === selection.expectedUnitId);
  const batch = unit?.batches[0];
  const line = task.orderLines.find(candidate => candidate.dealLineId === batch?.dealLineId);

  return resolveReceivingScan(raw, {
    batch: batch?.batchNumber,
    currentSscc: current.sscc,
    expectedCodes: batch?.markingCodes ?? [],
    expectedSsccs: task.expectedUnits.flatMap(expected => expected.sscc ?? []),
    gtin: line?.gtin,
    hasMarking,
    isLabelled: selection.kind === 'labelled',
    markingCodes: current.markingCodes,
    receivedCodes: task.receivedUnits.flatMap(received => received.batchFacts.flatMap(fact => fact.markingCodes)),
    receivedSsccs: task.receivedUnits.flatMap(received => received.balanceAtReceipt?.handlingUnit?.sscc ?? []),
    sscc: unit?.sscc,
  });
};
