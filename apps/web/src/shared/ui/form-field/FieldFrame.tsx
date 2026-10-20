import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { FieldMessage } from './FieldMessage';
import { FIELD_LABEL_CLASS_NAME } from './fieldStyles';

const LABEL_TEXT_CLASS_NAME = 'min-w-0 truncate';
const OPTIONAL_CLASS_NAME = 'ms-1 shrink-0 whitespace-nowrap before:me-1 before:content-["·"]';

export interface FieldFrameProps {
  children: ReactNode;
  controlId: string;
  error?: string | undefined;
  hint?: string | undefined;
  isOptional: boolean;
  label: string;
  labelRaisedClassName: string;
  messageId: string;
}

export const FieldFrame = ({
  children,
  controlId,
  error,
  hint,
  isOptional,
  label,
  labelRaisedClassName,
  messageId,
}: FieldFrameProps): ReactElement => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-1">
      <div className="group/field relative">
        {children}
        <label className={cn(FIELD_LABEL_CLASS_NAME, labelRaisedClassName)} htmlFor={controlId}>
          <span className={LABEL_TEXT_CLASS_NAME}>{label}</span>
          {isOptional && <span className={OPTIONAL_CLASS_NAME}>{t('field.optional')}</span>}
        </label>
      </div>
      <FieldMessage error={error} hint={hint} id={messageId} />
    </div>
  );
};
