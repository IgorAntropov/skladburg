import type {
  ReactElement,
  ReactNode,
} from 'react';

interface InspectorPropertyProps {
  children: ReactNode;
  label: string;
}

export const InspectorProperty = ({ children, label }: InspectorPropertyProps): ReactElement => (
  <div>
    <dt className="text-sm leading-5 text-on-panel-muted">{label}</dt>
    <dd className="text-base leading-6 text-pretty wrap-break-word text-on-panel">{children}</dd>
  </div>
);
