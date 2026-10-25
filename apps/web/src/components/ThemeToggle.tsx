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
      className="theme-toggle celestial-toggle"
      type="button"
      data-night={dark}
      onClick={() => onChange(dark ? 'light' : 'dark')}
      disabled={busy}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Sunrise · light mode' : 'Sunset · dark mode'}
    >
      <span className="celestial-sky" aria-hidden="true">
        <Sun size={20} className="celestial-sun" />
        <Moon size={19} className="celestial-moon" />
      </span>
      <span className="celestial-horizon" aria-hidden="true" />
    </button>
  );
}
