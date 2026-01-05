// src/components/documents/DetailsPanelSections.tsx
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import Modal from "../Modal";
import type { DocumentRow, FolderRow, Item } from "../../types/documents";

export type FileDetailsProps = {
  doc: DocumentRow;
  previewUrl: string | null;
  previewLoading: boolean;
  formatSize: (bytes: number) => string;
  status?: string | null;
  onDescriptionSaved?: () => void | Promise<void>;
};

export type FolderDetailsProps = {
  folder: FolderRow;
  onDescriptionSaved?: () => void | Promise<void>;
};

export function prettyType(mime: string): string {
  if (!mime) return "Unknown type";
  if (mime === "application/pdf") return "PDF document";
  if (mime.startsWith("image/")) return "Image";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "Word document";
  if (mime === "application/msword") return "Word document";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return "PowerPoint";
  if (mime === "application/vnd.ms-powerpoint") return "PowerPoint";
  return mime;
}

export function FileDetails({
  doc,
  previewUrl,
  previewLoading,
  formatSize,
  status,
  onDescriptionSaved,
}: FileDetailsProps) {
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(doc.description || "");
  const [savingDescription, setSavingDescription] = useState(false);

  useEffect(() => {
    setDescription(doc.description || "");
    setEditingDescription(false);
  }, [doc.id, doc.description]);

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      await api.patch(`/documents/${doc.id}`, { description });
      setEditingDescription(false);
      if (onDescriptionSaved) await onDescriptionSaved();
    } catch (e) {
      console.error(e);
      alert("Failed to save description");
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <>
      <p className="mb-1 text-sm font-medium text-slate-100">
        {doc.title || doc.original_filename}
      </p>
      <p className="mb-3 text-[11px] text-slate-400">
        {prettyType(doc.mime_type)} · {formatSize(doc.size_bytes)}
      </p>

      <div className="mb-3">
        <div className="mb-2 h-40 overflow-hidden rounded-md border border-slate-800 bg-slate-950/60">
          {previewLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-full w-full"
              title="Preview"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
              No preview available
            </div>
          )}
        </div>
        {previewUrl && !previewLoading && (
          <button
            type="button"
            className="text-[11px] text-sky-400 hover:text-sky-300"
            onClick={() => setPreviewModalOpen(true)}
          >
            View larger
          </button>
        )}
      </div>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Description
        </p>
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={savingDescription}
            />
            <div className="flex gap-2">
              <button
                className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-60"
                onClick={handleSaveDescription}
                disabled={savingDescription}
              >
                {savingDescription ? "Saving..." : "Save"}
              </button>
              <button
                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setDescription(doc.description || "");
                  setEditingDescription(false);
                }}
                disabled={savingDescription}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-xs text-slate-300">
              {doc.description || (
                <span className="text-slate-500">No description.</span>
              )}
            </p>
            <button
              className="text-[11px] text-sky-400 hover:text-sky-300"
              onClick={() => setEditingDescription(true)}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 space-y-1 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          File info
        </p>
        {status && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Status:</span>
            <span className="text-slate-200 capitalize">{status}</span>
          </div>
        )}
        {(doc as any).owner?.name && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Owner:</span>
            <span className="text-slate-200">{(doc as any).owner.name}</span>
          </div>
        )}
        {(doc as any).uploadedBy?.name && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Uploaded by:</span>
            <span className="text-slate-200">
              {(doc as any).uploadedBy.name}
            </span>
          </div>
        )}
        {doc.uploaded_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Uploaded:</span>
            <span className="text-slate-200">
              {new Date(doc.uploaded_at).toLocaleString()}
            </span>
          </div>
        )}
        {(doc as any).created_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Created:</span>
            <span className="text-slate-200">
              {new Date((doc as any).created_at).toLocaleString()}
            </span>
          </div>
        )}
        {(doc as any).updated_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Modified:</span>
            <span className="text-slate-200">
              {new Date((doc as any).updated_at).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <FileCommentsSection documentId={doc.id} />

      <Modal
        open={previewModalOpen}
        title={doc.title || doc.original_filename || "Preview"}
        onClose={() => setPreviewModalOpen(false)}
      >
        {previewUrl ? (
          <div className="h-[80vh] w-full">
            <iframe
              src={previewUrl}
              className="h-full w-full rounded-md border border-slate-800"
              title="Preview (large)"
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500">No preview available.</p>
        )}
      </Modal>
    </>
  );
}

export function FolderDetails({
  folder,
  onDescriptionSaved,
}: FolderDetailsProps) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(
    (folder as any).description || ""
  );
  const [savingDescription, setSavingDescription] = useState(false);

  useEffect(() => {
    setDescription((folder as any).description || "");
    setEditingDescription(false);
  }, [folder.id, (folder as any).description]);

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      await api.patch(`/folders/${folder.id}`, { description });
      setEditingDescription(false);
      if (onDescriptionSaved) await onDescriptionSaved();
    } catch (e) {
      console.error(e);
      alert("Failed to save description");
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <>
      <p className="mb-1 text-sm font-medium text-slate-100">{folder.name}</p>
      <p className="mb-3 text-[11px] text-slate-400">Folder</p>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Description
        </p>
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={savingDescription}
            />
            <div className="flex gap-2">
              <button
                className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-60"
                onClick={handleSaveDescription}
                disabled={savingDescription}
              >
                {savingDescription ? "Saving..." : "Save"}
              </button>
              <button
                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setDescription((folder as any).description || "");
                  setEditingDescription(false);
                }}
                disabled={savingDescription}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-xs text-slate-300">
              {(folder as any).description || (
                <span className="text-slate-500">No description.</span>
              )}
            </p>
            <button
              className="text-[11px] text-sky-400 hover:text-sky-300"
              onClick={() => setEditingDescription(true)}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 space-y-1 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Folder info
        </p>
        {(folder as any).owner?.name && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Owner:</span>
            <span className="text-slate-200">{(folder as any).owner.name}</span>
          </div>
        )}
        {(folder as any).created_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Created:</span>
            <span className="text-slate-200">
              {new Date((folder as any).created_at).toLocaleString()}
            </span>
          </div>
        )}
        {(folder as any).updated_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Modified:</span>
            <span className="text-slate-200">
              {new Date((folder as any).updated_at).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export function DepartmentDetails({ selectedItem }: { selectedItem: Item }) {
  const dept = selectedItem.data as any;
  return (
    <>
      <p className="mb-1 text-sm font-medium text-slate-100">{dept.name}</p>
      <p className="mb-3 text-[11px] text-slate-400">Department</p>
      <p className="text-[11px] text-slate-500">
        Departments are administrative containers. File/folder counts and
        detailed stats can be shown here.
      </p>
    </>
  );
}

type CommentDto = {
  id: number;
  body: string;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
};

function FileCommentsSection({ documentId }: { documentId: number }) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      try {
        const res = await api.get<CommentDto[]>(
          `/documents/${documentId}/comments`
        );
        setComments(res.data);
      } catch (e) {
        console.error(e);
        setComments([]);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [documentId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post<CommentDto>(
        `/documents/${documentId}/comments`,
        {
          body: newComment.trim(),
        }
      );
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch (e) {
      console.error(e);
      alert("Failed to add comment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-3 border-t border-slate-800 pt-2">
      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        Comments
      </p>

      <div className="mb-2 h-40 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
        {loading ? (
          <div className="py-3 text-center text-[11px] text-slate-500">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-slate-500">
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
              <div className="whitespace-pre-wrap text-slate-100">{c.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button
          className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-60"
          disabled={!newComment.trim() || submitting}
          onClick={handleAddComment}
        >
          {submitting ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
