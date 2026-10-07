import { PermissionActionSchema } from '../gen/access/v1/access_pb';

export const listPermissionActions = (): string[] =>
  PermissionActionSchema.values
    .filter(value => value.number !== 0)
    .map(value => value.localName.toLowerCase());
