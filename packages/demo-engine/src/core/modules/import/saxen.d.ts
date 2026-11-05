declare module 'saxen' {
  export class Parser {
    on(
      event: 'openTag',
      handler: (name: string, attributes: () => Record<string, string>, decode: (text: string) => string, isClosed: boolean) => void,
    ): void;
    on(event: 'closeTag', handler: (name: string) => void): void;
    on(event: 'attention' | 'cdata' | 'question' | 'text', handler: (text: string) => void): void;
    on(event: 'error' | 'warn', handler: (error: Error) => void): void;
    parse(xml: string): void;
  }
}
