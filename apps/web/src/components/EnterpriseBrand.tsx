export default function EnterpriseBrand({
  workspace = false,
}: {
  workspace?: boolean;
}) {
  return (
    <div
      className={
        'enterprise-brand ' +
        (workspace ? 'enterprise-brand-workspace' : 'enterprise-brand-login')
      }
      role="img"
      aria-label="Avinya Enterprises"
      title="Avinya Enterprises"
    >
      <span className="enterprise-mark" aria-hidden="true" />
      <span className="enterprise-wordmark" aria-hidden="true">
        <strong>Avinya</strong>
        <span>ENTERPRISES</span>
      </span>
    </div>
  );
}
