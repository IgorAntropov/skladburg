import type { ReactElement } from 'react';

import type { CommandValue } from '@/shared/api';

import { ErrorNotice } from '../widget-states/ErrorNotice';

export interface CommandErrorNoticeProps {
  command: CommandValue;
}

export const CommandErrorNotice = ({ command }: CommandErrorNoticeProps): null | ReactElement => {
  const { error, failedAt, isPending } = command;
  const isErrorShown = error !== null && !isPending;

  return isErrorShown ? <ErrorNotice announceKey={failedAt} error={error} /> : null;
};
