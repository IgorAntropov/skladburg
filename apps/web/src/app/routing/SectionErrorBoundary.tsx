import type {
  ErrorInfo,
  ReactNode,
} from 'react';

import { Component } from 'react';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  override state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('> SectionErrorBoundary -> componentDidCatch:', { componentStack: info.componentStack, error });
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
