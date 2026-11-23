import type { ReactNode } from 'react';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './import-astryx.css';

export default function ImportSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`import-astryx ${className}`} data-astryx-theme="neutral">
      {children}
    </div>
  );
}
