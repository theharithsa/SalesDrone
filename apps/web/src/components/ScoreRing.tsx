import { scoreDisplay } from '../lib/score-display';
export default function ScoreRing({ value }: { value: unknown }) {
  const { score, progress } = scoreDisplay(value);
  return (
    <svg
      className={'score-ring' + (score === null ? ' is-unscored' : '')}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="score-ring-track"
        cx="20"
        cy="20"
        r="16"
        pathLength="100"
        fill="none"
        strokeWidth="4"
      />
      {score !== null && progress > 0 ? (
        <circle
          className="score-ring-progress"
          cx="20"
          cy="20"
          r="16"
          pathLength="100"
          fill="none"
          strokeWidth="4"
          strokeDasharray={`${progress} 100`}
          transform="rotate(-90 20 20)"
        />
      ) : null}
    </svg>
  );
}
