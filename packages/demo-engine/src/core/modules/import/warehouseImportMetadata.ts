import type {
  StoredFieldValue,
  StoredObjectValue,
} from '../../ports/index';

export interface WarehouseCellRollbackValue {
  addedCellIds: string[];
  previousTopologyBytes: null | Uint8Array;
  revision: number;
}

export interface WarehouseImportMetadataValue {
  references: WarehouseImportReferenceValue[];
  rollback: null | WarehouseCellRollbackValue;
  topologyRevision: number;
}

export interface WarehouseImportReferenceValue {
  baseUnit: number;
  cellId: string;
  productId: string;
  rowNumber: number;
}

const readObject = (value: StoredFieldValue | undefined): StoredObjectValue => {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Uint8Array) {
    throw new TypeError('Invalid warehouse import metadata');
  }
  return value as StoredObjectValue;
};

const readReference = (value: StoredFieldValue): WarehouseImportReferenceValue => {
  const { baseUnit, cellId, productId, rowNumber } = readObject(value);
  if (typeof baseUnit !== 'number' || typeof cellId !== 'string' || typeof productId !== 'string' || typeof rowNumber !== 'number') {
    throw new TypeError('Invalid warehouse import reference');
  }
  return { baseUnit, cellId, productId, rowNumber };
};

const readRollback = (value: StoredFieldValue | undefined): null | WarehouseCellRollbackValue => {
  if (value === null) {
    return null;
  }
  const { addedCellIds, previousTopologyBytes, revision } = readObject(value);
  if (!Array.isArray(addedCellIds) || typeof revision !== 'number'
    || (previousTopologyBytes !== null && !(previousTopologyBytes instanceof Uint8Array))) {
    throw new TypeError('Invalid warehouse cell rollback');
  }
  return {
    addedCellIds: addedCellIds.map((id: unknown): string => {
      if (typeof id !== 'string') {
        throw new TypeError('Invalid imported warehouse cell id');
      }
      return id;
    }),
    previousTopologyBytes,
    revision,
  };
};

export const readWarehouseImportMetadata = (value: StoredFieldValue): WarehouseImportMetadataValue => {
  const { references, rollback, topologyRevision } = readObject(value);
  if (!Array.isArray(references) || typeof topologyRevision !== 'number') {
    throw new TypeError('Invalid warehouse import metadata');
  }
  return { references: references.map(readReference), rollback: readRollback(rollback), topologyRevision };
};

export const serializeWarehouseImportMetadata = (value: WarehouseImportMetadataValue): StoredObjectValue => ({
  references: value.references.map(reference => ({ ...reference })),
  rollback: value.rollback === null
    ? null
    : {
        addedCellIds: [...value.rollback.addedCellIds],
        previousTopologyBytes: value.rollback.previousTopologyBytes?.slice() ?? null,
        revision: value.rollback.revision,
      },
  topologyRevision: value.topologyRevision,
});
