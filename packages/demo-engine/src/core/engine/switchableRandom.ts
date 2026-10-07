import type { IRandom } from '../ports/index';

export interface ISwitchableRandom extends IRandom {
  replace: (next: IRandom) => void;
}

export const createSwitchableRandom = (initial: IRandom): ISwitchableRandom => {
  let current = initial;

  return {
    getState: () => current.getState(),
    next: () => current.next(),
    nextInt: maxExclusive => current.nextInt(maxExclusive),
    replace: (next) => {
      current = next;
    },
    uuid: () => current.uuid(),
  };
};
