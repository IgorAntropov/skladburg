import type { ReactElement } from 'react';

import type { TextFieldProps } from '@/shared/ui';

import { TextField } from '@/shared/ui';

export const LegalAddressField = (props: TextFieldProps): ReactElement => (
  <TextField {...props} autoComplete="off" spellCheck={false} />
);
