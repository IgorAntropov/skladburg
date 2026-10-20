import type { DescMethod } from '@bufbuild/protobuf';

import { getMethodAccess } from '@skladburg/contracts/runtime';

export type CommandRequirementValue
  = | { kind: 'open' }
    | { kind: 'permission'; permission: string };

const OPEN_REQUIREMENT: CommandRequirementValue = { kind: 'open' };

let requirementsByMethod: undefined | WeakMap<DescMethod, CommandRequirementValue>;

const getRequirementsByMethod = (): WeakMap<DescMethod, CommandRequirementValue> => {
  requirementsByMethod ??= new WeakMap();

  return requirementsByMethod;
};

const parseRequirement = (method: DescMethod): CommandRequirementValue => {
  const requirement = getMethodAccess(method)?.requirement;

  return requirement?.case === 'permission'
    ? { kind: 'permission', permission: requirement.value.name }
    : OPEN_REQUIREMENT;
};

export const readCommandRequirement = (method: DescMethod | undefined): CommandRequirementValue => {
  if (method === undefined) {
    return OPEN_REQUIREMENT;
  }

  const cache = getRequirementsByMethod();
  const cached = cache.get(method);

  if (cached !== undefined) {
    return cached;
  }

  const requirement = parseRequirement(method);

  cache.set(method, requirement);

  return requirement;
};
