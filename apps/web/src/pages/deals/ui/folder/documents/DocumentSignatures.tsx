import type { DocumentSignature } from '@skladburg/contracts/document/v1/document';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import { Stamp } from 'lucide-react';

import { useI18n } from '@/shared/i18n';

import type { DealDocumentTranslate } from './documentSection';

interface DocumentSignaturesProps {
  signatures: readonly DocumentSignature[];
  t: DealDocumentTranslate;
}

export const DocumentSignatures = ({ signatures, t }: DocumentSignaturesProps): ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h4 className="font-semibold">{t('dealDocument.signatures')}</h4>
      <ul className="flex flex-col gap-2">
        {signatures.map((signature) => {
          const side = signature.side === ProfileKind.SUPPLIER ? t('dealDocument.supplier') : t('dealDocument.customer');
          const signedAt = signature.signedAt === undefined
            ? undefined
            : formatDateTime(timestampMs(signature.signedAt), {
                format: { dateStyle: 'short', timeStyle: 'short' },
                timeZone: userTimeZone,
              });

          return (
            <li
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-line p-3 text-sm"
              data-testid="deal-document-signature"
              key={signature.organizationId}
            >
              <p className="flex items-center gap-2 font-semibold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-status-ok text-on-status-ok">
                  <Stamp aria-hidden className="size-4" />
                </span>
                {t('dealDocument.signature')}
              </p>
              <div className="flex flex-col gap-0.5 wrap-anywhere">
                <p className="font-medium">{signature.signerDisplayName || t('dealDocument.notSpecified')}</p>
                <p className="text-on-panel-muted">{side}</p>
                {signature.signerRoleName !== '' && <p className="text-on-panel-muted">{signature.signerRoleName}</p>}
                {signedAt !== undefined && <p className="text-on-panel-muted">{signedAt}</p>}
              </div>
              {signature.contentSha256 !== '' && (
                <dl className="flex flex-col gap-1 text-on-panel-muted">
                  <dt>{t('dealDocument.hash')}</dt>
                  <dd className="font-mono text-xs wrap-anywhere" translate="no">{signature.contentSha256}</dd>
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
