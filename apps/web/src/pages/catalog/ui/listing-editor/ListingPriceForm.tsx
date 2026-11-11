import type {
  ListingPrice,
  PriceUnit,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';
import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { Plus } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  FormFieldBindingValue,
  FormFieldOptionsValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import { getBaseUnitLabelKey } from '@/entities/listing';
import { useCommandAccess } from '@/entities/session';
import { useI18n } from '@/shared/i18n';
import {
  createMoneyMask,
  createQuantityMask,
} from '@/shared/lib/mask';
import { formatMoney } from '@/shared/lib/money';
import {
  ActionButton,
  Button,
  useAnnounce,
} from '@/shared/ui';

import type { PriceFormValues } from '../../lib/listingFormValues';

import { useSaveListingPriceForm } from '../../api/editor/useSaveListingPriceForm';
import { removeTierRow } from '../../lib/buildPriceTiers';
import {
  getTierMinPath,
  getTierPricePath,
} from '../../lib/fieldPaths';
import {
  getInitialTierCount,
  TIER_CAPACITY,
} from '../../lib/listingFormValues';
import { resolveQuantityUnitName } from '../../lib/resolveQuantityUnitName';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditorTexts } from '../../model/useEditorTexts';
import { EditorReloadButton } from '../editor-shared/EditorReloadButton';
import {
  EDITOR_FORM_ACTIONS_CLASS_NAME,
  EDITOR_GROUP_CLASS_NAME,
  EDITOR_GROUP_HEADING_CLASS_NAME,
  EDITOR_NOTE_CLASS_NAME,
  EDITOR_SAVE_BUTTON_CLASS_NAME,
} from '../editor-shared/editorStyles';
import { RuleErrorNotice } from '../editor-shared/RuleErrorNotice';
import { SavedStatus } from '../editor-shared/SavedStatus';
import { ListingTierRow } from './ListingTierRow';

interface ListingPriceFormProps {
  isReloading: boolean;
  listingId: string;
  onDirtyChange: (isDirty: boolean) => void;
  onReload: () => void;
  onSaved: (saved: ListingPrice) => void;
  price: ListingPrice | undefined;
  priceUnit: PriceUnit | undefined;
  product: Product;
}

const MONEY_MASK = createMoneyMask();

const ADD_TIER_SELECTOR = '[data-testid="listing-add-tier"]';

const getTierMinSelector = (index: number): string => `[data-testid="listing-tier-${String(index)}-min"] input`;

export const ListingPriceForm = ({
  isReloading,
  listingId,
  onDirtyChange,
  onReload,
  onSaved,
  price,
  priceUnit,
  product,
}: ListingPriceFormProps): ReactElement => {
  const { locale } = useI18n();
  const { listingT } = useCatalogTexts();
  const t = useEditorTexts();
  const announce = useAnnounce();
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const focusTargetRef = useRef<string | undefined>(undefined);
  const [visibleCount, setVisibleCount] = useState(() => getInitialTierCount(price));
  const [hasSaved, setHasSaved] = useState(false);

  const baseQuantity = priceUnit?.baseQuantity ?? 1n;
  const quantityMask = useMemo(() => createQuantityMask(baseQuantity), [baseQuantity]);

  const handleSaved = (saved: ListingPrice): void => {
    console.log('> ListingPriceForm -> handleSaved:', { version: String(saved.version) });
    setHasSaved(true);
    onSaved(saved);
  };

  const form = useSaveListingPriceForm({ listingId, onSaved: handleSaved, price, t, visibleCount });
  const access = useCommandAccess(form.command.method);

  const baseUnitLabelKey = getBaseUnitLabelKey(product.baseUnit);
  const baseUnitLabel = baseUnitLabelKey === undefined ? '' : listingT(baseUnitLabelKey);
  const unitName = resolveQuantityUnitName(priceUnit, baseUnitLabel);
  const isAccessDenied = access.status !== 'allowed';
  const isVersionConflict = form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isTierLimitReached = visibleCount >= TIER_CAPACITY;
  const isSavedStatusShown = hasSaved && !form.isDirty;
  const minPrice = product.minPrice;
  const isMinPriceShown = minPrice !== undefined && minPrice.amountMinor > 0n;
  const tierIndexes = Array.from({ length: visibleCount }, (_item, index) => index);

  const bind = (name: FormFieldPathValue<PriceFormValues>, options?: FormFieldOptionsValue): FormFieldBindingValue => {
    const binding = { ...form.getFieldProps(name, options), isOptional: false };

    return isAccessDenied ? { ...binding, isReadOnly: true } : binding;
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    console.log('> ListingPriceForm -> handleSubmit:', { isAccessDenied });

    if (isAccessDenied) {
      event.preventDefault();

      return;
    }

    form.handleSubmit(event);
  };

  const handleAddTierClick = (): void => {
    console.log('> ListingPriceForm -> handleAddTierClick:', { visibleCount });
    focusTargetRef.current = getTierMinSelector(visibleCount);
    setVisibleCount(visibleCount + 1);
    announce(t('catalogEditor.price.added'));
  };

  const handleTierRemove = (removedIndex: number): void => {
    console.log('> ListingPriceForm -> handleTierRemove:', { removedIndex, visibleCount });

    const shiftedRows = removeTierRow(form.watchField('tiers'), removedIndex);

    for (let index = removedIndex; index < visibleCount; index += 1) {
      const row = shiftedRows[index];

      if (row !== undefined) {
        form.setFieldValue(getTierMinPath(index), row.minQuantity);
        form.setFieldValue(getTierPricePath(index), row.price.amountMinor);
      }
    }

    focusTargetRef.current = removedIndex < visibleCount - 1 ? getTierMinSelector(removedIndex) : ADD_TIER_SELECTOR;
    setVisibleCount(visibleCount - 1);
    announce(t('catalogEditor.price.removed'));
  };

  useEffect(() => {
    const target = focusTargetRef.current;

    if (target !== undefined) {
      focusTargetRef.current = undefined;
      containerRef.current?.querySelector<HTMLElement>(target)?.focus();
    }
  }, [visibleCount]);

  useEffect(() => {
    onDirtyChange(form.isDirty);

    return (): void => {
      onDirtyChange(false);
    };
  }, [form.isDirty, onDirtyChange]);

  return (
    <form autoComplete="off" className="flex flex-col gap-4" data-testid="listing-price-form" noValidate onSubmit={handleSubmit}>
      <section aria-labelledby={titleId} className={EDITOR_GROUP_CLASS_NAME} ref={containerRef}>
        <h4 className={EDITOR_GROUP_HEADING_CLASS_NAME} id={titleId}>{t('catalogEditor.price.title')}</h4>
        <p className={EDITOR_NOTE_CLASS_NAME}>{t('catalogEditor.price.hint', { unit: unitName })}</p>
        <ul className="flex flex-col gap-4">
          {tierIndexes.map(index => (
            <ListingTierRow
              bind={bind}
              index={index}
              isFirst={index === 0}
              isLast={index === visibleCount - 1}
              isRemovable={!isAccessDenied && visibleCount > 1}
              key={index}
              moneyMask={MONEY_MASK}
              onRemove={handleTierRemove}
              quantityMask={quantityMask}
              unitName={unitName}
            />
          ))}
        </ul>
        {isMinPriceShown && (
          <p className={EDITOR_NOTE_CLASS_NAME}>
            {t('catalogEditor.price.minPrice', {
              price: `${formatMoney(locale, minPrice)}/${priceUnit?.name ?? baseUnitLabel}`,
            })}
          </p>
        )}
        {!isAccessDenied && (
          <div className="flex flex-col items-start gap-2">
            {isTierLimitReached && <p className={EDITOR_NOTE_CLASS_NAME}>{t('catalogEditor.price.limit')}</p>}
            <Button
              aria-disabled={isTierLimitReached}
              data-testid="listing-add-tier"
              onClick={handleAddTierClick}
              variant="secondary"
            >
              <Plus aria-hidden className="size-4 shrink-0" />
              {t('catalogEditor.price.add')}
            </Button>
          </div>
        )}
      </section>
      <div className={EDITOR_FORM_ACTIONS_CLASS_NAME}>
        <ActionButton
          access={access}
          className={EDITOR_SAVE_BUTTON_CLASS_NAME}
          command={form.command}
          data-testid="listing-save-price"
          errorPlacement="external"
          type="submit"
          variant="primary"
        >
          {t('catalogEditor.price.save')}
        </ActionButton>
        {isSavedStatusShown && <SavedStatus />}
        <RuleErrorNotice command={form.command} />
        {isVersionConflict && (
          <EditorReloadButton isReloading={isReloading} onReload={onReload} testId="listing-price-reload" />
        )}
      </div>
    </form>
  );
};
