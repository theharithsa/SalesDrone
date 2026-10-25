import { useId, type CSSProperties } from 'react';
export default function EnterpriseBrand({
  workspace = false,
}: {
  workspace?: boolean;
}) {
  const whiteFilterId = useId();
  return (
    <div
      className={
        'enterprise-brand ' +
        (workspace ? 'enterprise-brand-workspace' : 'enterprise-brand-login')
      }
      style={
        {
          '--enterprise-white-filter': `url(#${whiteFilterId})`,
        } as CSSProperties
      }
      role="img"
      aria-label="Avinya Enterprises"
      title="Avinya Enterprises"
    >
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
        className="enterprise-filters"
      >
        <defs>
          <filter id={whiteFilterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -0.5 -0.5 -0.5 0 1.5"
            />
            <feComposite in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
      </svg>
      <span className="enterprise-mark" aria-hidden="true">
        <img
          src="/brand/avinya-enterprises-final.png"
          width="500"
          height="423"
          alt=""
        />
      </span>
      <span className="enterprise-wordmark" aria-hidden="true">
        <img
          src="/brand/avinya-enterprises-final.png"
          width="500"
          height="423"
          alt=""
        />
      </span>
    </div>
  );
}
