import type {
  ReactElement,
  ReactNode,
} from 'react';

import { RadioGroup } from '@radix-ui/react-dropdown-menu';

interface DropdownMenuRadioGroupProps<TValue extends string> {
  children: ReactNode;
  label: string;
  onValueChange: (value: TValue) => void;
  value: TValue | undefined;
}

export const DropdownMenuRadioGroup = <TValue extends string>({
  children,
  label,
  onValueChange,
  value,
}: DropdownMenuRadioGroupProps<TValue>): ReactElement => {
  const handleValueChange = (selectedValue: string): void => {
    console.log('> DropdownMenuRadioGroup -> handleValueChange:', { selectedValue });
    onValueChange(selectedValue as TValue);
  };

  return (
    <RadioGroup aria-label={label} onValueChange={handleValueChange} value={value}>
      {children}
    </RadioGroup>
  );
};
