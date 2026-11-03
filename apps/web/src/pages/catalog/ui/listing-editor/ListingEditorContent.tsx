import type { Listing } from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useOwnListingQuery } from '@/entities/listing';
import { useCan } from '@/entities/session';
import {
  Button,
  useAnnounce,
} from '@/shared/ui';

import type { EditSnapshotValue } from '../../model/useEditBaseline';
import type { ListingEditorProps } from './listingEditorTypes';

import { useListingCache } from '../../api/useListingCache';
import { isListingDataEqual } from '../../lib/isListingDataEqual';
import { toOwnListingPair } from '../../lib/toOwnListingPairs';
import { useEditBaseline } from '../../model/useEditBaseline';
import { useEditorTexts } from '../../model/useEditorTexts';
import { ListingPositionSection } from './ListingPositionSection';
import { ListingPriceSection } from './ListingPriceSection';
import { ListingPublication } from './ListingPublication';

export const ListingEditorContent = ({ onClose, pair }: ListingEditorProps): ReactElement => {
  const t = useEditorTexts();
  const announce = useAnnounce();
  const cache = useListingCache();
  const titleId = useId();
  const backRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const [isPositionDirty, setIsPositionDirty] = useState(false);
  const [isPriceDirty, setIsPriceDirty] = useState(false);
  const [isPublicationReloading, setIsPublicationReloading] = useState(false);
  const canViewPrices = useCan(PermissionCode.PRICE_LIST_VIEW);
  const { refetch: refetchListing } = useOwnListingQuery(pair.listing.id);

  const { listing: liveListing, product } = pair;

  const refetchPosition = async (): Promise<EditSnapshotValue<Listing> | undefined> => {
    const result = await refetchListing();
    const fresh = result.isSuccess ? toOwnListingPair(result.data)?.listing : undefined;

    return fresh === undefined ? undefined : { record: fresh };
  };

  const handleSectionReloaded = (): void => {
    announce(t('catalogEditor.reloaded'));
    containerRef.current?.focus();
  };

  const position = useEditBaseline<Listing>({
    initial: liveListing,
    onReloaded: handleSectionReloaded,
    refetch: refetchPosition,
  });

  const { accept: acceptPosition, baseline: positionListing } = position;
  const hasUnsavedChanges = isPositionDirty || isPriceDirty;

  const handleBackClick = (): void => {
    console.log('> ListingEditorContent -> handleBackClick:', { hasUnsavedChanges });
    onClose();
  };

  const handlePositionSaved = (saved: Listing): void => {
    console.log('> ListingEditorContent -> handlePositionSaved:', { version: String(saved.version) });
    cache.storeListing(saved);
    acceptPosition(saved);
  };

  const handlePublished = (saved: Listing): void => {
    console.log('> ListingEditorContent -> handlePublished:', { isPublished: saved.isPublished });
    cache.storeListing(saved);
    announce(t(saved.isPublished ? 'catalogEditor.publication.nowPublished' : 'catalogEditor.publication.nowDraft'));

    if (isListingDataEqual(positionListing, saved)) {
      acceptPosition(saved);
    }
  };

  const handlePublicationReload = (): void => {
    console.log('> ListingEditorContent -> handlePublicationReload:', { listingId: liveListing.id });
    setIsPublicationReloading(true);
    void refetchListing().then((result) => {
      setIsPublicationReloading(false);

      if (result.isSuccess) {
        handleSectionReloaded();
      }
    });
  };

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4"
      data-testid="listing-editor"
      ref={containerRef}
      tabIndex={-1}
    >
      <Button
        className="self-start"
        data-testid="listing-editor-back"
        onClick={handleBackClick}
        ref={backRef}
        variant="secondary"
      >
        {t('catalogEditor.back')}
      </Button>
      <h3 className="text-base leading-6 font-semibold text-on-panel" id={titleId}>{t('catalogEditor.title')}</h3>
      <ListingPositionSection
        isReloading={position.isReloading}
        key={`position-${String(position.epoch)}-${String(positionListing.priceUnit?.baseQuantity ?? 0n)}`}
        listing={positionListing}
        onDirtyChange={setIsPositionDirty}
        onReload={position.reload}
        onSaved={handlePositionSaved}
        product={product}
      />
      {canViewPrices && (
        <ListingPriceSection
          listing={positionListing}
          onDirtyChange={setIsPriceDirty}
          onReloaded={handleSectionReloaded}
          product={product}
        />
      )}
      <ListingPublication
        hasUnsavedChanges={hasUnsavedChanges}
        isReloading={isPublicationReloading}
        listing={liveListing}
        onPublished={handlePublished}
        onReload={handlePublicationReload}
      />
    </section>
  );
};
