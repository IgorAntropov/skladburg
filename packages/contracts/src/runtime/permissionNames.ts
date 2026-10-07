import type { DescService } from '@bufbuild/protobuf';

import { getMethodAccess } from './methodAccess';

export const listPermissionNames = (services: readonly DescService[]): string[] => {
  const names = services
    .flatMap(service => service.methods)
    .map(method => getMethodAccess(method)?.requirement)
    .flatMap(requirement => (requirement?.case === 'permission' ? [requirement.value.name] : []));

  return [...new Set(names)].sort((current, next) => current.localeCompare(next, 'en'));
};
