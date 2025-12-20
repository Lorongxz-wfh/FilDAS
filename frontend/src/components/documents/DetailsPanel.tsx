// src/components/documents/DetailsPanel.tsx
import { useEffect, useState } from "react";
import { IconButton } from "../ui/IconButton";
import Modal from "../Modal";
import { api } from "../../lib/api";
import type { Item, DocumentRow } from "../../types/documents";

type Props = {
  open: boolean;
  selectedItem: Item | null;
  previewUrl: string | null;
  formatSize: (bytes: number) => string;
  onClose: () => void;
  canEditAccess?: boolean; // owner/admin can edit, others read-only
  onAccessChanged?: () => void | Promise<void>; // NEW: refresh hook
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

export function DetailsPanel({
  open,
  selectedItem,
  previewUrl,
  formatSize,
  onClose,
  canEditAccess = true,
  onAccessChanged,
}: Props) {
  const [shareModalOpen, setShareModalOpen] = useState(false);

  if (!open) return null;

  const isFile = selectedItem?.kind === "file";
  const isContainer =
    selectedItem?.kind === "department" || selectedItem?.kind === "folder";

  return (
    <aside className="w-80 shrink-0 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase text-slate-400">
          Details
        </p>
        <IconButton size="xs" variant="ghost" onClick={onClose}>
          ✕
        </IconButton>
      </div>

      {!selectedItem ? (
        <p className="text-xs text-slate-500">
          Select a department, folder, or file to see details.
        </p>
      ) : isFile ? (
        <FileDetails
          doc={selectedItem.data as DocumentRow}
          previewUrl={previewUrl}
          formatSize={formatSize}
          onOpenShare={() => setShareModalOpen(true)}
          canEditAccess={canEditAccess}
        />
      ) : (
        <ContainerDetails
          selectedItem={selectedItem}
          onOpenShare={
            selectedItem.kind === "folder" && canEditAccess
              ? () => setShareModalOpen(true)
              : undefined
          }
          canEditAccess={canEditAccess}
        />
      )}

      {selectedItem && (isFile || selectedItem.kind === "folder") && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          item={selectedItem}
          canEditAccess={canEditAccess}
          onAccessChanged={onAccessChanged} // pass through
        />
      )}
    </aside>
  );
}

type FileDetailsProps = {
  doc: DocumentRow;
  previewUrl: string | null;
  formatSize: (bytes: number) => string;
  onOpenShare: () => void;
  canEditAccess: boolean;
};

function FileDetails({
  doc,
  previewUrl,
  formatSize,
  onOpenShare,
  canEditAccess,
}: FileDetailsProps) {
  return (
    <>
      <p className="mb-1 text-sm text-slate-100">
        {doc.title || doc.original_filename}
      </p>
      <p className="mb-2 text-slate-400">
        {doc.mime_type} · {formatSize(doc.size_bytes)}
      </p>

      <div className="mb-3 h-40 overflow-hidden rounded-md border border-slate-800 bg-slate-950/60">
        {previewUrl ? (
          <iframe src={previewUrl} className="h-full w-full" title="Preview" />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
            No preview available.
          </div>
        )}
      </div>

      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        Activity
      </p>
      <p className="mb-3 text-slate-500">
        Activity log placeholder (viewed, edited, shared…).
      </p>

      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        Access
      </p>
      <p className="mb-2 text-slate-500">
        {canEditAccess
          ? "Manage who can view or edit this file."
          : "You can view who has access, but only the owner can change it."}
      </p>
      {canEditAccess && (
        <button
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-white hover:bg-slate-800"
          onClick={onOpenShare}
        >
          Share…
        </button>
      )}
    </>
  );
}

type ContainerDetailsProps = {
  selectedItem: Item;
  onOpenShare?: () => void;
  canEditAccess: boolean;
};

function ContainerDetails({
  selectedItem,
  onOpenShare,
  canEditAccess,
}: ContainerDetailsProps) {
  const name = (selectedItem.data as any).name;

  return (
    <>
      <p className="mb-1 text-sm text-slate-100">{name}</p>
      <p className="mb-2 text-slate-400">
        {selectedItem.kind === "department" ? "Department" : "Folder"}
      </p>

      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        Details
      </p>
      <p className="mb-3 text-slate-500">
        Nested folder and file counts can be shown here later.
      </p>

      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        Access
      </p>
      <p className="mb-2 text-slate-500">
        {selectedItem.kind === "department"
          ? "Departments are not directly shareable."
          : canEditAccess
          ? "Manage who can view or edit this folder."
          : "Only the owner can change access to this folder."}
      </p>

      {selectedItem.kind === "folder" && onOpenShare && canEditAccess && (
        <button
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-white hover:bg-slate-800"
          onClick={onOpenShare}
        >
          Share…
        </button>
      )}
    </>
  );
}

type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  item: Item;
  canEditAccess: boolean;
  onAccessChanged?: () => void | Promise<void>; // NEW
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

      // NEW: tell parent to refresh folder contents if needed
      if (onAccessChanged) {
        await onAccessChanged();
      }
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

      // NEW: refresh folder contents after removing access
      if (onAccessChanged) {
        await onAccessChanged();
      }
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
    <Modal open={open} title={`Share “${itemName}”`} onClose={onClose}>
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
