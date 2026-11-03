import type { ReactElement } from 'react';

import type { InputMaskValue } from '@/shared/lib/mask';

import {
  Button,
  TextField,
} from '@/shared/ui';

import type { PriceFieldBinder } from './listingEditorTypes';

import {
  getTierMinPath,
  getTierPricePath,
} from '../../lib/fieldPaths';
import { useEditorTexts } from '../../model/useEditorTexts';

interface ListingTierRowProps {
  bind: PriceFieldBinder;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isRemovable: boolean;
  moneyMask: InputMaskValue;
  onRemove: (index: number) => void;
  quantityMask: InputMaskValue;
  unitName: string;
}

export const ListingTierRow = ({
  bind,
  index,
  isFirst,
  isLast,
  isRemovable,
  moneyMask,
  onRemove,
  quantityMask,
  unitName,
}: ListingTierRowProps): ReactElement => {
  const t = useEditorTexts();

  const handleRemoveClick = (): void => {
    console.log('> ListingTierRow -> handleRemoveClick:', { index });
    onRemove(index);
  };

  return (
    <li className="flex flex-col gap-1" data-testid={`listing-tier-${String(index)}`}>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h5 className="text-sm leading-5 font-semibold text-on-panel">{t('catalogEditor.price.tier', { number: index + 1 })}</h5>
        {isRemovable && (
          <Button
            aria-label={t('catalogEditor.price.removeTier', { number: index + 1 })}
            data-testid={`listing-tier-${String(index)}-remove`}
            onClick={handleRemoveClick}
            variant="ghost"
          >
            {t('catalogEditor.price.remove')}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[2fr_3fr] gap-3">
        <div data-testid={`listing-tier-${String(index)}-min`}>
          <TextField
            {...bind(getTierMinPath(index), { mask: quantityMask })}
            autoComplete="off"
            enterKeyHint="next"
            hint={isFirst ? t('catalogEditor.price.fromHint') : undefined}
            label={t('catalogEditor.price.from', { unit: unitName })}
          />
        </div>
        <div data-testid={`listing-tier-${String(index)}-price`}>
          <TextField
            {...bind(getTierPricePath(index), { mask: moneyMask })}
            autoComplete="off"
            enterKeyHint={isLast ? 'done' : 'next'}
            label={t('catalogEditor.price.amount', { unit: unitName })}
          />
        </div>
      </div>
    </li>
  );
};
