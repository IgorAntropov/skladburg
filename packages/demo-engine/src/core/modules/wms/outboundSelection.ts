interface SelectedUnitValue {
  index: number;
  prev: SelectedUnitValue | undefined;
}

interface SelectionStateValue {
  index: number;
  quantity: bigint;
  selected: SelectedUnitValue | undefined;
}

const MAX_SELECTION_STATES = 100_000;
const MAX_EXACT_FALLBACK_UNITS = 34;

const subsetSums = (quantities: readonly bigint[]): bigint[] => {
  const sums = [0n];
  const count = 1 << quantities.length;

  for (let mask = 1; mask < count; mask += 1) {
    const prev = mask & (mask - 1);
    const bit = 31 - Math.clz32(mask ^ prev);
    sums.push((sums[prev] ?? 0n) + (quantities[quantities.length - 1 - bit] ?? 0n));
  }

  return sums;
};

const selectedIndices = (mask: number, start: number, end: number): number[] => {
  const indices: number[] = [];
  for (let index = start; index < end; index += 1) {
    if ((mask & (1 << (end - 1 - index))) !== 0) {
      indices.push(index);
    }
  }
  return indices;
};

const selectAfterLimit = (quantities: readonly bigint[], quantity: bigint): null | number[] | undefined => {
  if (quantities.length > MAX_EXACT_FALLBACK_UNITS) {
    const direct = quantities.indexOf(quantity);
    return direct < 0 ? null : [direct];
  }

  const middle = Math.floor(quantities.length / 2);
  const rightMasks = new Map<bigint, number>();
  for (const [mask, total] of subsetSums(quantities.slice(middle)).entries()) {
    if (total <= quantity) {
      rightMasks.set(total, mask);
    }
  }

  const leftSums = subsetSums(quantities.slice(0, middle));
  for (let mask = leftSums.length - 1; mask >= 0; mask -= 1) {
    const right = rightMasks.get(quantity - (leftSums[mask] ?? 0n));
    if (right !== undefined) {
      return [...selectedIndices(mask, 0, middle), ...selectedIndices(right, middle, quantities.length)];
    }
  }
  return undefined;
};

export const selectWholeUnits = (quantities: readonly bigint[], quantity: bigint): null | number[] | undefined => {
  const suffix = [0n];
  for (const unitQuantity of quantities.toReversed()) {
    suffix.push((suffix.at(-1) ?? 0n) + unitQuantity);
  }

  const pending: SelectionStateValue[] = [{ index: 0, quantity, selected: undefined }];
  const visited = new Map<number, Set<bigint>>();
  let states = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) {
      break;
    }

    if (current.quantity === 0n) {
      const result: number[] = [];
      for (let selected = current.selected; selected !== undefined; selected = selected.prev) {
        result.push(selected.index);
      }
      return result.reverse();
    }

    const unit = quantities[current.index];
    if (unit === undefined || current.quantity > (suffix[quantities.length - current.index] ?? 0n)) {
      continue;
    }

    const remaining = visited.get(current.index) ?? new Set<bigint>();
    if (remaining.has(current.quantity)) {
      continue;
    }
    if (states >= MAX_SELECTION_STATES) {
      return selectAfterLimit(quantities, quantity);
    }
    states += 1;
    remaining.add(current.quantity);
    visited.set(current.index, remaining);

    const index = current.index + 1;
    pending.push({ ...current, index });
    if (unit <= current.quantity) {
      pending.push({ index, quantity: current.quantity - unit, selected: { index: current.index, prev: current.selected } });
    }
  }

  return undefined;
};
