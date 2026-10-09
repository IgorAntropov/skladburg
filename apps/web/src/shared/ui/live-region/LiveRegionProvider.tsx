import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useCallback,
  useState,
} from 'react';

import type { AnnounceFunction } from './LiveRegionContext';

import { LiveRegionContext } from './LiveRegionContext';

interface AnnouncementValue {
  message: string;
  sequence: number;
}

const INITIAL_ANNOUNCEMENT: AnnouncementValue = { message: '', sequence: 0 };

export const LiveRegionProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [announcement, setAnnouncement] = useState<AnnouncementValue>(INITIAL_ANNOUNCEMENT);

  const announce = useCallback<AnnounceFunction>((message) => {
    console.log('> LiveRegionProvider -> announce:', { message });
    setAnnouncement(current => ({ message, sequence: current.sequence + 1 }));
  }, []);

  return (
    <LiveRegionContext value={announce}>
      {children}
      <div aria-live="polite" className="sr-only" role="status">
        <span key={announcement.sequence}>{announcement.message}</span>
      </div>
    </LiveRegionContext>
  );
};
