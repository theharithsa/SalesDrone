import { useLayoutEffect, useRef, type ReactNode } from 'react';

export default function LeadPage({ toolbar, workflow, identity, children }: {
  toolbar: ReactNode;
  workflow: ReactNode;
  identity: ReactNode;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section ref={root} className="lead-detail lead-blade full-lead-page" aria-label="Lead details" tabIndex={-1}>
      <header className="blade-header">
        <div className="detail-top">{toolbar}</div>
        <div className="lead-overview">
          {identity}
          <div className="blade-workflow">{workflow}</div>
        </div>
      </header>
      <div className="blade-body" id="lead-details-content">{children}</div>
    </section>
  );
}
