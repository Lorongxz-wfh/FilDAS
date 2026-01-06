// src/pages/DashboardPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import { fetchDashboardSummary } from "../lib/api";

type DashboardStats = {
  total_documents: number;
  approved_documents: number;
  pending_documents: number;
  rejected_documents: number;
  uploaded_this_week: number;
  uploaded_last_week: number;
  pending_qa: number;
  rejected_this_week: number;
  active_users_this_week: number;
};

type RecentDocument = {
  id: number;
  title: string | null;
  status: string | null;
  department_name: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
};

type RecentActivity = {
  id: number;
  action: string;
  details: string | null;
  user_name: string | null;
  department_name: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDashboardSummary();

        if (cancelled) return;

        setStats(data.stats);
        setRecentDocs(data.recent_documents ?? []);
        setRecentActivity(data.recent_activity ?? []);
      } catch (e: any) {
        if (cancelled) return;
        console.error("Dashboard load failed:", e);
        setError(
          e?.response?.data?.message ??
            e?.message ??
            "Failed to load dashboard data."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const uploadsDelta =
    stats && stats.uploaded_last_week
      ? stats.uploaded_this_week - stats.uploaded_last_week
      : null;

  return (
    <>
      <h1 className="text-2xl font-semibold mb-2 text-white">Dashboard</h1>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total documents</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {loading || !stats ? "…" : stats.total_documents}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Approved: {loading || !stats ? "…" : stats.approved_documents}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Uploads this week</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {loading || !stats ? "…" : stats.uploaded_this_week}
          </p>
          <p className="mt-1 text-xs text-emerald-400">
            {loading || uploadsDelta === null
              ? ""
              : uploadsDelta === 0
              ? "Same as last week"
              : uploadsDelta > 0
              ? `+${uploadsDelta} vs last week`
              : `${uploadsDelta} vs last week`}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Pending QA approvals</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {loading || !stats ? "…" : stats.pending_qa}
          </p>
          <p className="mt-1 text-xs text-amber-400">
            Rejected this week:{" "}
            {loading || !stats ? "…" : stats.rejected_this_week}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Active users (this week)</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {loading || !stats ? "…" : stats.active_users_this_week}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Users with at least one action.
          </p>
        </div>
      </div>

      {/* Recent items + Recent activity */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent documents */}
        <section className="lg:col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Recent documents
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Latest uploads across departments.
          </p>

          {loading && <p className="mt-4 text-xs text-slate-500">Loading…</p>}

          {!loading && recentDocs.length === 0 && (
            <p className="mt-4 text-xs text-slate-500">No recent documents.</p>
          )}

          <ul className="mt-4 space-y-3 text-sm">
            {recentDocs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">
                    {doc.title || "Untitled document"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {doc.status ?? "unknown"} ·{" "}
                    {doc.department_name ?? "No department"} ·{" "}
                    {doc.uploaded_by ?? "Unknown user"}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {doc.uploaded_at
                    ? new Date(doc.uploaded_at).toLocaleString()
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent activity */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Recent activity
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Latest actions from Activity Logs.
          </p>

          {loading && <p className="mt-4 text-xs text-slate-500">Loading…</p>}

          {!loading && recentActivity.length === 0 && (
            <p className="mt-4 text-xs text-slate-500">No recent activity.</p>
          )}

          <ul className="mt-4 space-y-3 text-xs">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3">
                <div>
                  <p className="text-slate-200">
                    {entry.user_name ?? "Someone"}{" "}
                    <span className="text-slate-400">{entry.action}</span>
                  </p>
                  {entry.details && (
                    <p className="text-slate-500">{entry.details}</p>
                  )}
                  <p className="text-slate-500">
                    {entry.department_name ?? "No department"}
                  </p>
                </div>
                <span className="text-slate-500 whitespace-nowrap">
                  {entry.created_at
                    ? new Date(entry.created_at).toLocaleString()
                    : ""}
                </span>
              </li>
            ))}
          </ul>

          <button
            className="mt-4 w-full rounded-md border border-slate-700 px-3 py-2 text-[11px] text-sky-400 hover:bg-slate-800"
            onClick={() => navigate("/activity-logs")}
          >
            View all activity logs
          </button>
        </section>
      </div>

      {/* Main modules row – keep as-is but point to your real routes */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <section
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500 hover:bg-slate-900/80 cursor-pointer transition"
          onClick={() => navigate("/documents")}
        >
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-sky-600 text-xs text-white">
              DM
            </span>
            Document Manager
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Browse, upload, share, and manage documents.
          </p>
        </section>

        <section
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500 hover:bg-slate-900/80 cursor-pointer transition"
          onClick={() => navigate("/users")}
        >
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-xs text-white">
              UM
            </span>
            User Manager
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Manage users, roles, and department access.
          </p>
        </section>

        <section
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500 hover:bg-slate-900/80 cursor-pointer transition"
          onClick={() => navigate("/activity-logs")}
        >
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-600 text-xs text-white">
              AL
            </span>
            Activity Logs
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Review detailed audit trail of user actions.
          </p>
        </section>
      </div>

      {/* New record modal – keep for now or remove later */}
      <Modal
        open={newRecordOpen}
        title="Create new record"
        onClose={() => setNewRecordOpen(false)}
      >
        {/* leave form as mock or hook later to real endpoint */}
        <form className="space-y-3 text-sm">
          {/* ... existing modal fields ... */}
        </form>
      </Modal>
    </>
  );
}