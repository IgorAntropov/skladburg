import type {
  ErrorInfo,
  ReactNode,
} from 'react';

import { Component } from 'react';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  resetKey: string;
}

interface SectionErrorBoundaryState {
  error: Error | undefined;
  resetKey: string;
}

const toError = (thrown: unknown): Error => (thrown instanceof Error ? thrown : new Error(String(thrown)));

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  override state: SectionErrorBoundaryState = { error: undefined, resetKey: this.props.resetKey };

  static getDerivedStateFromError(thrown: unknown): Pick<SectionErrorBoundaryState, 'error'> {
    return { error: toError(thrown) };
  }

  static getDerivedStateFromProps(
    props: SectionErrorBoundaryProps,
    state: SectionErrorBoundaryState,
  ): null | SectionErrorBoundaryState {
    if (props.resetKey === state.resetKey) {
      return null;
    }

    return { error: undefined, resetKey: props.resetKey };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('> SectionErrorBoundary -> componentDidCatch:', { componentStack: info.componentStack, error });
  }

  override render(): ReactNode {
    const { error } = this.state;

    return error === undefined ? this.props.children : this.props.fallback(error, this.handleReset);
  }

  private readonly handleReset = (): void => {
    console.log('> SectionErrorBoundary -> handleReset:', { error: this.state.error?.name });
    this.setState({ error: undefined });
  };
}
