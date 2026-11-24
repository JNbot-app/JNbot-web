import { Button } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';

const DOWNLOAD_URL = 'https://github.com/usserwout/JNbot-updater/releases/latest';
const DISMISSED_KEY = 'jnbot-web:desktop-hint-dismissed';
const KEY = 'desktop-hint';

function dismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Without storage the hint simply shows again next visit.
  }
}

/** Points web users to the desktop app once; closing it hides it for good. */
export function showDesktopHint(notification: NotificationInstance) {
  if (dismissed()) return;
  notification.info({
    key: KEY,
    title: 'JNbot is also a desktop app',
    description: 'Bots keep running when this tab is closed, with every feature available.',
    placement: 'bottomRight',
    duration: 0,
    onClose: dismiss,
    actions: (
      <Button
        type="primary"
        size="small"
        href={DOWNLOAD_URL}
        target="_blank"
        onClick={() => {
          dismiss();
          notification.destroy(KEY);
        }}
      >
        Download
      </Button>
    ),
  });
}
