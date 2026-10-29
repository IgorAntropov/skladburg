import type { QueryClient } from '@tanstack/react-query';

import type { IActingContextStore } from '../context/actingContextTypes';
import type { IErrorJournal } from '../errors/errorJournal';
import type { IDemoControl } from '../transport/demo';

import { selectInitialPersona } from '../runtime/selectInitialPersona';
import { replaceActingContext } from './replaceActingContext';

export interface ReturnToDefaultPersonaOnDemoResetOptionsValue {
  actingContext: IActingContextStore;
  defaultOrganizationId: string;
  demoControl: IDemoControl | undefined;
  errorJournal: IErrorJournal;
  queryClient: QueryClient;
}

const stopNothing = (): void => undefined;

export const returnToDefaultPersonaOnDemoReset = (
  options: ReturnToDefaultPersonaOnDemoResetOptionsValue,
): () => void => {
  const {
    actingContext,
    defaultOrganizationId,
    demoControl,
    errorJournal,
    queryClient,
  } = options;

  if (demoControl === undefined) {
    return stopNothing;
  }

  let isStopped = false;
  let latestResetNumber = 0;
  let running: Promise<void> = Promise.resolve();

  const returnToDefaultPersona = async (resetNumber: number, epoch: string): Promise<void> => {
    const isOutdated = (): boolean => isStopped || resetNumber !== latestResetNumber;

    if (isOutdated()) {
      return;
    }

    try {
      const personas = await demoControl.listPersonas();

      if (isOutdated()) {
        return;
      }

      const defaultPersona = selectInitialPersona(personas, {
        defaultOrganizationId,
        preferredContext: undefined,
        preferredPersonaId: undefined,
      });

      if (defaultPersona === undefined) {
        console.warn('> returnToDefaultPersonaOnDemoReset -> selectInitialPersona:', { defaultOrganizationId, epoch });

        return;
      }

      const current = actingContext.get();
      const isDefaultPersona = defaultPersona.organizationId === current.organizationId
        && defaultPersona.userId === current.userId;

      if (isDefaultPersona) {
        return;
      }

      const context = { organizationId: defaultPersona.organizationId, userId: defaultPersona.userId };

      console.log('> returnToDefaultPersonaOnDemoReset -> replaceActingContext:', { epoch, from: current, to: context });

      await replaceActingContext({
        actingContext,
        context,
        errorJournal,
        queryClient,
      });
    }
    catch (error) {
      console.error('> returnToDefaultPersonaOnDemoReset -> returnToDefaultPersona:', { epoch, error });
    }
  };

  const unsubscribeFromReset = demoControl.onReset((epoch) => {
    latestResetNumber += 1;

    const resetNumber = latestResetNumber;

    running = running.then(() => returnToDefaultPersona(resetNumber, epoch));
  });

  return () => {
    if (isStopped) {
      return;
    }

    isStopped = true;
    unsubscribeFromReset();
  };
};
