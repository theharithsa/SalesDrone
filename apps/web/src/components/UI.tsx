import * as Dialog from '@radix-ui/react-dialog';
import { X, LoaderCircle, ArrowUpRight } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { initials } from '../lib/types';
export function Brand({ full = false }: { full?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <div>
        <strong>
          SalesDrone<span className="brand-dot">.</span>
        </strong>
        {full ? (
          <small>by AvinyaTech</small>
        ) : (
          <small>YOUR SALES WORKSPACE</small>
        )}
      </div>
    </div>
  );
}
export function Avatar({
  name,
  small = false,
  photoURL,
}: {
  photoURL?: string;
  name: string;
  small?: boolean;
}) {
  const [failedPhoto, setFailedPhoto] = useState('');
  return (
    <span className={'avatar ' + (small ? 'small' : '')} aria-hidden="true">
      {photoURL && photoURL !== failedPhoto ? (
        <img
          src={photoURL}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedPhoto(photoURL)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
export function Badge({ stage }: { stage: string }) {
  return (
    <span className={'badge stage-' + stage.toLowerCase().replaceAll(' ', '-')}>
      <i />
      {stage}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ArrowUpRight size={24} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your workspace…
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={'dialog ' + (wide ? 'wide' : '')}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || 'Update your workspace.'}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="error-message" role="alert">
      {error}
    </p>
  ) : null;
}
export function SaveButton({
  busy,
  label = 'Save changes',
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <button className="button primary" disabled={busy} type="submit">
      {busy ? (
        <>
          <LoaderCircle size={16} className="spin" /> Saving…
        </>
      ) : (
        label
      )}
    </button>
  );
}
export function useSubmit(action: (data: any, key: string) => Promise<void>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  return {
    busy,
    error,
    run: async (data: any) => {
      if (busy) return;
      setBusy(true);
      setError('');
      try {
        await action(data, key);
        setKey(crypto.randomUUID());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      } finally {
        setBusy(false);
      }
    },
  };
}

export function LeadName({
  name,
  detail = false,
}: {
  name: string;
  detail?: boolean;
}) {
  if (!detail) return <>{name || 'Name not recorded'}</>;
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <>
      <span className="lead-first-name">{first || 'Name not recorded'}</span>{' '}
      {rest.length ? (
        <span className="lead-family-name">{rest.join(' ')}</span>
      ) : null}
    </>
  );
}
