import { findTopmostField } from './findTopmostField';

export const focusTopmostField = (
  elements: ReadonlyMap<string, HTMLElement>,
  fields: readonly string[],
): void => {
  const topmostField = findTopmostField(elements, fields);

  if (topmostField !== undefined) {
    elements.get(topmostField)?.focus();
  }
};
