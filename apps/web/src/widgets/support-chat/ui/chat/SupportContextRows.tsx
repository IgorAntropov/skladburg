import type {
  SupportErrorRef,
  SupportTicketContext,
} from '@skladburg/contracts/support/v1/support_ticket';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';

import type { SupportTranslate } from '../../lib/supportTranslate';

import { formatErrorCodeName } from '../../lib/formatErrorCodeName';
import { formatSupportDevice } from '../../lib/supportDevice';

interface SupportContextRowProps {
  children: ReactNode;
  label: string;
}

interface SupportContextRowsProps {
  children?: ReactNode;
  context: SupportTicketContext;
  t: SupportTranslate;
}

const LABEL_CLASS_NAME = 'text-sm text-on-panel-muted';

const VALUE_CLASS_NAME = 'text-sm text-on-panel';

const createErrorKey = ({ code, occurredAt, traceId }: SupportErrorRef): string => (
  [code, occurredAt === undefined ? 0 : timestampMs(occurredAt), traceId].join('-')
);

const SupportContextRow = ({ children, label }: SupportContextRowProps): ReactElement => {
  return (
    <div className="flex flex-col">
      <dt className={LABEL_CLASS_NAME}>{label}</dt>
      <dd className={VALUE_CLASS_NAME}>{children}</dd>
    </div>
  );
};

export const SupportContextRows = ({ children, context, t }: SupportContextRowsProps): ReactElement => {
  const { device, errors } = context;

  return (
    <dl className="flex flex-col gap-2">
      <SupportContextRow label={t('support.preview.screen')}>
        <span className="font-mono" translate="no">{context.screenPath}</span>
      </SupportContextRow>
      <SupportContextRow label={t('support.preview.errors')}>
        {errors.length === 0
          ? <span className="text-on-panel-muted">{t('support.preview.errors.none')}</span>
          : (
              <ul className="flex flex-col gap-1">
                {errors.map(error => (
                  <li key={createErrorKey(error)}>
                    <span className="font-mono" translate="no">{formatErrorCodeName(error.code)}</span>
                    {error.traceId !== '' && (
                      <span className="block font-mono text-xs break-all text-on-panel-muted" translate="no">
                        {t('support.preview.errors.traceId', { traceId: error.traceId })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
      </SupportContextRow>
      <SupportContextRow label={t('support.preview.version')}>
        <span className="font-mono" translate="no">{context.appVersion}</span>
      </SupportContextRow>
      <SupportContextRow label={t('support.preview.device')}>
        {device === undefined ? t('support.device.unknown') : formatSupportDevice(t, device)}
      </SupportContextRow>
      {children}
    </dl>
  );
};

export { SupportContextRow };
