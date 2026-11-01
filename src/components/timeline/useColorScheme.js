// React hook returning the OS color scheme ('light' | 'dark'); re-renders when it changes.
import { useEffect, useState } from 'react';

const QUERY = '(prefers-color-scheme: dark)';
const getScheme = () => (window.matchMedia(QUERY).matches ? 'dark' : 'light');

export function useColorScheme() {
  const [scheme, setScheme] = useState(getScheme);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setScheme(mql.matches ? 'dark' : 'light');
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return scheme;
}
