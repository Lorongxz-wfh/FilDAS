// src/pages/AuditLogsPage.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import type { Department } from "../types/documents";

type AuditLogRow = {
  id: number;
  user_id: number | null;
  user_name: string | null;
  department_id: number | null;
  department_name: string | null;
  subject_type: string | null;
  subject_id: number | null;
  action: string;
  details: string | null;
  created_at: string;
};

type AuditLogResponse = {
  data: AuditLogRow[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

const formatSubject = (
  subjectType: string | null,
  subjectId: number | null
) => {
  if (!subjectType) return "—";

  // Take the last part after the backslashes, e.g. "Folder" from "App\\Models\\Folder"
  const raw = subjectType.split("\\").pop() ?? subjectType;
  const label = raw.replace(/([a-z])([A-Z])/g, "$1 $2"); // "SharedFolder" -> "Shared Folder"

  if (subjectId == null) return label;
  return `${label} #${subjectId}`;
};

const SUBJECT_TYPE_OPTIONS = [
  { label: "Any type", value: "" },
  { label: "Document", value: "App\\Models\\Document" },
  { label: "Folder", value: "App\\Models\\Folder" },
  { label: "Department", value: "App\\Models\\Department" },
  { label: "User", value: "App\\Models\\User" },
];

const ACTION_OPTIONS = [
  { label: "Any action", value: "" },
  { label: "Created", value: "created" },
  { label: "Uploaded", value: "uploaded" },
  { label: "Updated", value: "updated" },
  { label: "Deleted", value: "deleted" },
  { label: "Downloaded", value: "downloaded" },
  { label: "Shared", value: "shared" },
  { label: "Share permission changed", value: "share_permission_changed" },
  { label: "Unshared", value: "unshared" },
  { label: "Viewed", value: "viewed" },
  { label: "Login success", value: "login_success" },
  { label: "Login failed", value: "login_failed" },
  { label: "Logout", value: "logout" },
];

import { useOutletContext } from "react-router-dom";

type LayoutContext = {
  isSuperAdmin: boolean;
  isAdmin: boolean;
};

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

export default function ActivityLogsPage() {
  const { isSuperAdmin, isAdmin } = useOutletContext<LayoutContext>();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [userId, setUserId] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState<
    "any" | "today" | "last7" | "last30"
  >("any");
  const [departmentId, setDepartmentId] = useState("");

  // departments for Super Admin filter
  const [departments, setDepartments] = useState<Department[]>([]);

  // pagination
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="p-4 text-sm text-rose-400">
        You do not have permission to view audit logs.
      </div>
    );
  }

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AuditLogResponse>("/activity-logs", {
        params: {
          user_name: userId || undefined,
          subject_type: subjectType || undefined,
          subject_id: subjectId || undefined,
          action: action || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          // Super Admin can optionally filter by department; for Admin this is ignored/overridden by backend
          department_id: isSuperAdmin ? departmentId || undefined : undefined,
          per_page: perPage,
          page,
        },
      });

      setLogs(res.data.data);
      setTotal(res.data.meta.total);
      setLastPage(res.data.meta.last_page);
    } catch (e: any) {
      console.error(e);
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Load departments for Super Admin so filter can show names instead of raw IDs
  useEffect(() => {
    if (!isSuperAdmin) return;

    const loadDepartments = async () => {
      try {
        const res = await api.get<any>("/departments");

        // Handle either array or { data: [...] } shape
        const items = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

        setDepartments(items as Department[]);
      } catch (e) {
        console.error("Failed to load departments for audit filter", e);
      }
    };

    loadDepartments();
  }, [isSuperAdmin]);

  useEffect(() => {
    // When filters change, reset to first page and reload after a short delay
    const handle = setTimeout(() => {
      setPage(1);
      loadLogs();
    }, 500);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, subjectType, subjectId, action, dateFrom, dateTo, departmentId]);

  const handleApplyFilters = () => {
    setPage(1);
    loadLogs();
  };

  const handleClearFilters = () => {
    setUserId("");
    setSubjectType("");
    setSubjectId("");
    setAction("");
    setDateFrom("");
    setDateTo("");
    setDepartmentId("");
    setPage(1);
    loadLogs();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <header>
        <h1 className="mb-1 text-2xl font-semibold text-white">
          Activity logs
        </h1>
      </header>

      {/* Filters */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-xs">
        <div className="mb-1.5 flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="mb-1 text-[11px] text-slate-400">User</label>
            <input
              className="w-35 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Search name…"
            />
          </div>
          {isSuperAdmin && (
            <div className="flex flex-col">
              <label className="mb-1 text-[11px] text-slate-400">
                Department
              </label>
              <select
                className="w-52 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All departments</option>
                {Array.isArray(departments) &&
                  departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex flex-col">
            <label className="mb-1 text-[11px] text-slate-400">Type</label>
            <select
              className="w-30 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value)}
            >
              {SUBJECT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-[11px] text-slate-400">
              Subject ID
            </label>
            <input
              className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={subjectId}
              onChange={(e) =>
                setSubjectId(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="e.g. 1"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-[11px] text-slate-400">Action</label>
            <select
              className="w-40 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="mb-1 text-[11px] text-slate-400">
                  Date from
                </label>
                <input
                  type="date"
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-1 text-[11px] text-slate-400">
                  Date to
                </label>
                <input
                  type="date"
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-1 text-[11px] text-slate-400">
                  Range preset
                </label>
                <select
                  className="w-25 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={datePreset}
                  onChange={(e) => {
                    const value = e.target.value as
                      | "any"
                      | "today"
                      | "last7"
                      | "last30";
                    setDatePreset(value);

                    if (value === "any") {
                      setDateFrom("");
                      setDateTo("");
                      return;
                    }

                    const today = new Date();
                    const todayStr = formatDate(today);

                    if (value === "today") {
                      setDateFrom(todayStr);
                      setDateTo(todayStr);
                    } else if (value === "last7") {
                      const from = new Date();
                      from.setDate(today.getDate() - 6); // inclusive 7 days
                      setDateFrom(formatDate(from));
                      setDateTo(todayStr);
                    } else if (value === "last30") {
                      const from = new Date();
                      from.setDate(today.getDate() - 29); // inclusive 30 days
                      setDateFrom(formatDate(from));
                      setDateTo(todayStr);
                    }
                  }}
                >
                  <option value="any">Any</option>
                  <option value="today">Today</option>
                  <option value="last7">Last 7 days</option>
                  <option value="last30">Last 30 days</option>
                </select>
              </div>
            </div>
          </div>

          <div className="ml-auto flex gap-2">
            <Button size="xs" variant="secondary" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </div>
      </section>

      {/* Logs table */}
      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
        <div className="mb-2 flex items-center justify-between text-xs">
          <p className="font-semibold uppercase text-slate-400">Entries</p>
          <p className="text-slate-500">
            {loading
              ? "Loading…"
              : `Showing page ${page} of ${lastPage} (${total} total)`}
          </p>
        </div>

        {error && <p className="mb-2 text-xs text-rose-400">{error}</p>}

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-xs text-slate-500"
                  >
                    Loading activity logs…
                  </td>
                </tr>
              )}

              {!loading && logs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-xs text-slate-500"
                  >
                    No activity logs found.
                  </td>
                </tr>
              )}

              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/60">
                    <td className="py-1.5 pr-3 text-slate-200">
                      {log.user_name ?? `User #${log.user_id ?? "-"}`}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-200">
                      {log.department_name ??
                        (log.department_id
                          ? `Dept #${log.department_id}`
                          : "—")}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-300">
                      {formatSubject(log.subject_type, log.subject_id)}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-300">
                      {/* Type = human-friendly version of subject_type */}
                      {formatSubject(log.subject_type, null)}
                    </td>
                    <td className="py-1.5 pr-3 text-sky-300">{log.action}</td>
                    <td className="py-1.5 pr-3 text-slate-300">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 max-w-xs truncate text-slate-400">
                      {log.details ?? "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {page} of {lastPage}
          </span>
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
