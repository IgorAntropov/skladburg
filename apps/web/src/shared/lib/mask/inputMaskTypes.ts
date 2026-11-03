export interface InputMaskValue {
  attach: (input: HTMLInputElement) => () => void;
  inputMode: 'decimal' | 'numeric' | 'text';
  refresh: (input: HTMLInputElement) => void;
  template: string;
  unmask: (value: string) => string;
}
