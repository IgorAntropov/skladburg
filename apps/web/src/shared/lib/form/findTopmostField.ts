export const findTopmostField = (
  elements: ReadonlyMap<string, Element>,
  fields: readonly string[],
): string | undefined => {
  let topmostField: string | undefined;
  let topmostElement: Element | undefined;

  for (const field of fields) {
    const element = elements.get(field);

    if (element === undefined) {
      continue;
    }

    const isHigher = topmostElement === undefined
      || (element.compareDocumentPosition(topmostElement) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    if (isHigher) {
      topmostField = field;
      topmostElement = element;
    }
  }

  return topmostField;
};
