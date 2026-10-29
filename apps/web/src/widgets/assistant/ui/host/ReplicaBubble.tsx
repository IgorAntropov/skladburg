import type { ReactElement } from 'react';

import {
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
} from 'react';

import { AssistantPortrait } from '@/entities/assistant';
import { cn } from '@/shared/lib/cn';
import { useViewportClass } from '@/shared/lib/viewport';
import { IconButton } from '@/shared/ui';

import type {
  AssistantTranslate,
  ReplicaTextValue,
} from '../../lib/formatReplicaText';
import type {
  ReplicaCenterTabValue,
  ReplicaValue,
} from '../../model/replicaTypes';

import { ReplicaLinks } from './ReplicaLinks';
import { useReplicaHold } from './useReplicaHold';

export interface ReplicaBubbleProps {
  assistantName: string;
  onClose: () => void;
  onHold: () => void;
  onOpenCenter: (tab: ReplicaCenterTabValue) => void;
  onRelease: () => void;
  replica: ReplicaValue;
  t: AssistantTranslate;
  text: ReplicaTextValue;
}

const NO_NOTIFICATION_IDS: readonly string[] = [];

const BUBBLE_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 flex w-90 flex-col rounded-panel border bg-panel-solid px-3 pt-3 pb-1 text-on-panel shadow-raised',
  'origin-top-right [--menu-in-y:-0.25rem] motion-safe:animate-menu-in',
  'max-sm:right-3 max-sm:left-3 max-sm:max-h-[max(calc(30dvh_-_76px),6.25rem)] max-sm:w-auto max-sm:origin-top',
].join(' ');

const SCROLL_AREA_CLASS_NAME = [
  'flex items-start gap-3',
  'max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:rounded-control',
  'max-sm:focus-visible:outline-2 max-sm:focus-visible:outline-offset-2 max-sm:focus-visible:outline-focus',
].join(' ');

const TAIL_CLASS_NAME = 'absolute -top-[5px] right-4 size-3 rotate-45 rounded-tl-xs border-t border-l bg-panel-solid max-sm:hidden';

const CRITICAL_BADGE_CLASS_NAME = [
  'absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full',
  'bg-status-alarm text-on-status-alarm ring-2 ring-panel-solid',
].join(' ');

const focusAnchor = (bubble: HTMLElement | null): void => {
  const anchor = bubble?.parentElement?.querySelector('button');

  if (bubble?.contains(document.activeElement) === true) {
    anchor?.focus();
  }
};

const ReplicaContent = ({ text }: { text: ReplicaTextValue }): ReactElement => {
  if (text.kind === 'list') {
    return (
      <>
        <p className="font-semibold">{text.greeting}</p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {text.items.map(item => (
            <li className="flex items-start gap-2" key={item}>
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-on-panel-muted" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      {text.paragraphs.map((paragraph, index) => {
        const paragraphClassName = index === 0 ? undefined : 'mt-1 text-on-panel-muted';

        return <p className={paragraphClassName} key={paragraph}>{paragraph}</p>;
      })}
    </>
  );
};

export const ReplicaBubble = ({
  assistantName,
  onClose,
  onHold,
  onOpenCenter,
  onRelease,
  replica,
  t,
  text,
}: ReplicaBubbleProps): ReactElement => {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const holdHandlers = useReplicaHold({ onHold, onRelease });
  const textId = useId();
  const isPhone = useViewportClass() === 'phone';

  const isCritical = replica.importance === 'critical';
  const borderClassName = isCritical ? 'border-status-alarm' : 'border-line';
  const scrollAreaProps = isPhone ? { 'aria-labelledby': textId, 'role': 'group', 'tabIndex': 0 } : undefined;
  const notificationIds = replica.body.kind === 'notification' ? [replica.body.notification.id] : NO_NOTIFICATION_IDS;

  const handleCloseClick = (): void => {
    console.log('> ReplicaBubble -> handleCloseClick:', { replicaId: replica.id });
    focusAnchor(bubbleRef.current);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const scope = bubbleRef.current?.parentElement;

      if (event.key !== 'Escape' || event.defaultPrevented || !(event.target instanceof Node) || !scope?.contains(event.target)) {
        return;
      }

      console.log('> ReplicaBubble -> handleEscape:', { replicaId: replica.id });
      focusAnchor(bubbleRef.current);
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);

    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, replica.id]);

  return (
    <div
      {...holdHandlers}
      aria-label={t('assistant.bubble.label', { assistantName })}
      className={cn(BUBBLE_CLASS_NAME, borderClassName)}
      data-importance={replica.importance}
      data-kind={replica.body.kind}
      data-testid="assistant-replica"
      ref={bubbleRef}
      role="group"
    >
      <span aria-hidden className={cn(TAIL_CLASS_NAME, borderClassName)} />
      <div {...scrollAreaProps} className={SCROLL_AREA_CLASS_NAME} data-testid="assistant-replica-scroll">
        <span className="relative shrink-0">
          <AssistantPortrait size="sm" />
          {isCritical && (
            <span aria-hidden className={CRITICAL_BADGE_CLASS_NAME}>
              <TriangleAlert className="size-3.5" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 text-sm leading-5 text-pretty" id={textId}>
          <ReplicaContent text={text} />
        </div>
      </div>
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-2">
        <ReplicaLinks
          notificationIds={notificationIds}
          onNavigate={onClose}
          onOpenCenter={onOpenCenter}
          replica={replica}
          t={t}
        />
        <IconButton
          className="-mr-2"
          data-testid="assistant-replica-close"
          icon={<X className="size-5 text-on-panel-muted" />}
          label={t('assistant.bubble.close')}
          onClick={handleCloseClick}
          variant="ghost"
        />
      </div>
    </div>
  );
};
