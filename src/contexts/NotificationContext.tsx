import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  pushNotification,
  markRead as markOneRead,
  markAllRead as markEveryRead,
  unreadCount,
  type AppNotification,
  type NotificationInput,
} from '../lib/notifications';

/**
 * The event store any screen can push into (Milestone 50).
 *
 * Notifications persist: an event that happened does not un-happen on refresh, and a sync
 * conflict raised at 4pm must still be waiting when the shop reopens. Toasts do not persist —
 * they are the transient half, and a missed toast leaves its notification behind.
 */

export interface Toast {
  id: string;
  title: string;
  body: string;
  severity: AppNotification['severity'];
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unread: number;
  /** Records the event and raises a toast for it. */
  notify: (input: NotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TOAST_MS = 5000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('stitch_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    localStorage.setItem('stitch_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    setNotifications(prev => pushNotification(prev, input));

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [
      ...prev,
      { id, title: input.title, body: input.body, severity: input.severity ?? 'INFO' },
    ]);
    // Critical events stay until dismissed: a failed sync must not scroll past unnoticed.
    if (input.severity !== 'CRITICAL') {
      window.setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, TOAST_MS);
    }
  }, []);

  const markRead = useCallback((id: string) => setNotifications(prev => markOneRead(prev, id)), []);
  const markAllRead = useCallback(() => setNotifications(prev => markEveryRead(prev)), []);
  const clearAll = useCallback(() => setNotifications([]), []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unread: unreadCount(notifications),
        notify, markRead, markAllRead, clearAll,
        toasts, dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
