import type { Money } from '@skladburg/contracts/common/v1/money';
import type { TransportOffer } from '@skladburg/contracts/logistics/v1/logistics_records';
import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  Check,
  Minus,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useOrganizationApprovalAccess } from '@/entities/session';
import { useTransportOffers } from '@/entities/transport';
import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import {
  AccessButton,
  ActionButton,
  Button,
  CommandErrorNotice,
  useAnnounce,
} from '@/shared/ui';

import type { TransportTranslate } from '../i18n/transportSection';

import { useRefreshOnVersionConflict } from '../api/useRefreshOnVersionConflict';
import {
  transportMethods,
  useSelectTransportOffer,
} from '../api/useTransportWorkspaceCommands';
import { TransportData } from './TransportData';

interface OfferCandidateProps extends TransportRequestOffersProps {
  amount: Money;
  isCompatible: boolean;
  number: number;
  offer: TransportOffer;
}

interface TransportRequestOffersProps {
  onRefresh: () => Promise<void>;
  onStatusFocus: () => void;
  requestId: string;
  t: TransportTranslate;
  version: number;
}

const OfferCandidate = ({
  amount,
  isCompatible,
  number,
  offer,
  onRefresh,
  onStatusFocus,
  requestId,
  t,
  version,
}: OfferCandidateProps): ReactElement => {
  const { locale } = useI18n();
  const announce = useAnnounce();
  const { access, limit } = useOrganizationApprovalAccess(
    transportMethods.selectTransportOffer,
    amount,
    'transport_offer_approve',
  );
  const candidateRef = useRef<HTMLLIElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const [reviewedVersion, setReviewedVersion] = useState<number | undefined>(undefined);

  const handleSaved = (): void => {
    announce(t('transport.offers.selectionSaved'));
    if (candidateRef.current?.contains(document.activeElement) === true) {
      onStatusFocus();
    }
    void onRefresh();
  };
  const command = useSelectTransportOffer({
    amount,
    expectedVersion: reviewedVersion ?? version,
    offerId: offer.id,
    requestId,
  }, handleSaved);

  const isOpen = reviewedVersion !== undefined;
  const isConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isReviewNeeded = reviewedVersion !== version;
  const isUnavailable = !isCompatible || limit !== undefined;
  const displayAmount = formatMoney(locale, amount);
  const StatusIcon = isCompatible ? Check : Minus;

  const handleOpen = (): void => {
    command.reset();
    setReviewedVersion(version);
  };

  const handleCancel = (): void => {
    command.reset();
    setReviewedVersion(undefined);
    requestAnimationFrame(() => openRef.current?.focus());
  };

  const handleRefresh = (): void => {
    void onRefresh();
  };

  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
    }
  }, [isOpen]);

  useRefreshOnVersionConflict(command, onRefresh);

  return (
    <li className="flex flex-col gap-2 rounded-control border border-line p-3" ref={candidateRef}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">{t('transport.offers.candidate', { number })}</p>
        <p className="font-semibold tabular-nums">{displayAmount}</p>
      </div>
      <p className="inline-flex items-center gap-1.5 text-sm text-on-panel-muted">
        <StatusIcon aria-hidden className="size-4 shrink-0" />
        {t(isCompatible ? 'transport.offers.compatible' : 'transport.offers.incompatible')}
      </p>
      {limit !== undefined && (
        <p className="text-sm text-on-panel-muted">
          {t('transport.offers.limit', { amount: displayAmount, limit: formatMoney(locale, limit) })}
        </p>
      )}
      {isOpen
        ? (
            <section className="flex flex-col gap-2 border-t border-line pt-2">
              <h4 className="font-semibold" ref={confirmRef} tabIndex={-1}>{t('transport.offers.selectTitle')}</h4>
              <p>{t('transport.offers.selectDescription', { amount: displayAmount })}</p>
              {(isReviewNeeded || isConflict) && (
                <div className="flex flex-col items-start gap-2">
                  <p role="status">{t('transport.form.conflict')}</p>
                  <Button onClick={isReviewNeeded ? handleOpen : handleRefresh} variant="secondary">
                    {t(isReviewNeeded ? 'transport.form.review' : 'transport.form.refresh')}
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <ActionButton
                  access={access}
                  command={command}
                  data-testid="transport-offer-select-submit"
                  errorPlacement="external"
                  isDisabled={isUnavailable || isConflict || isReviewNeeded}
                >
                  {t('transport.offers.selectSubmit')}
                </ActionButton>
                <Button aria-disabled={command.isPending} onClick={handleCancel} variant="secondary">{t('transport.form.cancel')}</Button>
              </div>
              <CommandErrorNotice command={command} />
            </section>
          )
        : (
            <AccessButton
              access={access}
              data-testid="transport-offer-select-open"
              isDisabled={isUnavailable}
              onClick={handleOpen}
              ref={openRef}
              variant="secondary"
            >
              {t('transport.offers.select')}
            </AccessButton>
          )}
    </li>
  );
};

export const TransportRequestOffers = (props: TransportRequestOffersProps): ReactElement => {
  const { requestId, t } = props;
  const query = useTransportOffers(requestId, true);

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="font-semibold text-on-panel">{t('transport.offers.title')}</h3>
      <TransportData emptyLabel={t('transport.offers.empty')} isEmpty={candidates => candidates.length === 0} query={query} t={t}>
        {candidates => (
          <ul className="flex min-w-0 flex-col gap-2">
            {candidates.flatMap(({ isCompatible, offer }, index) => offer?.amount === undefined
              ? []
              : (
                  <OfferCandidate
                    {...props}
                    amount={offer.amount}
                    isCompatible={isCompatible}
                    key={offer.id}
                    number={index + 1}
                    offer={offer}
                  />
                ))}
          </ul>
        )}
      </TransportData>
    </section>
  );
};
