import type { ReactElement } from 'react';

import {
  useEffect,
  useId,
  useRef,
} from 'react';

import { Button } from '../button/Button';

export interface LeaveConfirmProps {
  'data-testid': string;
  'leaveLabel': string;
  'message': string;
  'onLeave': () => void;
  'onStay': () => void;
  'stayLabel': string;
}

export const LeaveConfirm = ({
  'data-testid': testId,
  leaveLabel,
  message,
  onLeave,
  onStay,
  stayLabel,
}: LeaveConfirmProps): ReactElement => {
  const messageId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLeaveClick = (): void => {
    console.log('> LeaveConfirm -> handleLeaveClick:', { testId });
    onLeave();
  };

  const handleStayClick = (): void => {
    console.log('> LeaveConfirm -> handleStayClick:', { testId });
    onStay();
  };

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      aria-labelledby={messageId}
      className="flex flex-col items-start gap-3 rounded-control border border-line-strong p-3"
      data-testid={testId}
      ref={containerRef}
      role="group"
      tabIndex={-1}
    >
      <p className="text-base leading-6 text-on-panel" id={messageId}>{message}</p>
      <div className="flex flex-wrap gap-2">
        <Button data-testid={`${testId}-leave`} onClick={handleLeaveClick} variant="primary">
          {leaveLabel}
        </Button>
        <Button data-testid={`${testId}-stay`} onClick={handleStayClick} variant="secondary">
          {stayLabel}
        </Button>
      </div>
    </div>
  );
};
