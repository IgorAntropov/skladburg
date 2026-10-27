import type { AppUpdateStateValue } from './appUpdateTypes';

export const isAppUpdateNoticeVisible = (state: AppUpdateStateValue): boolean => {
  return state === 'ready' || state === 'applying' || state === 'reloadRequired';
};

export const getAppUpdateMessageKey = (state: AppUpdateStateValue): 'app.update.ready' | 'app.update.reloadRequired' => {
  return state === 'reloadRequired' ? 'app.update.reloadRequired' : 'app.update.ready';
};
