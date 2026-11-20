import type { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import type { ReactElement } from 'react';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { useI18n } from '@/shared/i18n';
import { ActionButton } from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { warehouseQualificationMessages } from '../../i18n/warehouseQualificationRu';
import {
  getWarehouseQualificationFailure,
  getWarehouseQualificationNameKey,
} from '../../model/warehouseQualification';

interface WarehouseClaimButtonProps {
  access: CommandAccessValue;
  command: CommandValue;
  t: WarehouseWorkTranslate;
  testId: string;
}

export const WarehouseClaimButton = ({ access, command, t, testId }: WarehouseClaimButtonProps): ReactElement => {
  const { createSectionTranslator } = useI18n();
  const translate = createSectionTranslator(warehouseQualificationMessages);
  const failure = getWarehouseQualificationFailure(command.apiError);
  return (
    <>
      <ActionButton access={access} command={command} data-testid={testId} errorPlacement={failure === undefined ? 'below' : 'external'}>
        {t('warehouseWork.claim')}
      </ActionButton>
      {failure !== undefined && !command.isPending && (
        <p className="text-sm" key={command.failedAt} role="alert">
          {translate(failure.message, { qualification: translate(failure.qualification) })}
        </p>
      )}
    </>
  );
};

export const WarehouseTaskQualifications = ({ required, t }: {
  required: readonly WarehouseStaffQualificationKind[];
  t: WarehouseWorkTranslate;
}): null | ReactElement => {
  const { createSectionTranslator } = useI18n();
  if (required.length === 0) {
    return null;
  }
  const translate = createSectionTranslator(warehouseQualificationMessages);
  const labels = required.map((kind) => {
    const key = getWarehouseQualificationNameKey(kind);
    return key === undefined ? t('warehouseWork.otherQualification') : translate(key);
  });
  return <p className="text-sm">{t('warehouseWork.requiredQualifications', { names: labels.join(', ') })}</p>;
};
