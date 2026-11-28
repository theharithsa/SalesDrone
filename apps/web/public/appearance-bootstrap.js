let theme = 'system';
try {
  const stored = localStorage.getItem('salesdrone.theme');
  if (stored === 'dark' || stored === 'light') theme = stored;
} catch {
  // Use the device appearance when browser storage is unavailable.
}
const root = document.documentElement;
root.dataset.theme = theme;
root.dataset.colorScheme = theme === 'dark' ||
  (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  ? 'dark' : 'light';
