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

export function LeadPageLoading() {
  return (
    <div className="lead-page-loading" role="status">
      <span className="sr-only">Loading lead details…</span>
      <div className="lead-loading-card" aria-hidden="true">
        <span className="lead-loading-avatar" />
        <div><span /><span /></div>
      </div>
      <div className="lead-loading-card lead-loading-journey" aria-hidden="true">
        <div><span /><span /></div>
      </div>
    </div>
  );
}
