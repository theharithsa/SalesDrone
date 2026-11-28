import type { ReactNode } from 'react';
import '@astryxdesign/core/astryx.css';
import './import-astryx.css';

export default function ImportSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`import-astryx ${className}`}>
      {children}
    </div>
  );
}
