const CARD_LAYOUT_CLASS_NAME = 'flex flex-col gap-1 rounded-md border p-4';

export const CARD_CLASS_NAME = `${CARD_LAYOUT_CLASS_NAME} border-on-surface/30`;

export const CARD_SKELETON_CLASS_NAME = `${CARD_LAYOUT_CLASS_NAME} border-dashed border-on-surface/30`;

export const SKELETON_LINE_CLASS_NAME = 'invisible h-lh';

export const ORGANIZATION_NAME_CLASS_NAME = 'text-lg font-semibold break-words';

export const ORGANIZATION_LEGAL_NAME_CLASS_NAME = 'break-words';

export const WAREHOUSE_NAME_CLASS_NAME = 'font-medium break-words';

export const WAREHOUSE_ADDRESS_CLASS_NAME = 'break-words';

export const createSkeletonLineClassName = (lineClassName: string): string => `${lineClassName} ${SKELETON_LINE_CLASS_NAME}`;
