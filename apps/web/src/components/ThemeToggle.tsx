import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
export default function ThemeToggle({
  appearance,
  onChange,
  busy = false,
}: {
  appearance: string;
  onChange: (appearance: 'light' | 'dark') => void;
  busy?: boolean;
}) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={() => onChange(dark ? 'light' : 'dark')}
      disabled={busy}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
