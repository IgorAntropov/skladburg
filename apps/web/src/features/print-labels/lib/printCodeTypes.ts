export interface EncodedPrintCodeValue {
  height: number;
  svg: string;
  width: number;
}

export type PrintCodeKindValue = 'address' | 'qr' | 'sscc';

export type PrintCodeResponseValue
  = | { codes: EncodedPrintCodeValue[]; kind: 'ready' }
    | { kind: 'failed' };

export interface PrintCodeValue {
  kind: PrintCodeKindValue;
  text: string;
}
