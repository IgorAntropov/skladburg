import type { Document } from '@skladburg/contracts/document/v1/document';
import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useRef,
} from 'react';

import {
  getSignDealDocumentMethod,
  useSignDealDocument,
} from '@/entities/document';
import { useCommandAccess } from '@/entities/session';
import {
  ActionButton,
  Button,
} from '@/shared/ui';

import type { DealDocumentTranslate } from './documentSection';

interface SignDealDocumentButtonProps {
  dealId: string;
  document: Document;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRefreshDocument: () => Promise<boolean>;
  onRequestHeadingFocus: () => void;
  t: DealDocumentTranslate;
}

export const SignDealDocumentButton = ({
  dealId,
  document: currentDocument,
  isRefreshing,
  onRefresh,
  onRefreshDocument,
  onRequestHeadingFocus,
  t,
}: SignDealDocumentButtonProps): ReactElement => {
  const access = useCommandAccess(getSignDealDocumentMethod(currentDocument.type), { kind: 'organization' });
  const actionRef = useRef<HTMLDivElement>(null);
  const seenError = useRef<Error | null>(null);

  const handleConfirmed = (): boolean => {
    if (actionRef.current === null) {
      return false;
    }

    if (actionRef.current.contains(document.activeElement)) {
      onRequestHeadingFocus();
    }

    onRefresh();
    return true;
  };

  const command = useSignDealDocument({ dealId, document: currentDocument, onConfirmed: handleConfirmed });
  const { apiError, error, reset } = command;
  const isConflict = apiError?.code === ErrorCode.VERSION_CONFLICT;

  const handleRefreshDocument = (): void => {
    void onRefreshDocument().then((isRefreshed) => {
      if (isRefreshed) {
        reset();
      }
    });
    onRefresh();
  };

  useEffect(() => {
    if (error === null || seenError.current === error || apiError?.isRetryable === true) {
      return;
    }

    seenError.current = error;
    void onRefreshDocument();
    onRefresh();
  }, [apiError, error, onRefresh, onRefreshDocument]);

  return (
    <div className="flex flex-col items-start gap-2" ref={actionRef}>
      <ActionButton
        access={access}
        command={command}
        data-testid="deal-document-sign"
        isDisabled={isConflict}
        pendingLabel={t('dealDocument.signing')}
      >
        {t('dealDocument.sign')}
      </ActionButton>
      {isConflict && (
        <Button onClick={handleRefreshDocument} pending={isRefreshing} variant="secondary">
          {t('dealDocument.conflictRefresh')}
        </Button>
      )}
    </div>
  );
};
