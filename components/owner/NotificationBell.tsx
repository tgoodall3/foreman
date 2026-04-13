"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: "work_order" | "time_request" | "estimate" | "invoice";
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
  read: boolean;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const TYPE_STYLES: Record<string, { dot: string; icon: JSX.Element }> = {
  work_order: {
    dot: "bg-amber",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  time_request: {
    dot: "bg-blue-500",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
      </svg>
    ),
  },
  estimate: {
    dot: "bg-green-500",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 4h10l2 4v12H5V4h2z" />
      </svg>
    ),
  },
  invoice: {
    dot: "bg-green-600",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

const READ_KEY = "foreman_notif_read";

type StoredReadState = {
  ids?: string[];
  readAllBefore?: string | null;
};

function loadReadState(): { ids: Set<string>; readAllBefore: number | null } {
  try {
    const stored = localStorage.getItem(READ_KEY);
    if (!stored) return { ids: new Set(), readAllBefore: null };

    const parsed: StoredReadState | string[] = JSON.parse(stored);

    // Backward compatibility with the older array-only storage format.
    if (Array.isArray(parsed)) {
      return { ids: new Set(parsed), readAllBefore: null };
    }

    const ids = new Set(Array.isArray(parsed?.ids) ? parsed.ids : []);
    const readAllBefore = parsed?.readAllBefore ? new Date(parsed.readAllBefore).getTime() : null;
    return { ids, readAllBefore };
  } catch {
    return { ids: new Set(), readAllBefore: null };
  }
}

function saveReadState(ids: Set<string>, readAllBefore: number | null) {
  try {
    const payload: StoredReadState = {
      ids: Array.from(ids),
      readAllBefore: readAllBefore ? new Date(readAllBefore).toISOString() : null,
    };
    localStorage.setItem(READ_KEY, JSON.stringify(payload));
  } catch {}
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [readAllBefore, setReadAllBefore] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read IDs from localStorage
  useEffect(() => {
    const stored = loadReadState();
    setReadIds(stored.ids);
    setReadAllBefore(stored.readAllBefore);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchNotifications = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {}
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) fetchNotifications();
  };

  // Fetch on mount and poll in background so badge stays fresh without clicking
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRead = (notification: Notification) => (
    readIds.has(notification.id) ||
    (readAllBefore !== null && new Date(notification.createdAt).getTime() <= readAllBefore)
  );

  const markAllRead = () => {
    const nextIds = new Set(readIds);
    notifications.forEach((notification) => nextIds.add(notification.id));
    const nextReadAllBefore = Date.now();

    setReadIds(nextIds);
    setReadAllBefore(nextReadAllBefore);
    saveReadState(nextIds, nextReadAllBefore);
  };

  const unread = notifications.filter((notification) => !isRead(notification)).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-mist hover:text-white hover:bg-forge-light transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-700 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 lg:right-auto lg:left-0 top-10 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-600 text-forge text-sm">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-amber hover:underline font-600">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-mist text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-mist text-sm">No recent activity</div>
            ) : (
              notifications.map((n) => {
                const style = TYPE_STYLES[n.type];
                const notificationIsRead = isRead(n);
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      const next = new Set(readIds).add(n.id);
                      setReadIds(next);
                      saveReadState(next, readAllBefore);
                      setOpen(false);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${notificationIsRead ? "opacity-60" : ""}`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notificationIsRead ? "bg-gray-100 text-mist" : "bg-amber/10 text-amber-dark"}`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${notificationIsRead ? "text-mist" : "text-forge font-600"}`}>{n.title}</p>
                      <p className="text-xs text-mist mt-0.5 truncate">{n.subtitle}</p>
                      <p className="text-xs text-steel mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!notificationIsRead && <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${style.dot}`} />}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
