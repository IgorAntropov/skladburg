import type {
  ITable,
  ITableOverlay,
} from './table';
import type {
  TableIndexesValue,
  TableName,
  TableRecordsValue,
} from './tables';

import { compareIds } from './table';

export interface IStateReader {
  get: <TName extends TableName>(table: TName, id: string) => TableRecordsValue[TName] | undefined;
  list: <TName extends TableName>(table: TName) => TableRecordsValue[TName][];
  listBy: <TName extends TableName>(table: TName, index: TableIndexesValue[TName], key: string) => TableRecordsValue[TName][];
}

export type OverlaysValue = {
  [TName in TableName]: ITableOverlay<TableRecordsValue[TName]>;
};

export type TablesValue = {
  [TName in TableName]: ITable<TableRecordsValue[TName], TableIndexesValue[TName]>;
};

export const createReader = (tables: TablesValue, overlays: OverlaysValue): IStateReader => {
  const get = <TName extends TableName>(table: TName, id: string): TableRecordsValue[TName] | undefined => {
    const { entries } = overlays[table];
    const record = entries.has(id) ? entries.get(id) : tables[table].get(id);

    return record === undefined ? undefined : tables[table].definition.clone(record);
  };

  const collect = <TName extends TableName>(table: TName, storedIds: readonly string[], isOverlayMatch: (
    record: TableRecordsValue[TName],
  ) => boolean): TableRecordsValue[TName][] => {
    const { entries } = overlays[table];
    const ids = new Set(storedIds.filter(id => !entries.has(id)));

    for (const [id, record] of entries) {
      if (record !== undefined && isOverlayMatch(record)) {
        ids.add(id);
      }
    }

    return [...ids]
      .sort(compareIds)
      .flatMap((id) => {
        const record = get(table, id);

        return record === undefined ? [] : [record];
      });
  };

  const list = <TName extends TableName>(table: TName): TableRecordsValue[TName][] =>
    collect(table, tables[table].ids(), () => true);

  const listBy = <TName extends TableName>(
    table: TName,
    index: TableIndexesValue[TName],
    key: string,
  ): TableRecordsValue[TName][] => {
    const getKey = tables[table].definition.indexKeys[index];

    return collect(table, tables[table].idsByIndex(index, key), record => getKey(record) === key);
  };

  return { get, list, listBy };
};
