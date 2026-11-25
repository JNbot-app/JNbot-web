// Dropbox storage for the web version: the desktop's StorageModeService and
// `storage:*` handlers, with the tab standing in for the window and relaunch.
// Import only after src/cli/mocks has installed the electron mock.
import { DROPBOX_APP_KEY, DropboxHttp } from '../../../app/src/main/src/functions/storage/DropboxHttp';
import { FileDropboxCredentialStore, StorageModeService } from '../../../app/src/main/src/functions/storage/StorageModeService';
import { devicePath } from '../../../app/src/main/src/functions/storage/portablePaths';
import { registerStorageHandlers } from '../../../app/src/main/src/functions/storage/storageHandlers';
import type ScriptHandler from '../../../app/src/main/src/functions/ScriptHandler';

/**
 * A Dropbox read failure keeps the backend starting on device data, so the page
 * can show its "Dropbox storage unavailable" screen (Retry / Use Local) from
 * `storage:status` instead of a dead tab.
 */
class WebStorageModeService extends StorageModeService {
  async prepareStartup(): Promise<string | undefined> {
    try {
      return await super.prepareStartup();
    } catch (error) {
      console.error('[jnbot-web] Dropbox storage failed to load', error);
      return undefined;
    }
  }
}

export function createWebStorage(): StorageModeService {
  return new WebStorageModeService(
    // Browsers reject `fetch` called as a method of another object.
    new DropboxHttp(DROPBOX_APP_KEY, (input, init) => fetch(input, init)),
    new FileDropboxCredentialStore(devicePath('dropbox-credentials.json')),
    undefined,
    (status) => (globalThis as any).send?.('storage:write-status', status),
  );
}

export function registerWebStorageHandlers(
  storage: StorageModeService,
  handler: () => ScriptHandler | undefined,
  page: { openUrl(url: string): void; reload(): void },
): void {
  registerStorageHandlers({
    service: () => storage,
    openLogin: (url) => page.openUrl(url),
    closeSession: () => {
      const scripts = handler();
      for (const runtime of scripts?.getRuntimeSummaries() ?? []) {
        const profileId = scripts?.getRuntimeByKey(runtime.profileKey)?.profileId;
        if (profileId !== undefined) scripts?.stopAllScripts(profileId);
      }
      scripts?.settings.close();
    },
    relaunch: () => page.reload(),
  });
}
