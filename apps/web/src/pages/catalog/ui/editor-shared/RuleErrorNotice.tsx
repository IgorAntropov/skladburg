import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { TriangleAlert } from 'lucide-react';

import type { CommandValue } from '@/shared/api';

import { getFieldViolations } from '@/shared/api';
import { CommandErrorNotice } from '@/shared/ui';

import { translateCatalogViolation } from '../../lib/translateCatalogViolation';
import { useEditorTexts } from '../../model/useEditorTexts';

interface RuleErrorNoticeProps {
  command: CommandValue;
}

const BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export const RuleErrorNotice = ({ command }: RuleErrorNoticeProps): null | ReactElement => {
  const t = useEditorTexts();

  const { apiError, failedAt, isPending } = command;

  if (isPending || apiError === undefined) {
    return null;
  }

  const ruleTexts = apiError.code === ErrorCode.VALIDATION_FAILED
    ? [...new Set(getFieldViolations(apiError).flatMap((violation) => {
        const text = translateCatalogViolation(t, violation.ruleId);

        return text === undefined ? [] : [text];
      }))]
    : [];

  if (ruleTexts.length === 0) {
    return <CommandErrorNotice command={command} />;
  }

  return (
    <div className="flex flex-col items-start gap-2" data-testid="listing-rule-error">
      {ruleTexts.map(text => (
        <div className="flex items-start gap-2" key={text}>
          <span aria-hidden className={BADGE_CLASS_NAME}>
            <TriangleAlert className="size-4" />
          </span>
          <p className="text-base leading-6" key={failedAt} role="alert">{text}</p>
        </div>
      ))}
    </div>
  );
};
