import { FIELD_BORDER_CLASS_NAME } from './fieldSurfaceStyles';

const FIELD_BORDER_READ_ONLY_CLASS_NAME = 'cursor-default border-line-strong hover:border-line-strong';
const FIELD_BORDER_INVALID_CLASS_NAME = 'border-status-alarm hover:border-status-alarm';

interface FieldBorderStateValue {
  isInvalid: boolean;
  isReadOnly: boolean;
}

export const getFieldBorderClassName = ({ isInvalid, isReadOnly }: FieldBorderStateValue): string => {
  if (isInvalid) {
    return FIELD_BORDER_INVALID_CLASS_NAME;
  }

  return isReadOnly ? FIELD_BORDER_READ_ONLY_CLASS_NAME : FIELD_BORDER_CLASS_NAME;
};

export const FIELD_CONTROL_SIZE_CLASS_NAME = 'min-h-14 pt-5.5 pb-1.5 leading-6';

export const FIELD_AUTOFILL_CLASS_NAME = [
  'autofill:[-webkit-text-fill-color:var(--color-on-panel)]',
  'autofill:[box-shadow:inset_0_0_0_1000px_var(--color-panel-solid)]',
].join(' ');

export const FIELD_LABEL_CLASS_NAME = [
  'pointer-events-none absolute top-0 left-3 flex origin-top-left translate-y-4',
  'text-base leading-6 text-on-panel-muted',
  'motion-safe:transition-[translate,scale] motion-safe:duration-(--duration-fast) motion-safe:ease-out',
].join(' ');
