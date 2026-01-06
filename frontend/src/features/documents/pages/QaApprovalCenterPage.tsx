// src/features/documents/pages/QaApprovalCenterPage.tsx
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { Loader } from "../../../components/ui/Loader";
import { statusBadgeClass } from "../../../components/documents/DetailsPanelSections";
import { notify } from "../../../lib/notify";

type Role = { id: number; name: string };
type Department = { id: number; name: string; is_qa?: boolean };

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role?: Role | null;
  department?: Department | null;
};

type QaDoc = {
  id: number;
  title: string | null;
  original_filename: string;
  status: string;
  department?: { id: number; name: string } | null;
  uploadedBy?: { id: number; name: string } | null;
  approved_by?: number | null;
  approved_at?: string | null;
  assigned_to?: number | null;
  assignedTo?: { id: number; name: string } | null;
};

type PagedResponse = {
  data: QaDoc[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

type CommentDto = {
  id: number;
  body: string;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
};

type QaActivityEntry = {
  id: number;
  action: string;
  details: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
};

export default function QaApprovalCenterPage() {
  const [docs, setDocs] = useState<QaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [rejectReason, setRejectReason] = useState(""); // <-- moved here

  // status filter: pending | approved | rejected | all
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");

  const [selectedDoc, setSelectedDoc] = useState<QaDoc | null>(null);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // QA history (activity) for the selected document
  const [qaHistory, setQaHistory] = useState<QaActivityEntry[]>([]);
  const [qaHistoryLoading, setQaHistoryLoading] = useState(false);

  // approve / reject button loading state
  const [actionLoading, setActionLoading] = useState<
    "approve" | "reject" | null
  >(null);

  // const [qaUsers, setQaUsers] = useState<{ id: number; name: string }[]>([]);
  // const [qaUsersLoading, setQaUsersLoading] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // role flags
  const isSuperAdmin = currentUser?.role?.name === "Super Admin";
  const isAdmin =
    currentUser?.role?.name === "Admin" ||
    currentUser?.role?.name === "Super Admin";
  const isQa = !!currentUser?.department?.is_qa;
  const isQaAdmin = isQa && currentUser?.role?.name === "Admin";

  // permissions: what current user can do in QA
  const canApproveReject = isSuperAdmin || isQaAdmin;

  // assignment abilities
  const canSelfAssign = !!currentUser && (isSuperAdmin || isQa); // any QA member
  const canAssignOthers = isSuperAdmin || isQaAdmin;

  // can comment in QA modal:
  // - any QA user (staff/admin)
  // - document owner/uploader
  // - admin from uploader's department
  const isQaStaff = isQa; // includes QA Admin + QA Staff
  const canCommentOnSelected = (() => {
    if (!selectedDoc || !currentUser) return false;

    const isUploader =
      selectedDoc.uploadedBy?.id &&
      selectedDoc.uploadedBy.id === currentUser.id;

    const isDeptAdminForUploader =
      isAdmin &&
      selectedDoc.department?.id &&
      currentUser.department?.id &&
      selectedDoc.department.id === currentUser.department.id;

    if (isSuperAdmin) return true;
    if (isQaStaff) return true;
    if (isUploader) return true;
    if (isDeptAdminForUploader) return true;

    return false;
  })();

  // load user from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("fildas_user");
    if (raw) {
      try {
        const parsed: any = JSON.parse(raw);
        setCurrentUser(parsed as CurrentUser);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PagedResponse>("/qa/approvals", {
        params: {
          status: statusFilter,
          per_page: 50,
        },
      });

      const raw = (res.data as any).data ?? res.data.data ?? [];
      const mapped: QaDoc[] = raw.map((d: any) => ({
        ...d,
        uploadedBy: d.uploadedBy ?? d.uploaded_by ?? null,
        assignedTo: d.assignedTo ?? d.assigned_to ?? null,
        assigned_to: d.assigned_to ?? d.assignedTo?.id ?? null,
      }));

      setDocs(mapped);
    } catch (e: any) {
      console.error(e);
      setError("Failed to load QA approvals.");
    } finally {
      setLoading(false);
    }
  };

  // const loadQaUsers = async () => {
  //   setQaUsersLoading(true);
  //   try {
  //     const res = await api.get<{ id: number; name: string }[]>("/qa/users");
  //     setQaUsers(res.data);
  //   } catch (e) {
  //     console.error(e);
  //     setQaUsers([]);
  //   } finally {
  //     setQaUsersLoading(false);
  //   }
  // };

  const loadComments = async (docId: number) => {
    setCommentsLoading(true);
    try {
      const res = await api.get<CommentDto[]>(`/documents/${docId}/comments`);
      setComments(res.data);
    } catch (e) {
      console.error(e);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadQaHistory = async (docId: number) => {
    setQaHistoryLoading(true);
    try {
      // Assumes backend route: GET /documents/{id}/activity
      // which returns a list of { id, action, details, created_at, user }.
      const res = await api.get<QaActivityEntry[]>(
        `/documents/${docId}/activity`
      );

      // Optionally filter to QA-related actions only
      const qaActions = ["uploaded", "approved", "rejected", "assigned"];
      const filtered = res.data.filter((entry) =>
        qaActions.includes(entry.action)
      );

      setQaHistory(filtered);
    } catch (e) {
      console.error(e);
      setQaHistory([]);
    } finally {
      setQaHistoryLoading(false);
    }
  };

  const loadPreview = async (docId: number) => {
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const res = await api.get<{ stream_url?: string }>(
        `/documents/${docId}/preview`
      );
      const url = (res.data as any).stream_url || (res.data as any).url || null;
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
      setPreviewUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (
      !selectedDoc ||
      !newComment.trim() ||
      commentSubmitting ||
      !canCommentOnSelected
    )
      return;
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const res = await api.post<CommentDto>(
        `/documents/${selectedDoc.id}/comments`,
        { body: newComment.trim() }
      );
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to add comment.";
      setCommentError(msg);
    } finally {
      setCommentSubmitting(false);
    }
  };

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleApprove = async () => {
    if (!selectedDoc || actionLoading) return;
    setActionLoading("approve");
    setActionError(null);
    try {
      await api.post(`/documents/${selectedDoc.id}/approve`);
      await loadDocs();
      setSelectedDoc((prev) => (prev ? { ...prev, status: "approved" } : prev));
      notify("Document approved.", "success");
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to approve document.";
      setActionError(msg);
      notify(msg, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedDoc || actionLoading) return;

    setActionLoading("reject");
    setActionError(null);

    try {
      const payload = rejectReason.trim()
        ? { reason: rejectReason.trim() }
        : {};

      await api.post(`/documents/${selectedDoc.id}/reject`, payload);
      await loadDocs();
      setSelectedDoc((prev) => (prev ? { ...prev, status: "rejected" } : prev));
      setRejectReason("");
      notify("Document rejected.", "success");
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to reject document.";
      setActionError(msg);
      notify(msg, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelfAssign = async () => {
    if (!selectedDoc || !canSelfAssign) return;
    try {
      const res = await api.post(`/documents/${selectedDoc.id}/self-assign`);
      const updated = res.data as any;
      setSelectedDoc((prev) =>
        prev && prev.id === updated.id
          ? {
              ...prev,
              assigned_to: updated.assigned_to,
              assignedTo:
                updated.assignedTo ?? updated.assigned_to
                  ? {
                      id: updated.assigned_to,
                      name:
                        updated.assignedTo?.name ?? currentUser?.name ?? "You",
                    }
                  : null,
            }
          : prev
      );
      await loadDocs();
      notify("Assigned to you.", "success");
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to assign to you.";
      notify(msg, "error");
    }
  };

  const handleAssignTo = async (userId: number) => {
    if (!selectedDoc || !canAssignOthers) return;
    try {
      const res = await api.post(`/documents/${selectedDoc.id}/assign`, {
        user_id: userId,
      });
      const updated = res.data as any;
      setSelectedDoc((prev) =>
        prev && prev.id === updated.id
          ? {
              ...prev,
              assigned_to: updated.assigned_to,
              assignedTo: updated.assignedTo ?? null,
            }
          : prev
      );
      await loadDocs();
      notify("Document assigned.", "success");
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to assign document.";
      notify(msg, "error");
    }
  };

  return (
    <div className="flex min-h-[calc(88vh-2rem)] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">
          QA Approval Center
        </h1>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={loadDocs}
            disabled={loading}
          >
            {loading ? "Reloading..." : "Reload"}
          </Button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Status:</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "pending" | "approved" | "rejected" | "all"
              )
            }
          >
            <option value="pending">Pending only</option>
            <option value="approved">Approved only</option>
            <option value="rejected">Rejected only</option>
            <option value="all">All statuses</option>
          </select>
        </div>
      </div>

      {/* THIS WRAPS THE CARD AND FORCES FULL HEIGHT */}
      <div className="flex-1 flex">
        <div className="flex flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900/60 text-xs">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader label="Loading QA documents..." size="md" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-xs text-slate-400">
                No documents match the current filters.
              </p>
            </div>
          ) : (
            <div className="h-full overflow-x-auto p-3">
              <table className="min-w-full text-left">
                <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Title / file</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Uploaded by</th>
                    <th className="py-2 pr-3">Assigned QA</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Approved by</th>
                    <th className="py-2 pr-3">Approved at</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {docs.map((d) => (
                    <tr
                      key={d.id}
                      className="cursor-pointer hover:bg-slate-800/50"
                      onClick={() => {
                        setSelectedDoc(d);
                        setActionError(null);
                        setCommentError(null);
                        loadComments(d.id);
                        loadPreview(d.id);
                        loadQaHistory(d.id);
                      }}
                    >
                      <td className="py-2 pr-3 text-slate-100">
                        {d.title || d.original_filename}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {d.department?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {d.uploadedBy?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {d.assignedTo?.name ??
                          (d.assigned_to
                            ? `User #${d.assigned_to}`
                            : "Unassigned")}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        <span className={statusBadgeClass(d.status)}>
                          {d.status || "pending"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {(d as any).approvedBy?.name ??
                          (d.approved_by ? `User #${d.approved_by}` : "—")}
                      </td>
                      <td className="py-2 pr-3 text-slate-400">
                        {d.approved_at
                          ? new Date(d.approved_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {canApproveReject ? (
                          <>
                            <Button
                              size="xs"
                              variant="primary"
                              className="mr-2"
                              disabled={actionLoading !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDoc(d);
                                loadComments(d.id);
                                loadPreview(d.id);
                                loadQaHistory(d.id);
                                handleApprove();
                              }}
                            >
                              {actionLoading === "approve"
                                ? "Approving..."
                                : "Approve"}
                            </Button>
                            <Button
                              size="xs"
                              variant="secondary"
                              disabled={actionLoading !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDoc(d);
                                loadComments(d.id);
                                loadPreview(d.id);
                                loadQaHistory(d.id);
                                handleReject();
                              }}
                            >
                              {actionLoading === "reject"
                                ? "Rejecting..."
                                : "Reject"}
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* QA review modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="flex h-[80vh] w-full max-w-5xl flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  {selectedDoc.title || selectedDoc.original_filename}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {selectedDoc.department?.name || "No department"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    window.location.href = `/documents?docId=${selectedDoc.id}`;
                  }}
                >
                  View in Documents
                </Button>

                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setSelectedDoc(null);
                    setComments([]);
                    setNewComment("");
                    setPreviewUrl(null);
                    setPreviewLoading(false);
                    setQaHistory([]);
                    setQaHistoryLoading(false);
                    setActionError(null);
                    setCommentError(null);
                    setCommentSubmitting(false);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="flex flex-1 flex-col md:flex-row">
              {/* Left: preview placeholder */}
              <div className="flex-1 border-b border-slate-800 p-3 md:border-b-0 md:border-r flex flex-col">
                <div className="mb-2 text-xs font-semibold text-slate-300">
                  Preview
                </div>

                <div className="flex-1">
                  <div className="flex h-full items-center justify-center rounded-md border border-slate-700 bg-slate-950/40 p-2">
                    {previewLoading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader label="Loading preview..." size="md" />
                      </div>
                    ) : previewUrl ? (
                      <iframe
                        src={previewUrl}
                        className="h-full w-full rounded-md"
                        title="Document preview"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                        No preview available.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: metadata + approve/reject + comments */}
              <div className="flex w-full max-w-md flex-col p-3">
                {/* Status + actions */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-2 text-[11px] text-slate-300">
                      <span className="text-slate-400">Assigned QA:</span>
                      <span>
                        {selectedDoc.assignedTo?.name ??
                          (selectedDoc.assigned_to
                            ? `User #${selectedDoc.assigned_to}`
                            : "Unassigned")}
                      </span>

                      {canSelfAssign &&
                        selectedDoc.status === "pending" &&
                        (!selectedDoc.assigned_to ||
                          selectedDoc.assigned_to === currentUser?.id) && (
                          <button
                            type="button"
                            className="text-[10px] text-sky-400 hover:underline"
                            onClick={handleSelfAssign}
                          >
                            Assign to me
                          </button>
                        )}

                      {/* {canAssignOthers && selectedDoc.status === "pending" && (
                        <select
                          className="rounded border border-slate-700 bg-slate-900 px-1 py-[2px] text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          value={selectedDoc.assigned_to ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (!value) return;
                            const userId = Number(value);
                            if (!Number.isNaN(userId)) {
                              handleAssignTo(userId);
                            }
                          }}
                        >
                          <option value="">
                            {qaUsersLoading
                              ? "Loading QA users..."
                              : "Assign to QA"}
                          </option>
                          {qaUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      )} */}
                    </span>
                  </div>

                  {canApproveReject ? (
                    <div className="flex gap-2">
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={handleApprove}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === "approve"
                          ? "Approving..."
                          : "Approve"}
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={handleReject}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === "reject" ? "Rejecting..." : "Reject"}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {actionError && (
                  <div className="mb-2 text-[11px] text-rose-400">
                    {actionError}
                  </div>
                )}
                {/* Reject reason input */}
                <div className="mb-3 space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Reject reason (optional)
                  </label>
                  <textarea
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    rows={2}
                    placeholder="Explain why this document is rejected (optional)..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>

                {/* Metadata */}
                <div className="mb-3 space-y-1 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-500">File name: </span>
                    {selectedDoc.original_filename}
                  </div>
                  <div>
                    <span className="text-slate-500">Department: </span>
                    {selectedDoc.department?.name ?? "—"}
                  </div>
                  <div>
                    <span className="text-slate-500">Uploaded by: </span>
                    {selectedDoc.uploadedBy?.name ?? "—"}
                  </div>
                </div>

                {/* QA history */}
                <div className="mb-3 border-t border-slate-800 pt-2">
                  <div className="mb-1 text-xs font-semibold text-slate-300">
                    QA history
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
                    {qaHistoryLoading ? (
                      <div className="py-2 text-center">
                        <Loader label="Loading QA history..." size="sm" />
                      </div>
                    ) : qaHistory.length === 0 ? (
                      <div className="py-2 text-center text-[11px] text-slate-500">
                        No QA events yet.
                      </div>
                    ) : (
                      qaHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className="mb-1 rounded bg-slate-800/60 px-2 py-1 text-[11px]"
                        >
                          <div className="text-[10px] text-slate-400">
                            {entry.user?.name ?? "System"} •{" "}
                            {new Date(entry.created_at).toLocaleString()}
                          </div>
                          <div className="text-slate-100">
                            {entry.action === "approved" && "Approved"}
                            {entry.action === "rejected" && "Rejected"}
                            {entry.action === "uploaded" && "Uploaded"}
                            {entry.action === "assigned" && "Assigned"}
                            {entry.action !== "approved" &&
                              entry.action !== "rejected" &&
                              entry.action !== "uploaded" &&
                              entry.action}
                            {entry.details ? ` — ${entry.details}` : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Comments */}
                <div className="flex flex-1 flex-col border-t border-slate-800 pt-2">
                  <div className="mb-1 text-xs font-semibold text-slate-300">
                    Comments
                  </div>
                  {commentError && (
                    <div className="mb-1 text-[11px] text-rose-400">
                      {commentError}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
                    {commentsLoading ? (
                      <div className="py-4 text-center">
                        <Loader label="Loading comments..." size="sm" />
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="py-4 text-center text-[11px] text-slate-500">
                        No comments yet.
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div
                          key={c.id}
                          className="mb-2 rounded bg-slate-800/60 px-2 py-1 text-[11px]"
                        >
                          <div className="mb-0.5 text-[10px] text-slate-400">
                            {c.user?.name ?? "Unknown"} •{" "}
                            {new Date(c.created_at).toLocaleString()}
                          </div>
                          <div className="whitespace-pre-wrap text-slate-100">
                            {c.body}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {canCommentOnSelected ? (
                      <>
                        <input
                          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                        />
                        <Button
                          size="xs"
                          disabled={!newComment.trim() || commentSubmitting}
                          onClick={handleAddComment}
                        >
                          {commentSubmitting ? "Sending..." : "Send"}
                        </Button>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        You can view comments but not add new ones.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
