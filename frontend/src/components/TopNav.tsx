import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { api } from "../lib/api";

interface NotificationItem {
  id: string;
  type: string;
  data: {
    item_type?: string;
    item_id?: number | string;
    item_name?: string;
    permission?: string;
    shared_by?: string;

    // For ItemUpdatedNotification
    change_type?: string;
    updated_by?: string;
  };
  read_at: string | null;
  created_at: string;
}

interface TopNavProps {
  onLogout?: () => void;
}

interface TopNavProps {
  onLogout?: () => void;
}

export default function TopNav({ onLogout }: TopNavProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const [currentUserName, setCurrentUserName] = useState<string>("User");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const menuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("fildas_user");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user.name) setCurrentUserName(user.name);

        let roleLabel = "";
        const rawRole = user.role ?? user.user_role;
        if (typeof rawRole === "string") {
          roleLabel = rawRole;
        } else if (rawRole && typeof rawRole === "object") {
          roleLabel = rawRole.name || rawRole.title || "";
        }

        if (roleLabel) setCurrentUserRole(roleLabel);
      } catch (e) {
        console.error("Failed to parse fildas_user", e);
      }
    }
  }, []);

  const loadNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const res = await api.get("/notifications", {
        params: { per_page: 10, page: 1 },
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
      // meta is available in res.data.meta for a full notifications page later
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleOpenNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && notifications.length === 0) {
      await loadNotifications();
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    try {
      await api.post(`/notifications/${notif.id}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      if (notif.type === "ItemSharedNotification") {
        navigate("/shared");
      } else if (notif.type === "ItemUpdatedNotification") {
        navigate("/files");
      } else {
        navigate("/overview");
      }
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  useEffect(() => {
    // initial load + 30s polling while user is on page
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Call logout endpoint to invalidate token on server
      await api.post("/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Clear local storage
      localStorage.removeItem("fildas_token");
      localStorage.removeItem("fildas_user");

      // Clear auth header
      delete api.defaults.headers.common["Authorization"];

      // Call parent callback if provided
      if (onLogout) {
        onLogout();
      }

      // Redirect to login
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-sky-400">FilDAS</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-200">
        <IconButton size="sm" variant="ghost" className="md:hidden">
          ☰
        </IconButton>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <IconButton
            size="sm"
            variant="ghost"
            className="relative"
            onClick={handleOpenNotifications}
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[10px] leading-4 text-center px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </IconButton>

          {notifOpen && (
            <div className="absolute right-0 top-8 mt-1 w-80 max-h-80 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 text-xs shadow-lg z-20">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                <span className="font-semibold text-slate-100">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] text-sky-400 hover:text-sky-300"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {loadingNotifs ? (
                <div className="px-3 py-4 text-slate-400">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-4 text-slate-400">
                  No notifications yet.
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-slate-800">
                    {notifications.map((n) => {
                      const isUnread = !n.read_at;
                      let label: string;

                      if (n.type === "ItemSharedNotification") {
                        label = `${n.data.shared_by || "Someone"} shared the ${
                          n.data.item_type || "item"
                        } "${n.data.item_name || "Untitled"}" with you${
                          n.data.permission
                            ? ` (${n.data.permission} access)`
                            : ""
                        }.`;
                      } else if (n.type === "ItemUpdatedNotification") {
                        const change = n.data.change_type || "updated";
                        label = `${
                          n.data.updated_by || "Someone"
                        } ${change} your ${n.data.item_type || "item"} "${
                          n.data.item_name || "Untitled"
                        }".`;
                      } else {
                        label = "You have a new notification.";
                      }

                      return (
                        <li key={n.id}>
                          <button
                            onClick={() => handleNotificationClick(n)}
                            className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                              isUnread ? "bg-slate-900/80" : ""
                            }`}
                          >
                            <p
                              className={`text-[12px] ${
                                isUnread ? "text-slate-50" : "text-slate-300"
                              }`}
                            >
                              {label}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <button
                    className="w-full px-3 py-2 text-[11px] text-sky-400 hover:text-sky-300 border-t border-slate-800 text-left"
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/notifications");
                    }}
                  >
                    View all notifications
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative flex items-center gap-2" ref={menuRef}>
          <Button
            size="xs"
            variant="secondary"
            className="pl-1.5 pr-2"
            onClick={() => setOpen((v) => !v)}
            leftIcon={
              <span className="h-6 w-6 rounded-full bg-sky-600 text-[11px] flex items-center justify-center">
                {currentUserName.charAt(0).toUpperCase()}
              </span>
            }
            rightIcon={<span className="text-[10px]">{open ? "▴" : "▾"}</span>}
          >
            {currentUserName}
          </Button>

          {open && (
            <div className="absolute right-0 top-8 mt-1 w-40 rounded-md border border-slate-700 bg-slate-900 text-xs shadow-lg z-20">
              <Button
                variant="ghost"
                size="xs"
                className="w-full justify-start rounded-none px-3 py-2"
              >
                {currentUserRole && typeof currentUserRole === "string"
                  ? `${currentUserName} • ${currentUserRole}`
                  : "User info / Settings"}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="w-full justify-start rounded-none px-3 py-2 text-red-400 hover:text-red-300"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
