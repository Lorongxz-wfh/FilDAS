// src/components/documents/DetailsPanel.tsx
import { useEffect, useState } from "react";
import { IconButton } from "../ui/IconButton";
import Modal from "../Modal";
import { api } from "../../lib/api";
import type { Item, DocumentRow, FolderRow } from "../../types/documents";
import {
  FileDetails,
  FolderDetails,
  DepartmentDetails,
} from "./DetailsPanelSections";

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
  permission: "viewer" | "contributor" | "editor" | string;
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
  const [activeTab, setActiveTab] = useState<
    "details" | "activity" | "sharing"
  >("details");
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [sharesError, setSharesError] = useState<string | null>(null);
  const [sharesLoading, setSharesLoading] = useState(false);

  useEffect(() => {
    if (!open || !selectedItem) {
      setShares([]);
      setSharesError(null);
      setSharesLoading(false);
      return;
    }

    // Departments don't have direct shares
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
            <button
              className={
                activeTab === "sharing"
                  ? "border-b border-sky-500 pb-1 text-slate-100"
                  : "pb-1 text-slate-400 hover:text-slate-200"
              }
              onClick={() => setActiveTab("sharing")}
            >
              Sharing
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
                status={(selectedItem.data as any).status}
                onDescriptionSaved={onAccessChanged}
              />
            ) : isFolder ? (
              <FolderDetails
                folder={selectedItem.data as FolderRow}
                onDescriptionSaved={onAccessChanged}
              />
            ) : (
              <DepartmentDetails selectedItem={selectedItem} />
            )
          ) : activeTab === "activity" ? (
            <ActivityPlaceholder selectedItem={selectedItem} />
          ) : (
            <SharingTab
              selectedItem={selectedItem}
              canEditAccess={canEditAccess}
              onOpenShare={() => setShareModalOpen(true)}
              shares={shares}
              sharesError={sharesError}
              sharesLoading={sharesLoading}
            />
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


// ========== ACTIVITY TAB ==========

function ActivityPlaceholder({ selectedItem }: { selectedItem: Item }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      setError(null);

      try {
        let url: string;

        if (selectedItem.kind === "department") {
          const id = (selectedItem.data as any).id;
          url = `/departments/${id}/activity`;
        } else {
          const type = selectedItem.kind === "file" ? "documents" : "folders";
          const id = (selectedItem.data as any).id;
          url = `/${type}/${id}/activity`;
        }

        const res = await api.get(url);
        const data = res.data as any[];
        setActivities(data);
      } catch (e) {
        console.error(e);
        setError("Failed to load activity");
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [selectedItem]);

  return (
    <div className="text-xs">
      <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
        Activity
      </p>

      {loading ? (
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

// ========== SHARING TAB ==========

function SharingTab({
  selectedItem,
  canEditAccess,
  onOpenShare,
  shares,
  sharesError,
  sharesLoading,
}: {
  selectedItem: Item;
  canEditAccess: boolean;
  onOpenShare: () => void;
  shares: ShareRecord[];
  sharesError: string | null;
  sharesLoading: boolean;
}) {
  if (selectedItem.kind === "department") {
    return (
      <p className="text-[11px] text-slate-500">
        Sharing is managed at the folder and file level. Select a folder or
        file.
      </p>
    );
  }

  return (
    <div className="text-xs">
      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        Sharing
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
            const rawPerm = (s.permission || "").toString().toLowerCase();
            const permLabel =
              rawPerm === "editor"
                ? "Editor"
                : rawPerm === "contributor"
                ? "Contributor"
                : "Viewer";

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
  const [permission, setPermission] = useState<
    "viewer" | "contributor" | "editor"
  >("viewer");
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

  const handleUpdatePermission = async (
    shareId: number,
    newPermission: "viewer" | "contributor" | "editor"
  ) => {
    if (!canEditAccess) return;
    setError(null);

    try {
      const res = await api.patch(`/shares/${shareId}`, {
        permission: newPermission,
      });
      const updated: ShareRecord = res.data;

      setShares((prev) => prev.map((s) => (s.id === shareId ? updated : s)));
      if (onAccessChanged) await onAccessChanged();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to update permission.";
      setError(msg);
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
                  setPermission(
                    e.target.value as "viewer" | "contributor" | "editor"
                  )
                }
              >
                <option value="viewer">Viewer</option>
                <option value="contributor">Contributor</option>
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
              const rawPerm = (s.permission || "").toString().toLowerCase();
              const permValue =
                rawPerm === "editor"
                  ? "editor"
                  : rawPerm === "contributor"
                  ? "contributor"
                  : "viewer";

              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-200">{label}</span>
                    {canEditAccess ? (
                      <select
                        className="rounded-md border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-300 hover:border-slate-600"
                        value={permValue}
                        onChange={(e) =>
                          handleUpdatePermission(
                            s.id,
                            e.target.value as
                              | "viewer"
                              | "contributor"
                              | "editor"
                          )
                        }
                      >
                        <option value="viewer">Viewer</option>
                        <option value="contributor">Contributor</option>
                        <option value="editor">Editor</option>
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {permValue === "editor"
                          ? "Editor"
                          : permValue === "contributor"
                          ? "Contributor"
                          : "Viewer"}
                      </span>
                    )}
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
