export type CommandAccessValue
  = | { permission: string; status: 'denied' }
    | { status: 'allowed' }
    | { status: 'checking' };
