import type {
  ReactElement,
  ReactNode,
} from 'react';

interface TransportPropertyProps {
  children: ReactNode;
  label: string;
}

export const TransportProperty = ({ children, label }: TransportPropertyProps): ReactElement => (
  <div className="min-w-0">
    <dt className="text-sm text-on-panel-muted">{label}</dt>
    <dd className="wrap-break-word text-on-panel">{children}</dd>
  </div>
);
