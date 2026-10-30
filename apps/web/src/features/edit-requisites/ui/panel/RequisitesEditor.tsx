import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';
import type { ReactElement } from 'react';

import {
  useRef,
  useState,
} from 'react';

import { useAnnounce } from '@/shared/ui';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';

import { useRequisitesQuery } from '../../api/useRequisitesQuery';
import { RequisitesForm } from './RequisitesForm';

export interface RequisitesEditorProps {
  requisites: OrganizationRequisites;
  t: RequisitesTranslate;
}

interface EditorSnapshotValue {
  epoch: number;
  requisites: OrganizationRequisites;
}

export const RequisitesEditor = ({ requisites, t }: RequisitesEditorProps): ReactElement => {
  const { refetch } = useRequisitesQuery();
  const announce = useAnnounce();
  const containerRef = useRef<HTMLDivElement>(null);

  const [snapshot, setSnapshot] = useState<EditorSnapshotValue>({ epoch: 0, requisites });
  const [isReloading, setIsReloading] = useState(false);

  const handleSaved = (saved: OrganizationRequisites): void => {
    console.log('> RequisitesEditor -> handleSaved:', { version: String(saved.version) });
    setSnapshot(current => ({ ...current, requisites: saved }));
  };

  const handleReload = (): void => {
    console.log('> RequisitesEditor -> handleReload:', { version: String(snapshot.requisites.version) });
    setIsReloading(true);
    void refetch().then((result) => {
      setIsReloading(false);

      if (!result.isSuccess) {
        return;
      }

      setSnapshot(current => ({ epoch: current.epoch + 1, requisites: result.data }));
      announce(t('requisites.reloaded'));
      containerRef.current?.focus();
    });
  };

  return (
    <div ref={containerRef} tabIndex={-1}>
      <RequisitesForm
        isReloading={isReloading}
        key={snapshot.epoch}
        onReload={handleReload}
        onSaved={handleSaved}
        requisites={snapshot.requisites}
        t={t}
      />
    </div>
  );
};
