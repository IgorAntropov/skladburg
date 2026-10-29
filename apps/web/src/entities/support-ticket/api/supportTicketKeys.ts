interface SupportTicketKeysValue {
  all: readonly ['support-ticket'];
  detail: (organizationScope: string, ticketId: string) => readonly ['support-ticket', 'detail', string, string];
  mine: (organizationScope: string) => readonly ['support-ticket', 'mine', string];
}

export const supportTicketKeys: SupportTicketKeysValue = {
  all: ['support-ticket'],
  detail: (organizationScope, ticketId) => ['support-ticket', 'detail', organizationScope, ticketId],
  mine: organizationScope => ['support-ticket', 'mine', organizationScope],
};
