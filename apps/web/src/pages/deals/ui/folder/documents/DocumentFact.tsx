import type { ReactElement } from 'react';

interface DocumentFactProps {
  label: string;
  value: string | undefined;
}

export const DocumentFact = ({ label, value }: DocumentFactProps): null | ReactElement => {
  if (value === undefined || value === '') {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-between gap-x-3 wrap-anywhere">
      <dt className="text-on-panel-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
};
