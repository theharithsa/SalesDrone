import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import './theme-toggle.css';
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
      className="theme-toggle mode-toggle"
      type="button"
      data-night={dark}
      aria-busy={busy || undefined}
      onClick={() => onChange(dark ? 'light' : 'dark')}
      disabled={busy}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="mode-toggle-track" aria-hidden="true">
        <span className="mode-toggle-indicator" />
        <span className="mode-toggle-option mode-toggle-light"><Sun size={18} /></span>
        <span className="mode-toggle-option mode-toggle-dark"><Moon size={18} /></span>
      </span>
    </button>
  );
}
