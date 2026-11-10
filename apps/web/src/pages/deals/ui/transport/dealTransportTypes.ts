export type DealTransportProps
  = | { dealId: string; kind: 'request' | 'trip' }
    | { kind: 'publish'; onOpen: () => void };
