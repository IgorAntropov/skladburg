import type {
  ErrorInfo,
  ReactNode,
} from 'react';

import { Component } from 'react';

interface AppUpdateNoticeBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface AppUpdateNoticeBoundaryState {
  hasError: boolean;
}

export class AppUpdateNoticeBoundary extends Component<AppUpdateNoticeBoundaryProps, AppUpdateNoticeBoundaryState> {
  override state: AppUpdateNoticeBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppUpdateNoticeBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('> AppUpdateNoticeBoundary -> componentDidCatch:', { componentStack: info.componentStack, error });
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
