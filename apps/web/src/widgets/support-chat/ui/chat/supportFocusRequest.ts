export type SupportFocusRequestValue
  = | { kind: 'call' }
    | { kind: 'ticket'; ticketId: string };
