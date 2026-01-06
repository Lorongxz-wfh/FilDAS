// src/pages/ReportsPage.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Loader } from "../components/ui/Loader";

type ActivitySummaryResponse = {
  filters: {
    date_from: string;
    date_to: string;
    department_id: number | null;
  };
  summary: {
    total_actions: number;
    total_uploads: number;
    failed_actions: number;
    approvals: number;
    rejections: number;
  };
  by_action_type: {
    action: string;
    count: number;
  }[];
  by_department: {
    department_id: number | null;
    department_name: string | null;
    total_actions: number;
    uploads: number;
    approvals: number;
  }[];
  top_users: {
    user_id: number | null;
    user_name: string | null;
    department_name: string | null;
    actions_count: number;
    uploads_count: number;
  }[];
};

export default function ReportsPage() {
  const [data, setData] = useState<ActivitySummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState<"last7" | "last30" | "today">(
    "last7"
  );

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<ActivitySummaryResponse>(
        "/reports/activity-summary",
        {
          // v1: backend decides actual dates; later we can pass date_from/date_to
          params: {},
        }
      );
      setData(res.data);
    } catch (e: any) {
      console.error(e);
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset]);

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold text-white">
        Reports &amp; Logs
      </h1>

      {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total actions</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {data?.summary.total_actions ?? "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            From {data?.filters.date_from ?? "?"} to{" "}
            {data?.filters.date_to ?? "?"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Files uploaded</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {data?.summary.total_uploads ?? "—"}
          </p>
          <p className="mt-1 text-xs text-sky-400">
            Content actions (uploads only)
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">QA decisions</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {(data?.summary.approvals ?? 0) + (data?.summary.rejections ?? 0) ||
              "—"}
          </p>
          <p className="mt-1 text-xs text-amber-400">
            {data
              ? `${data.summary.approvals} approved · ${data.summary.rejections} rejected`
              : "Approvals vs rejections"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Failed actions</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {data?.summary.failed_actions ?? "—"}
          </p>
          <p className="mt-1 text-xs text-rose-400">Login / upload failures</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Date range:</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={datePreset}
            onChange={(e) =>
              setDatePreset(e.target.value as "today" | "last7" | "last30")
            }
          >
            <option value="today">Today</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
          </select>
        </div>

        <button
          type="button"
          className="inline-flex items-center rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
          onClick={fetchSummary}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Activity by type */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Activity by action type
          </p>
          <p className="text-xs text-slate-500">
            {data ? `${data.by_action_type.length} types` : ""}
          </p>
        </div>

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <Loader label="Loading reports..." size="sm" />
          </div>
        )}

        {!loading && (!data || data.by_action_type.length === 0) && (
          <p className="py-4 text-center text-xs text-slate-500">
            No activity in this period.
          </p>
        )}

        {!loading && data && data.by_action_type.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Count</th>
                  <th className="py-2 pr-4">% of actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.by_action_type.map((row) => {
                  const pct =
                    data.summary.total_actions > 0
                      ? Math.round(
                          (row.count / data.summary.total_actions) * 100
                        )
                      : 0;
                  return (
                    <tr key={row.action}>
                      <td className="py-1.5 pr-4 text-slate-200">
                        {row.action}
                      </td>
                      <td className="py-1.5 pr-4 text-slate-200">
                        {row.count}
                      </td>
                      <td className="py-1.5 pr-4 text-slate-400">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top users */}
      <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Top users by activity
          </p>
          <p className="text-xs text-slate-500">
            {data ? `${data.top_users.length} user(s)` : ""}
          </p>
        </div>

        {loading && (
          <div className="flex h-20 items-center justify-center">
            <Loader label="Loading users..." size="sm" />
          </div>
        )}

        {!loading && (!data || data.top_users.length === 0) && (
          <p className="py-4 text-center text-xs text-slate-500">
            No user activity in this period.
          </p>
        )}

        {!loading && data && data.top_users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Actions</th>
                  <th className="py-2 pr-4">Uploads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.top_users.map((u) => (
                  <tr key={u.user_id ?? u.user_name ?? "unknown"}>
                    <td className="py-1.5 pr-4 text-slate-200">
                      {u.user_name ?? (u.user_id ? `User #${u.user_id}` : "—")}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-300">
                      {u.department_name ?? "—"}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-200">
                      {u.actions_count}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-200">
                      {u.uploads_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
