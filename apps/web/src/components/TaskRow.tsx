import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {Check, X, Clock, MoreHorizontal, CalendarClock} from 'lucide-react';
import {LeadName} from './UI';
import {displayDate} from '../lib/types';
import {scaleFromCSS} from '../lib/display-scale';
import type {Lead,Task} from '../lib/types';
export default function TaskRow({
  task,
  lead,
  timezone,
  onOpen,
  onComplete,
  onSnooze,
  onCancel,
  onReschedule,
  onEdit,
  onDelete,
  disabled,
  canComplete = true,
}: {
  task: Task;
  lead?: Pick<Lead, "id" | "name" | "company">;
  timezone: string;
  onOpen: () => void;
  onComplete: () => void;
  onSnooze?: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  disabled: boolean;
  canComplete?: boolean;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if(event.key === 'Escape' && menuRef.current) {
      menuRef.current.open = false;
      menuRef.current.querySelector('summary')?.focus();
      event.stopPropagation();
    }
  };
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        menuRef.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [menuOpen]);
  const action = (run: () => void) => {
    if(menuRef.current) {
      menuRef.current.open = false;
      menuRef.current.querySelector('summary')?.focus();
    }
    run();
  };
  const overdue =
    task.state === 'Pending' && Date.parse(task.dueAt) < Date.now();
  return (
    <div className="task-row" data-state={task.state}>
      <button
        className={
          'task-check ' + (task.state === 'Completed' ? 'complete' : '')
        }
        aria-label={
          (task.state === 'Completed'
            ? 'Completed: '
            : task.state === 'Cancelled'
              ? 'Cancelled: '
              : 'Complete ') + task.title
        }
        disabled={disabled || !canComplete || task.state !== 'Pending'}
        onClick={onComplete}
      >
        <span className="task-check-symbol" aria-hidden="true">
          {task.state === 'Completed' ? (
            <Check size={14} />
          ) : task.state === 'Cancelled' ? (
            <X size={14} />
          ) : null}
        </span>
      </button>
      <button className="task-body" onClick={onOpen} aria-label={task.title}>
        <span className="task-title">{task.title}</span>
        <span className="task-context">
          {task.leadId ? 'Lead follow-up' : 'Personal reminder'}
        </span>
      </button>
      <div className={"task-lead" + (!task.leadId ? " task-lead-personal" : "")}>
        <span className="task-lead-label">Lead</span>
        {lead ? <><a href={'/leads/' + encodeURIComponent(lead.id)}><LeadName name={lead.name}/></a>{lead.company ? <small>{lead.company}</small> : null}</> : <span className="muted">{task.leadId ? 'Lead unavailable' : '—'}</span>}
      </div>
      <div className="task-responsible"><span className="task-lead-label">Responsible</span><span>{task.responsible?.name || 'You'}</span></div>
      <div className="task-time">
        <span className={overdue ? 'overdue' : ''}>
          {overdue ? <span className="overdue-dot" /> : <Clock size={12} />}{' '}
          <time dateTime={task.dueAt}>{displayDate(task.dueAt, timezone)}</time>
        </span>
        {overdue ? (
          <small>Overdue</small>
        ) : task.state !== 'Pending' ? (
          <small>{task.state}</small>
        ) : null}
      </div>
      <div className="task-actions">
        {task.state === 'Pending' && onReschedule ? <button className="button task-reschedule" onClick={onReschedule} disabled={disabled}><CalendarClock size={16}/><span>Reschedule</span></button> : null}
      {(task.state === 'Pending' && (onSnooze || onCancel)) || onEdit || onDelete ? (
        <details
          ref={menuRef}
          className="task-menu"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              event.currentTarget.open = false;
          }}
          onToggle={(event) => {
            const details = event.currentTarget;
            setMenuOpen(details.open);
            if (!details.open) return;
            const menu = details.querySelector(
              ':scope > div',
            ) as HTMLElement | null;
            const trigger = details.querySelector('summary');
            if (!menu || !trigger) return;
            details.dataset.placement = 'below';
            const anchor = trigger.getBoundingClientRect();
            const top = Math.max(
              0,
              document.querySelector('.topbar')?.getBoundingClientRect()
                .bottom || 0,
            );
            const navigation = document
              .querySelector('.bottom-nav')
              ?.getBoundingClientRect();
            const bottom =
              navigation && navigation.height
                ? navigation.top
                : window.innerHeight;
            const above = Math.max(0, anchor.top - top - 8);
            const below = Math.max(0, bottom - anchor.bottom - 8);
            const placeAbove =
              menu.scrollHeight *
                scaleFromCSS(getComputedStyle(document.documentElement).zoom) >
                below && above > below;
            details.dataset.placement = placeAbove ? 'above' : 'below';
            menu.style.setProperty(
              '--task-menu-room',
              Math.max(
                1,
                (placeAbove ? above : below) /
                  scaleFromCSS(getComputedStyle(document.documentElement).zoom),
              ) + 'px',
            );
          }}

        >
          <summary onKeyDown={closeOnEscape} aria-label={'Actions for ' + task.title}>
            <MoreHorizontal size={18} />
          </summary>
          <div>
            {onEdit ? (
              <button onKeyDown={closeOnEscape} onClick={() => action(onEdit)} disabled={disabled}>
                Edit task
              </button>
            ) : null}
            {task.state === 'Pending' ? (
              <>
                {onSnooze ? <button onKeyDown={closeOnEscape} onClick={() => action(onSnooze)} disabled={disabled}>Snooze 1 hour</button> : null}
                {onCancel ? (
                  <button onKeyDown={closeOnEscape} onClick={() => action(onCancel)} disabled={disabled}>
                    Cancel task
                  </button>
                ) : null}
              </>
            ) : null}
            {onDelete ? (
              <button onKeyDown={closeOnEscape} className="danger" onClick={() => action(onDelete)} disabled={disabled}>
                Delete task
              </button>
            ) : null}
          </div>
        </details>
      ) : null}
      </div>
    </div>
  );
}
