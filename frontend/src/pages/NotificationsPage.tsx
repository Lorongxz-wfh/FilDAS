import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";

interface NotificationItem {
  id: string;
  type: string;
  data: {
    item_type?: string;
    item_id?: number | string;
    item_name?: string;
    permission?: string;
    shared_by?: string;
    change_type?: string;
    updated_by?: string;
  };
  read_at: string | null;
  created_at: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread_count: number;
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationsResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadPage = async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await api.get<NotificationsResponse>("/notifications", {
        params: { per_page: 20, page: pageNum },
      });

      setItems(res.data.notifications || []);
      setMeta(res.data.meta);
      setPage(res.data.meta.current_page);
    } catch (err) {
      console.error("Failed to load notifications page", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(1);
  }, []);

  const handleMarkOneAsRead = async (notif: NotificationItem) => {
    if (notif.read_at) return;
    try {
      await api.post(`/notifications/${notif.id}/read`);
      setItems((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  const renderLabel = (n: NotificationItem) => {
    if (n.type === "ItemSharedNotification") {
      return `${n.data.shared_by || "Someone"} shared the ${
        n.data.item_type || "item"
      } "${n.data.item_name || "Untitled"}" with you${
        n.data.permission ? ` (${n.data.permission} access)` : ""
      }.`;
    }
    if (n.type === "ItemUpdatedNotification") {
      const change = n.data.change_type || "updated";
      return `${n.data.updated_by || "Someone"} ${change} your ${
        n.data.item_type || "item"
      } "${n.data.item_name || "Untitled"}".`;
    }
    return "You have a new notification.";
  };

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Notifications</h1>
        <Button
          size="xs"
          variant="secondary"
          onClick={handleMarkAllAsRead}
          disabled={items.length === 0}
        >
          Mark all as read
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">Loading notifications…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-400">No notifications yet.</p>
      )}

      {!loading && items.length > 0 && (
        <div className="rounded-md border border-slate-800 bg-slate-900">
          <ul className="divide-y divide-slate-800">
            {items.map((n) => {
              const isUnread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className={`flex items-start justify-between px-3 py-2 ${
                    isUnread ? "bg-slate-900/80" : "bg-slate-900"
                  }`}
                >
                  <div>
                    <p
                      className={`text-xs ${
                        isUnread ? "text-slate-50" : "text-slate-300"
                      }`}
                    >
                      {renderLabel(n)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      onClick={() => handleMarkOneAsRead(n)}
                      className="ml-2 text-[11px] text-sky-400 hover:text-sky-300"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800 text-[11px] text-slate-300">
              <span>
                Page {meta.current_page} of {meta.last_page}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={meta.current_page <= 1 || loading}
                  onClick={() => loadPage(meta.current_page - 1)}
                  className={`px-2 py-1 rounded border border-slate-700 ${
                    meta.current_page <= 1 || loading
                      ? "text-slate-500"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  Previous
                </button>
                <button
                  disabled={meta.current_page >= meta.last_page || loading}
                  onClick={() => loadPage(meta.current_page + 1)}
                  className={`px-2 py-1 rounded border border-slate-700 ${
                    meta.current_page >= meta.last_page || loading
                      ? "text-slate-500"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
