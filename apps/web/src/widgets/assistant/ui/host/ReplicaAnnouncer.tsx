import type { ReactElement } from 'react';

export interface ReplicaAnnouncerProps {
  assertiveText: string;
  politeText: string;
}

export const ReplicaAnnouncer = ({ assertiveText, politeText }: ReplicaAnnouncerProps): ReactElement => {
  return (
    <>
      <div aria-atomic="true" aria-live="polite" className="sr-only" data-testid="assistant-announcer" role="status">
        {politeText}
      </div>
      <div aria-atomic="true" aria-live="assertive" className="sr-only" role="alert">
        {assertiveText}
      </div>
    </>
  );
};
