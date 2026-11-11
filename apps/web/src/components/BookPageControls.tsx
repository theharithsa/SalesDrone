import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BookPageControls({ index, count, label, section, onTurn }: {
  index: number;
  count: number;
  label: string;
  section?: string;
  onTurn: (direction: number) => void;
}) {
  return (
    <nav className="book-page-controls" aria-label={label}>
      <button type="button" className="button" aria-disabled={index === 0} onClick={() => onTurn(-1)}>
        <ChevronLeft size={18} aria-hidden="true" /> Previous
      </button>
      <span className="book-page-number" role="status">
        {section && <strong>{section}</strong>}
        Page {index + 1} of {count}
      </span>
      <button type="button" className="button" aria-disabled={index === count - 1} onClick={() => onTurn(1)}>
        Next <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
