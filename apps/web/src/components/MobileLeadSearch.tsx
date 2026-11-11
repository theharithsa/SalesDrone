import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from './UI';

export default function MobileLeadSearch({
  value,
  onApply,
}: {
  value: string;
  onApply: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const apply = (query: string) => {
    onApply(query.trim());
    setOpen(false);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button mobile-lead-search-trigger"
        aria-label={value ? 'Search leads, search active' : 'Search leads'}
        aria-haspopup="dialog"
        title="Search leads"
        data-active={value ? '' : undefined}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <Search size={20} aria-hidden="true" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Search leads"
        description="Find leads by name, phone, company, comments and more."
        initialFocusRef={input}
        returnFocusRef={trigger}
      >
        <form onSubmit={(event) => {
          event.preventDefault();
          apply(draft);
        }}>
          <label className="mobile-lead-search-label">
            Search query
            <input
              ref={input}
              type="search"
              enterKeyHint="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <div className="form-footer">
            {value ? (
              <button type="button" className="text-button" onClick={() => apply('')}>
                Clear search
              </button>
            ) : null}
            <button type="submit" className="button primary">Search</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
