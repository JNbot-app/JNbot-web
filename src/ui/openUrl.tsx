import { Button } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';

const KEY = 'open-url';

/**
 * Opens a page the backend asked for (the Dropbox sign-in) in a new tab. The
 * request arrives a moment after the click, so a popup blocker may refuse it;
 * then a notification offers a link the user can click themselves.
 */
export function openUrl(url: string, notification?: NotificationInstance) {
  const opened = window.open(url, '_blank');
  if (opened) {
    opened.opener = null;
    return;
  }
  notification?.info({
    key: KEY,
    title: 'Your browser blocked a new tab',
    description: 'Open it to continue signing in.',
    placement: 'bottomRight',
    duration: 0,
    actions: (
      <Button
        type="primary"
        size="small"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => notification.destroy(KEY)}
      >
        Open
      </Button>
    ),
  });
}
