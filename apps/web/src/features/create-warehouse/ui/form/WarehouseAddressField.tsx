import type {
  ChangeEvent,
  KeyboardEvent,
  ReactElement,
} from 'react';

import {
  useId,
  useRef,
  useState,
} from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import { useI18n } from '@/shared/i18n';
import {
  Button,
  TextField,
} from '@/shared/ui';

import type { CreateWarehouseFormValues } from '../../model/createWarehouseFormValues';

import { findDemoWarehouseAddresses } from '../../lib/findDemoWarehouseAddresses';

interface WarehouseAddressFieldProps {
  cityName: string | undefined;
  form: CommandFormValue<CreateWarehouseFormValues>;
}

export const WarehouseAddressField = ({ cityName, form }: WarehouseAddressFieldProps): ReactElement => {
  const { t } = useI18n();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const binding = form.getFieldProps('address');
  const suggestions = isDismissed || binding.isReadOnly ? [] : findDemoWarehouseAddresses(cityName, form.watchField('address'));
  const hasSuggestions = suggestions.length > 0;

  const handleRef = (input: HTMLInputElement | null): void => {
    inputRef.current = input;
    binding.ref(input);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    binding.onChange(event);
    setIsDismissed(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && hasSuggestions && !event.nativeEvent.isComposing) {
      event.preventDefault();
      setIsDismissed(true);
      inputRef.current?.focus();
    }
  };

  const handleChoose = (address: string): void => {
    form.setFieldValue('address', address);
    setIsDismissed(true);
    inputRef.current?.focus();
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <TextField
        {...binding}
        label={t('warehouse.create.address')}
        onChange={handleChange}
        ref={handleRef}
      />
      <p className="text-sm text-on-panel-muted" id={titleId} role="status">
        {hasSuggestions ? t('warehouse.create.address_suggestions') : null}
      </p>
      {hasSuggestions && (
        <ul aria-labelledby={titleId} className="mt-1 rounded-control border border-line p-1">
          {suggestions.map(address => (
            <li key={address}>
              <Button
                className="w-full justify-start text-left"
                data-testid="create-warehouse-address-option"
                onClick={() => {
                  handleChoose(address);
                }}
                tabIndex={0}
                variant="neutral"
              >
                {address}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
