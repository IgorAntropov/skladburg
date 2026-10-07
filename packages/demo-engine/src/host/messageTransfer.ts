import type { EngineHostMessageValue } from '../protocol/index';

export const readMessageTransfer = (message: EngineHostMessageValue): ArrayBuffer[] => {
  switch (message.type) {
    case 'events':
      return message.events;
    case 'response':
      return [message.body];
    case 'subscription_denied':
      return [message.detail];
    default:
      return [];
  }
};
