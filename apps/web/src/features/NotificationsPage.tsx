import { useState } from 'react';
import { ArrowUpRight, Bell, CheckCheck, Mail, UserRound } from 'lucide-react';
import { Entity, displayDate } from '../lib/types';
import { Empty, ErrorMessage, Loading } from '../components/UI';
export default function NotificationsPage({
  embedded = false,
  items,
  loading,
  timezone,
  hasMore,
  onMore,
  onRead,
  onOpen,
}: {
  embedded?: boolean;
  items: Entity[];
  loading: boolean;
  timezone: string;
  hasMore: boolean;
  onMore: () => void;
  onRead: (n: Entity, read: boolean) => Promise<void>;
  onOpen: (n: Entity) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState('');
  async function act(n: Entity, action: () => Promise<void>) {
    setBusy(n.id);
    setError('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div
      className={
        embedded
          ? 'notifications-panel-content'
          : 'page-body notifications-page'
      }
    >
      {!embedded ? (
        <div className="page-title">
          <div>
            <span className="eyebrow">YOUR WORKSPACE UPDATES</span>
            <h1>Your inbox</h1>
            <p>
              Lead assignments, new leads and reminders stay here, even when
              push is off.
            </p>
          </div>
        </div>
      ) : null}
      <ErrorMessage error={error} />
      <section className="panel notification-list" aria-label="Notifications">
        {loading ? (
          <Loading />
        ) : items.length ? (
          items.map((n) => (
            <article
              key={n.id}
              aria-label={n.title}
              className={'notification-row ' + (!n.readAt ? 'unread' : '')}
            >
              <span className="notification-icon">
                {n.kind?.startsWith('lead_') ? (
                  <UserRound size={20} />
                ) : (
                  <Bell size={20} />
                )}
              </span>
              <div className="notification-content">
                <div className="notification-title">
                  <strong>{n.title}</strong>
                  <span className="notification-state">
                    {n.readAt ? 'Read' : 'Unread'}
                  </span>
                </div>
                {n.body ? <p>{n.body}</p> : null}
                <time dateTime={n.createdAt}>
                  {displayDate(n.createdAt, timezone)}
                </time>
                <div className="notification-actions">
                  <button
                    className="text-button"
                    disabled={busy !== null}
                    onClick={() => void act(n, () => onOpen(n))}
                  >
                    {n.kind?.startsWith('lead_') ? 'View lead' : 'View task'}
                    <ArrowUpRight size={14} />
                  </button>
                  <button
                    className="text-button"
                    disabled={busy !== null}
                    onClick={() => void act(n, () => onRead(n, !n.readAt))}
                  >
                    {n.readAt ? <Mail size={16} /> : <CheckCheck size={16} />}{' '}
                    {busy === n.id
                      ? 'Updating…'
                      : n.readAt
                        ? 'Mark as unread'
                        : 'Mark as read'}
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title={
              hasMore
                ? 'No current updates on this page.'
                : "You're all caught up."
            }
          >
            {hasMore
              ? 'Load more to check older notifications.'
              : 'New leads, assignments and due reminders will appear here.'}
          </Empty>
        )}
        {hasMore ? (
          <button
            className="button inbox-load-more"
            onClick={onMore}
            disabled={loading}
          >
            Load more notifications
          </button>
        ) : null}
      </section>
    </div>
  );
}
