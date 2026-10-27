import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import type { ResolvedNotificationLinkValue } from '@/entities/notification';

import type { AssistantErrorHintKey } from '../lib/getErrorHintKey';

export type DigestLineKey
  = | 'assistant.digest.ownWarehouses'
    | 'assistant.digest.unread'
    | 'assistant.digest.verifiedCarriers'
    | 'assistant.digest.verifiedCustomers'
    | 'assistant.digest.verifiedPartners'
    | 'assistant.digest.verifiedSuppliers';

export type DigestLineValue
  = | { count: number; key: DigestLineKey; kind: 'count' }
    | { kind: 'nextLevel'; nextLevel: number };

export type ReplicaBodyValue
  = | { count: number; kind: 'more' }
    | { hintKey: AssistantErrorHintKey; kind: 'error'; reason: string }
    | { kind: 'digest'; lines: readonly DigestLineValue[] }
    | { kind: 'notification'; notification: Notification };

export type ReplicaImportanceValue = 'critical' | 'important' | 'normal';

export interface ReplicaValue {
  body: ReplicaBodyValue;
  hasCenterLink: boolean;
  id: string;
  importance: ReplicaImportanceValue;
  links: readonly ResolvedNotificationLinkValue[];
}
