const EDITABLE_TAG_NAMES: readonly string[] = ['INPUT', 'SELECT', 'TEXTAREA'];

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (EDITABLE_TAG_NAMES.includes(target.tagName)) {
    return true;
  }

  const editableHost = target.closest('[contenteditable]');

  return editableHost !== null && editableHost.getAttribute('contenteditable') !== 'false';
};
