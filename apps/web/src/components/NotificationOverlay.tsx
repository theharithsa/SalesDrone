import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState, ReactNode } from 'react';
import { X } from 'lucide-react';
import NotificationsPage from '../features/NotificationsPage';
import { Entity } from '../lib/types';
import { ErrorMessage } from './UI';
export default function NotificationOverlay({
  open,
  onOpenChange,
  trigger,
  request,
  timezone,
  onOpen,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  request: (p: string, m?: string, b?: any) => Promise<any>;
  timezone: string;
  onOpen: (item: Entity, isCurrent: () => boolean) => Promise<void>;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Entity[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0),
    navigating = useRef(false);
  useEffect(() => {
    if (!open) return;
    const epoch = ++generation.current;
    let alive = true;
    setItems([]);
    setCursor(null);
    setBusy(true);
    setError('');
    navigating.current = false;
    request('/notifications?limit=20')
      .then((r) => {
        if (alive && epoch === generation.current) {
          setItems(r.items);
          setCursor(r.nextCursor);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
      generation.current++;
    };
  }, [open, request]);
  async function more() {
    const epoch = generation.current;
    setBusy(true);
    setError('');
    try {
      const r = await request(
        '/notifications?limit=20&cursor=' + encodeURIComponent(cursor!),
      );
      if (epoch === generation.current) {
        setItems((old) => [...old, ...r.items]);
        setCursor(r.nextCursor);
      }
    } catch (e) {
      if (epoch === generation.current) setError((e as Error).message);
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function read(n: Entity, value: boolean) {
    const epoch = generation.current;
    await request('/notifications/' + n.id, 'PATCH', { read: value });
    if (epoch !== generation.current) return;
    setItems((old) =>
      old.map((item) =>
        item.id === n.id
          ? { ...item, readAt: value ? new Date().toISOString() : null }
          : item,
      ),
    );
    onChanged();
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) generation.current++;
        onOpenChange(value);
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="notification-scrim" />
        <Dialog.Content
          className="notification-overlay"
          onCloseAutoFocus={(e) => {
            if (navigating.current) e.preventDefault();
          }}
        >
          <header>
            <div>
              <span className="eyebrow">YOUR WORKSPACE UPDATES</span>
              <Dialog.Title>Notifications</Dialog.Title>
              <Dialog.Description>
                Stay in context. Open a lead or reminder when you’re ready.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Close notifications"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <div className="notification-overlay-scroll">
            <ErrorMessage error={error} />
            <NotificationsPage
              embedded
              items={items}
              loading={busy && !items.length}
              timezone={timezone}
              hasMore={!!cursor}
              onMore={() => void more()}
              onRead={read}
              onOpen={async (n) => {
                const epoch = generation.current;
                await onOpen(n, () => epoch === generation.current);
                if (epoch !== generation.current) return;
                navigating.current = true;
                onOpenChange(false);
                if (!n.readAt) {
                  void request('/notifications/' + n.id, 'PATCH', {
                    read: true,
                  })
                    .then(onChanged)
                    .catch(() => {});
                }
              }}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
