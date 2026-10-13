import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  INSTANCE_RECORD_SIZE,
  limitRecordsByRank,
} from './terrainInstances';

const createRecords = (ranks: readonly number[]): number[] =>
  ranks.flatMap(rank => [rank, ...Array.from({ length: INSTANCE_RECORD_SIZE - 1 }, () => rank * 10)]);

const readRanks = (records: readonly number[]): number[] =>
  Array.from({ length: records.length / INSTANCE_RECORD_SIZE }, (_, index) => records[index * INSTANCE_RECORD_SIZE] ?? 0);

describe('limitRecordsByRank', () => {
  it('keeps every record when they fit the limit', () => {
    const first = createRecords([0.5, 0.1]);
    const second = createRecords([0.9]);

    expect(limitRecordsByRank([first, second], 3)).toEqual([first, second]);
  });

  it('drops the records with the highest ranks across all lists, whatever the order they were added in', () => {
    const first = createRecords([0.9, 0.2, 0.7]);
    const second = createRecords([0.1, 0.95, 0.4]);

    const [limitedFirst = [], limitedSecond = []] = limitRecordsByRank([first, second], 4);

    expect(readRanks(limitedFirst)).toEqual([0.2, 0.7]);
    expect(readRanks(limitedSecond)).toEqual([0.1, 0.4]);
  });

  it('keeps the whole record of every record it keeps', () => {
    const [limited = []] = limitRecordsByRank([createRecords([0.3, 0.8])], 1);

    expect(limited).toEqual(createRecords([0.3]));
  });

  it('gives the same result when the records come in another order', () => {
    const ranks = [0.8, 0.3, 0.6, 0.1, 0.9];
    const [forward = []] = limitRecordsByRank([createRecords(ranks)], 3);
    const [backward = []] = limitRecordsByRank([createRecords([...ranks].reverse())], 3);

    expect(readRanks(forward).sort((current, prev) => current - prev)).toEqual(readRanks(backward).sort((current, prev) => current - prev));
  });

  it('gives an empty list for an empty input', () => {
    expect(limitRecordsByRank([[], []], 0)).toEqual([[], []]);
  });
});
