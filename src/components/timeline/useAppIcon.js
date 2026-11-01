// Resolves real OS app icons ({ dataUrl, color }) via the main process, memoized by executable path.
import { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';

const iconCache = new Map(); // path -> { dataUrl, color } | null
const iconPending = new Map(); // path -> Promise

export default function useAppIcon(path) {
  const [icon, setIcon] = useState(() => (path && iconCache.has(path) ? iconCache.get(path) : null));
  useEffect(() => {
    if (!path) { setIcon(null); return; }
    if (iconCache.has(path)) { setIcon(iconCache.get(path)); return; }
    let cancelled = false;
    let pending = iconPending.get(path);
    if (!pending) {
      pending = ipcRenderer
        .invoke('get-app-icon', path)
        .then((res) => { iconCache.set(path, res || null); iconPending.delete(path); return res || null; })
        .catch(() => { iconPending.delete(path); return null; });
      iconPending.set(path, pending);
    }
    pending.then((res) => { if (!cancelled) setIcon(res || null); });
    return () => { cancelled = true; };
  }, [path]);
  return icon;
}
