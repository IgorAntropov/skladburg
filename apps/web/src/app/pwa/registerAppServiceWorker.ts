import type { IAppUpdateStore } from './appUpdateTypes';

export const registerAppServiceWorker = async (store: IAppUpdateStore): Promise<void> => {
  if (!import.meta.env.PROD) {
    return;
  }

  try {
    const { registerSW } = await import('virtual:pwa-register');

    store.connect(registerSW);
  }
  catch (error) {
    console.log('> registerAppServiceWorker -> import:', { error });
  }
};
