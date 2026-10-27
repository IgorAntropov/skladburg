import type { ReactElement } from 'react';

import {
  useCallback,
  useEffect,
} from 'react';

import { useAssistantName } from '@/entities/assistant';
import { useAssistantQuietMode } from '@/features/assistant-quiet-mode';

import {
  formatReplicaText,
  getReplicaAnnouncement,
} from '../../lib/formatReplicaText';
import { useAssistantTexts } from '../../model/useAssistantTexts';
import { useDigestReplica } from '../../model/useDigestReplica';
import { useErrorReplicas } from '../../model/useErrorReplicas';
import { usePostedReplicas } from '../../model/usePostedReplicas';
import { useReplicaQueue } from '../../model/useReplicaQueue';
import { useSessionEpoch } from '../../model/useSessionEpoch';
import { ReplicaAnnouncer } from './ReplicaAnnouncer';
import { ReplicaBubble } from './ReplicaBubble';

export interface AssistantHostProps {
  isPanelOpen: boolean;
  onOpenCenter: () => void;
}

export const AssistantHost = ({ isPanelOpen, onOpenCenter }: AssistantHostProps): ReactElement => {
  const assistantName = useAssistantName();
  const { isQuiet } = useAssistantQuietMode();
  const epoch = useSessionEpoch();
  const { isReady, t } = useAssistantTexts();
  const { current, dispatch } = useReplicaQueue(epoch.count);

  useDigestReplica({ dispatch, epoch, isQuiet, isReady });
  usePostedReplicas({ dispatch, epochCount: epoch.count, isQuiet, isReady });
  useErrorReplicas({ dispatch, isQuiet, isReady });

  const replica = current?.replica;
  const text = t === undefined || replica === undefined ? undefined : formatReplicaText(t, replica);
  const announcement = text === undefined ? '' : getReplicaAnnouncement(text);
  const isCritical = replica?.importance === 'critical';
  const assertiveText = isCritical ? announcement : '';
  const politeText = isCritical ? '' : announcement;
  const isBubbleShown = replica !== undefined && t !== undefined && text !== undefined;

  const handleClose = useCallback((): void => {
    dispatch({ kind: 'dismiss' });
  }, [dispatch]);

  const handleHold = useCallback((): void => {
    dispatch({ kind: 'hold' });
  }, [dispatch]);

  const handleRelease = useCallback((): void => {
    dispatch({ kind: 'release' });
  }, [dispatch]);

  const handleOpenCenter = (): void => {
    console.log('> AssistantHost -> handleOpenCenter:', { replicaId: replica?.id });
    dispatch({ kind: 'dismiss' });
    onOpenCenter();
  };

  useEffect(() => {
    dispatch({ isSuspended: isPanelOpen, kind: 'suspend' });
  }, [dispatch, isPanelOpen]);

  useEffect(() => {
    dispatch({ isQuiet, kind: 'quiet' });
  }, [dispatch, isQuiet]);

  return (
    <>
      <ReplicaAnnouncer assertiveText={assertiveText} politeText={politeText} />
      {isBubbleShown && (
        <ReplicaBubble
          assistantName={assistantName}
          key={replica.id}
          onClose={handleClose}
          onHold={handleHold}
          onOpenCenter={handleOpenCenter}
          onRelease={handleRelease}
          replica={replica}
          t={t}
          text={text}
        />
      )}
    </>
  );
};
