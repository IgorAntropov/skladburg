import type {
  ChangeEventHandler,
  ReactElement,
  Ref,
} from 'react';

import { TextField } from '@/shared/ui';

import { useCatalogTexts } from '../model/useCatalogTexts';

interface CatalogSearchFieldProps {
  className?: string | undefined;
  name: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  ref?: Ref<HTMLInputElement> | undefined;
}

export const CatalogSearchField = ({ className, name, onChange, ref }: CatalogSearchFieldProps): ReactElement => {
  const { t } = useCatalogTexts();

  return (
    <div className={className} data-testid={name}>
      <TextField
        autoComplete="off"
        enterKeyHint="search"
        inputMode="search"
        label={t('catalog.filter.search')}
        name={name}
        onChange={onChange}
        ref={ref}
        spellCheck={false}
      />
    </div>
  );
};
