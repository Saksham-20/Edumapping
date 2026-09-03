// client/src/components/common/NotificationPanel.js
//
// The slide-over notification list. Icons live here rather than in the
// context: the context is a data layer, and it was handing the view emoji
// glyphs that render differently on every platform and read aloud as their
// Unicode names.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNotification } from '../../contexts/NotificationContext';
import { Button, EmptyState, IconButton, Skeleton, Tabs, cx } from '../ui';
import {
  BellIcon,
  XMarkIcon,
  CheckIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const TYPE_ICONS = {
  application_update: DocumentTextIcon,
  job_alert: BriefcaseIcon,
  event_reminder: CalendarIcon,
  system_alert: ExclamationTriangleIcon
};

const PRIORITY_TONES = {
  urgent: 'border-red-600/25 bg-red-50 text-red-700',
  high: 'border-saffron-500/40 bg-saffron-50 text-saffron-800',
  medium: 'border-azure-500/25 bg-azure-500/10 text-azure-700',
  low: 'border-ink-950/15 bg-bone-100 text-ink-600'
};

const NotificationPanel = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, formatNotificationTime } =
    useNotification();
  const [activeTab, setActiveTab] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setActiveTab('all');
    restoreRef.current = document.activeElement;

    // The panel covers the page, so the page behind it must not scroll and
    // must not be reachable by Tab. Neither was handled before.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => panelRef.current?.querySelector('button')?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      clearTimeout(t);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [isOpen, onClose]);

  const visible = useMemo(() => {
    if (activeTab === 'unread') return notifications.filter((n) => !n.isRead);
    if (activeTab === 'read') return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, activeTab]);

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
    } catch {
      toast.error('Could not mark that as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Could not mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-ink-950/15 bg-white"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-950/10 bg-bone-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-950/15 bg-white text-ink-800"
            >
              <BellIcon className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink-950">Notifications</h2>
              <p className="text-xs text-ink-600">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}
              </p>
            </div>
          </div>
          <IconButton icon={XMarkIcon} label="Close notifications" onClick={onClose} size="sm" />
        </div>

        <div className="border-b border-ink-950/10 px-5 py-3">
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            tabs={[
              { value: 'all', label: 'All', count: notifications.length },
              { value: 'unread', label: 'Unread', count: unreadCount },
              { value: 'read', label: 'Read' }
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading && notifications.length === 0 && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-ink-950/15 p-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-2.5 h-3 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-2/3" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && visible.length === 0 && (
            <EmptyState
              icon={BellIcon}
              title={activeTab === 'unread' ? 'Nothing unread' : 'No notifications'}
              description={
                activeTab === 'unread'
                  ? 'You’ve read everything here.'
                  : 'Updates about your applications, jobs and events will appear here.'
              }
            />
          )}

          {visible.length > 0 && (
            <ul className="space-y-3">
              {visible.map((n) => {
                const Icon = TYPE_ICONS[n.type] || BellIcon;
                return (
                  <li
                    key={n.id}
                    className={cx(
                      'rounded-2xl border p-4 transition-colors',
                      n.isRead ? 'border-ink-950/15 bg-white' : 'border-ink-950/20 bg-bone-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cx(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                          PRIORITY_TONES[n.priority] || PRIORITY_TONES.low
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cx(
                              'text-sm',
                              n.isRead ? 'font-medium text-ink-800' : 'font-semibold text-ink-950'
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span
                              aria-label="Unread"
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-saffron-500"
                            />
                          )}
                        </div>
                        {n.message && <p className="mt-1 text-sm text-ink-600">{n.message}</p>}
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <time
                            className="font-mono text-[11px] uppercase tracking-wider text-ink-500"
                            dateTime={n.createdAt}
                          >
                            {formatNotificationTime(n.createdAt)}
                          </time>
                          {!n.isRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={CheckIcon}
                              onClick={() => handleMarkAsRead(n.id)}
                            >
                              Mark read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {unreadCount > 0 && (
          <div className="border-t border-ink-950/10 bg-bone-50 px-5 py-4">
            <Button
              fullWidth
              variant="secondary"
              icon={CheckIcon}
              loading={markingAll}
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
