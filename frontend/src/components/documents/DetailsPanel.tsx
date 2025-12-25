// src/components/documents/DetailsPanel.tsx
import { useEffect, useState } from "react";
import { IconButton } from "../ui/IconButton";
import Modal from "../Modal";
import { api } from "../../lib/api";
import type { Item, DocumentRow, FolderRow } from "../../types/documents";


type Props = {
  open: boolean;
  selectedItem: Item | null;
  previewUrl: string | null;
  previewLoading?: boolean;
  formatSize: (bytes: number) => string;
  onClose: () => void;
  canEditAccess?: boolean;
  onAccessChanged?: () => void | Promise<void>;
  width?: number;
  onResizeStart?: () => void;
};

type ShareRecord = {
  id: number;
  owner_id: number;
  target_user_id: number;
  permission: "viewer" | "editor" | string;
  document_id: number | null;
  folder_id: number | null;
  owner?: { id: number; name: string };
  target_user?: { id: number; name: string; email: string };
};

function prettyType(mime: string): string {
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

export function DetailsPanel({
  open,
  selectedItem,
  previewUrl,
  previewLoading = false,
  formatSize,
  onClose,
  canEditAccess = true,
  onAccessChanged,
  width = 320,
  onResizeStart,
}: Props) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "activity">("details");
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [sharesError, setSharesError] = useState<string | null>(null);
  const [sharesLoading, setSharesLoading] = useState(false);

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !selectedItem) {
      setShares([]);
      setSharesError(null);
      setSharesLoading(false);
      return;
    }

    if (selectedItem.kind === "department") {
      setShares([]);
      setSharesError(null);
      setSharesLoading(false);
      return;
    }

    const type = selectedItem.kind === "file" ? "document" : "folder";
    const itemId = (selectedItem.data as any).id;

    const fetchShares = async () => {
      setSharesError(null);
      setSharesLoading(true);
      try {
        const res = await api.get(`/items/${type}/${itemId}/shares`);
        const data: ShareRecord[] = res.data.data ?? res.data;
        setShares(data);
      } catch (e) {
        console.error(e);
        setSharesError("Failed to load people with access.");
        setShares([]);
      } finally {
        setSharesLoading(false);
      }
    };

    fetchShares();
  }, [open, selectedItem]);

  if (!open) return null;

  const isFile = selectedItem?.kind === "file";
  const isFolder = selectedItem?.kind === "folder";

  return (
    <div className="flex h-full shrink-0 items-stretch">
      <div
        className="w-[3px] cursor-col-resize bg-slate-900/80 border-l border-slate-800 hover:bg-sky-600"
        onMouseDown={onResizeStart}
      />
      <aside
        className="flex shrink-0 flex-col border border-l-0 border-slate-800 bg-slate-900/80 rounded-l-none rounded-r-lg"
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <div className="flex items-center gap-3 text-xs">
            <button
              className={
                activeTab === "details"
                  ? "border-b border-sky-500 pb-1 text-slate-100"
                  : "pb-1 text-slate-400 hover:text-slate-200"
              }
              onClick={() => setActiveTab("details")}
            >
              Details
            </button>
            <button
              className={
                activeTab === "activity"
                  ? "border-b border-sky-500 pb-1 text-slate-100"
                  : "pb-1 text-slate-400 hover:text-slate-200"
              }
              onClick={() => setActiveTab("activity")}
            >
              Activity
            </button>
          </div>
          <IconButton size="xs" variant="ghost" onClick={onClose}>
            ✕
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 text-xs">
          {!selectedItem ? (
            <p className="text-xs text-slate-500">
              Select an item to see details.
            </p>
          ) : activeTab === "details" ? (
            isFile ? (
              <FileDetails
                doc={selectedItem.data as DocumentRow}
                previewUrl={previewUrl}
                previewLoading={previewLoading}
                formatSize={formatSize}
                onOpenShare={() => setShareModalOpen(true)}
                canEditAccess={canEditAccess}
                shares={shares}
                sharesError={sharesError}
                sharesLoading={sharesLoading}
                onDescriptionSaved={onAccessChanged}
              />
            ) : isFolder ? (
              <FolderDetails
                folder={selectedItem.data as FolderRow}
                onOpenShare={() => setShareModalOpen(true)}
                canEditAccess={canEditAccess}
                shares={shares}
                sharesError={sharesError}
                sharesLoading={sharesLoading}
                onDescriptionSaved={onAccessChanged}
              />
            ) : (
              <DepartmentDetails selectedItem={selectedItem} />
            )
          ) : (
            <ActivityPlaceholder selectedItem={selectedItem} />
          )}
        </div>

        {selectedItem && (isFile || isFolder) && (
          <ShareModal
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            item={selectedItem}
            canEditAccess={canEditAccess}
            onAccessChanged={onAccessChanged}
          />
        )}
      </aside>
    </div>
  );
}

// ========== FILE DETAILS ==========

type FileDetailsProps = {
  doc: DocumentRow;
  previewUrl: string | null;
  previewLoading: boolean;
  formatSize: (bytes: number) => string;
  onOpenShare: () => void;
  canEditAccess: boolean;
  shares: ShareRecord[];
  sharesError: string | null;
  sharesLoading: boolean;
  onDescriptionSaved?: () => void | Promise<void>;
};

function FileDetails({
  doc,
  previewUrl,
  previewLoading,
  formatSize,
  onOpenShare,
  canEditAccess,
  shares,
  sharesError,
  sharesLoading,
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
            {canEditAccess && (
              <button
                className="text-[11px] text-sky-400 hover:text-sky-300"
                onClick={() => setEditingDescription(true)}
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mb-3 space-y-1 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          File info
        </p>
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

      <div className="border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Access
        </p>
        {canEditAccess && (
          <button
            className="mb-3 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-white hover:bg-slate-800"
            onClick={onOpenShare}
          >
            Share…
          </button>
        )}
        <PeopleWithAccess
          shares={shares}
          error={sharesError}
          loading={sharesLoading}
        />
      </div>

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

// ========== FOLDER DETAILS ==========

type FolderDetailsProps = {
  folder: FolderRow;
  onOpenShare: () => void;
  canEditAccess: boolean;
  shares: ShareRecord[];
  sharesError: string | null;
  sharesLoading: boolean;
  onDescriptionSaved?: () => void | Promise<void>;
};

function FolderDetails({
  folder,
  onOpenShare,
  canEditAccess,
  shares,
  sharesError,
  sharesLoading,
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
            {canEditAccess && (
              <button
                className="text-[11px] text-sky-400 hover:text-sky-300"
                onClick={() => setEditingDescription(true)}
              >
                Edit
              </button>
            )}
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

      <div className="border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Access
        </p>
        {canEditAccess && (
          <button
            className="mb-3 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-white hover:bg-slate-800"
            onClick={onOpenShare}
          >
            Share…
          </button>
        )}
        <PeopleWithAccess
          shares={shares}
          error={sharesError}
          loading={sharesLoading}
        />
      </div>
    </>
  );
}

// ========== DEPARTMENT DETAILS ==========

function DepartmentDetails({ selectedItem }: { selectedItem: Item }) {
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

// ========== ACTIVITY TAB ==========

function ActivityPlaceholder({ selectedItem }: { selectedItem: Item }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedItem.kind === "department") {
      setActivities([]);
      return;
    }

    const fetchActivities = async () => {
      setLoading(true);
      setError(null);

      const type = selectedItem.kind === "file" ? "documents" : "folders";
      const id = (selectedItem.data as any).id;

      try {
        const res = await api.get(`/${type}/${id}/activity`);
        const data = res.data.data ?? res.data;
        setActivities(data);
      } catch (e) {
        console.error(e);
        setError("Failed to load activity");
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [selectedItem]);

  const label =
    selectedItem.kind === "file"
      ? "This file"
      : selectedItem.kind === "folder"
      ? "This folder"
      : "This department";

  return (
    <div className="text-xs">
      <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
        Activity
      </p>

      {selectedItem.kind === "department" ? (
        <p className="text-[11px] text-slate-500">
          Departments don't have activity logs. Select a file or folder.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        </div>
      ) : error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : activities.length === 0 ? (
        <p className="text-[11px] text-slate-500">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {activities.map((activity: any) => {
            const userName = activity.user?.name || `User #${activity.user_id}`;
            const timestamp = new Date(activity.created_at).toLocaleString();
            const actionLabel =
              activity.action.charAt(0).toUpperCase() +
              activity.action.slice(1);

            return (
              <li
                key={activity.id}
                className="border-l-2 border-slate-700 pl-2"
              >
                <p className="text-xs text-slate-200">
                  <span className="font-medium">{userName}</span>{" "}
                  {actionLabel.toLowerCase()}
                </p>
                {activity.details && (
                  <p className="text-[11px] text-slate-400">
                    {activity.details}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">{timestamp}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ========== PEOPLE WITH ACCESS ==========

function PeopleWithAccess({
  shares,
  error,
  loading,
}: {
  shares: ShareRecord[];
  error: string | null;
  loading: boolean;
}) {
  return (
    <div className="mt-1">
      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        People with access
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        </div>
      ) : error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : shares.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          No one else has access yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {shares.map((s) => {
            const target = s.target_user;
            const label = target
              ? `${target.name} (${target.email})`
              : `User #${s.target_user_id}`;
            const permLabel = s.permission === "editor" ? "Editor" : "Viewer";
            return (
              <li key={s.id} className="flex flex-col">
                <span className="text-xs text-slate-200">{label}</span>
                <span className="text-[11px] text-slate-500">{permLabel}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ========== SHARE MODAL ==========

type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  item: Item;
  canEditAccess: boolean;
  onAccessChanged?: () => void | Promise<void>;
};

function ShareModal({
  open,
  onClose,
  item,
  canEditAccess,
  onAccessChanged,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"viewer" | "editor">("viewer");
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const type = item.kind === "file" ? "document" : "folder";
  const itemId = (item.data as any).id;

  useEffect(() => {
    if (!open) return;
    const fetchShares = async () => {
      setError(null);
      try {
        const res = await api.get(`/items/${type}/${itemId}/shares`);
        const data: ShareRecord[] = res.data.data ?? res.data;
        setShares(data);
      } catch (e) {
        console.error(e);
        setError("Failed to load shares.");
      }
    };
    fetchShares();
  }, [open, type, itemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditAccess) return;
    if (!email.trim()) {
      setError("Enter an email.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/shares", {
        type,
        item_id: itemId,
        email: email.trim(),
        permission,
      });
      const created: ShareRecord = res.data;
      setShares((prev) => {
        const existingIndex = prev.findIndex(
          (s) =>
            s.id === created.id ||
            (s.target_user_id === created.target_user_id &&
              s.document_id === created.document_id &&
              s.folder_id === created.folder_id)
        );
        if (existingIndex >= 0) {
          const copy = [...prev];
          copy[existingIndex] = created;
          return copy;
        }
        return [...prev, created];
      });
      setEmail("");
      if (onAccessChanged) await onAccessChanged();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to share item.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (shareId: number) => {
    if (!canEditAccess) return;
    setError(null);
    try {
      await api.delete(`/shares/${shareId}`);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      if (onAccessChanged) await onAccessChanged();
    } catch (e) {
      console.error(e);
      setError("Failed to remove access.");
    }
  };

  const itemName =
    item.kind === "file"
      ? (item.data as DocumentRow).title ||
        (item.data as DocumentRow).original_filename
      : (item.data as any).name;

  return (
    <Modal open={open} title={`Share "${itemName}"`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {error && <p className="text-[11px] text-red-400">{error}</p>}
        {canEditAccess && (
          <>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase text-slate-400">
                Invite by email
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase text-slate-400">
                Permission
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                value={permission}
                onChange={(e) =>
                  setPermission(e.target.value as "viewer" | "editor")
                }
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-sky-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-60"
              >
                {loading ? "Sharing…" : "Share"}
              </button>
            </div>
          </>
        )}
      </form>

      <div className="mt-4 border-t border-slate-800 pt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
          People with access
        </p>
        {shares.length === 0 ? (
          <p className="text-xs text-slate-500">No one else has access yet.</p>
        ) : (
          <ul className="space-y-1">
            {shares.map((s) => {
              const target = s.target_user;
              const label = target
                ? `${target.name} (${target.email})`
                : `User #${s.target_user_id}`;
              const permLabel = s.permission === "editor" ? "Editor" : "Viewer";
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-200">{label}</span>
                    <span className="text-[11px] text-slate-500">
                      {permLabel}
                    </span>
                  </div>
                  {canEditAccess && (
                    <button
                      className="text-[11px] text-red-400 hover:underline"
                      onClick={() => handleRemove(s.id)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
