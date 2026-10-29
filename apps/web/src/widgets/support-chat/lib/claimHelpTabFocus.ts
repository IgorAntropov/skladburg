export interface TabFocusCandidatesValue<TElement extends object> {
  activeElement: null | TElement;
  bodyElement: null | TElement;
  dialogElement: null | TElement;
  tabElement: TElement;
}

export const canClaimTabFocus = <TElement extends object>({
  activeElement,
  bodyElement,
  dialogElement,
  tabElement,
}: TabFocusCandidatesValue<TElement>): boolean => {
  const claimableElements: readonly (null | TElement)[] = [bodyElement, dialogElement, tabElement];

  return activeElement === null || claimableElements.includes(activeElement);
};

export const claimHelpTabFocus = (contentElement: Element): void => {
  const ownerDocument = contentElement.ownerDocument;
  const labelledBy = contentElement.closest('[role="tabpanel"]')?.getAttribute('aria-labelledby');
  const tabElement = labelledBy === null || labelledBy === undefined ? null : ownerDocument.getElementById(labelledBy);

  if (!(tabElement instanceof HTMLElement)) {
    return;
  }

  const isClaimable = canClaimTabFocus({
    activeElement: ownerDocument.activeElement,
    bodyElement: ownerDocument.body,
    dialogElement: contentElement.closest('[role="dialog"]'),
    tabElement,
  });

  if (isClaimable) {
    tabElement.focus();
  }
};
