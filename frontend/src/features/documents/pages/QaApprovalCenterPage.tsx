// src/features/documents/pages/QaApprovalCenterPage.tsx
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";

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

export default function QaApprovalCenterPage() {
  const [docs, setDocs] = useState<QaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [selectedDoc, setSelectedDoc] = useState<QaDoc | null>(null);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [actionLoading, setActionLoading] = useState<
    "approve" | "reject" | null
  >(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // role flags
  const isSuperAdmin = currentUser?.role?.name === "Super Admin";
  const isQa = !!currentUser?.department?.is_qa;
  const isQaAdmin = isQa && currentUser?.role?.name === "Admin";

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
        params: { status: "pending", per_page: 50 },
      });
      setDocs(res.data.data ?? (res.data as any).data ?? []);
    } catch (e: any) {
      console.error(e);
      setError("Failed to load QA approvals.");
    } finally {
      setLoading(false);
    }
  };

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
    if (!selectedDoc || !newComment.trim()) return;
    try {
      const res = await api.post<CommentDto>(
        `/documents/${selectedDoc.id}/comments`,
        { body: newComment.trim() }
      );
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch (e) {
      console.error(e);
      alert("Failed to add comment.");
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleApprove = async () => {
    if (!selectedDoc || actionLoading) return;
    setActionLoading("approve");
    try {
      await api.post(`/documents/${selectedDoc.id}/approve`);
      await loadDocs();
      setSelectedDoc((prev) => (prev ? { ...prev, status: "approved" } : prev));
    } catch (e) {
      console.error(e);
      alert("Failed to approve document.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedDoc || actionLoading) return;
    const reason =
      window.prompt("Reason for rejection (optional):") ?? undefined;
    setActionLoading("reject");
    try {
      await api.post(
        `/documents/${selectedDoc.id}/reject`,
        reason ? { reason } : {}
      );
      await loadDocs();
      setSelectedDoc((prev) => (prev ? { ...prev, status: "rejected" } : prev));
    } catch (e) {
      console.error(e);
      alert("Failed to reject document.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-white">
        QA Approval Center
      </h1>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-slate-400">No documents pending approval.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
          <table className="min-w-full text-left">
            <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-3">Title / file</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Uploaded by</th>
                <th className="py-2 pr-3">Status</th>
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
                    loadComments(d.id);
                    loadPreview(d.id);
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
                  <td className="py-2 pr-3 text-xs">
                    <span
                      className={
                        d.status === "approved"
                          ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                          : d.status === "rejected"
                          ? "inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-400"
                          : "inline-flex rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                      }
                    >
                      {d.status || "pending"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {isSuperAdmin || isQaAdmin ? (
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
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
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
                  <span className="inline-flex rounded-full border border-slate-600 px-2 py-0.5 text-[11px] text-slate-200">
                    Status: {selectedDoc.status}
                  </span>

                  {isSuperAdmin || isQaAdmin ? (
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

                {/* Comments */}
                <div className="flex flex-1 flex-col border-t border-slate-800 pt-2">
                  <div className="mb-1 text-xs font-semibold text-slate-300">
                    Comments
                  </div>

                  <div className="flex-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
                    {commentsLoading ? (
                      <div className="py-4 text-center text-[11px] text-slate-500">
                        Loading comments...
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
                    <input
                      className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <Button
                      size="xs"
                      disabled={!newComment.trim()}
                      onClick={handleAddComment}
                    >
                      Send
                    </Button>
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
