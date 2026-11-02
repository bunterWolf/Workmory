// Live "App · Window title" for the running timeline block.
// Re-queries the main process on mount and on every heartbeat; never reloads day data.
import { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';
import formatActivityTitle from './formatActivityTitle';

export default function useCurrentActivity(enabled) {
  const [title, setTitle] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setTitle(null);
      return undefined;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const appWindow = await ipcRenderer.invoke('get-current-activity');
        if (!cancelled) setTitle(formatActivityTitle(appWindow));
      } catch (error) {
        console.error('Error loading current activity:', error);
        if (!cancelled) setTitle(null);
      }
    };
    refresh();
    ipcRenderer.on('heartbeat-added', refresh);
    return () => {
      cancelled = true;
      ipcRenderer.removeListener('heartbeat-added', refresh);
    };
  }, [enabled]);

  return enabled ? title : null;
}
