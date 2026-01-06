// src/features/documents/pages/TrashPage.tsx
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { notify } from "../../../lib/notify";
// No longer using DocumentRow / FolderRow directly here
// import type { DocumentRow, FolderRow } from "../../../types/documents";
import { useOutletContext } from "react-router-dom";

type LayoutContext = {
  user: {
    id: number;
    name: string;
    email: string;
    department_id: number | null;
    role?: { id: number; name: string } | null;
  };
  isAdmin: boolean;
  isSuperAdmin: boolean;
};
type TrashFolderRow = {
  kind: "folder";
  id: number;
  name: string;
  department_name?: string | null;
  owner_name?: string | null;
};

type TrashDocumentRow = {
  kind: "document";
  id: number;
  name: string;
  folder_name?: string | null;
  department_name?: string | null;
  owner_name?: string | null;
};

type TrashRow = TrashFolderRow | TrashDocumentRow;

type FolderContents = {
  folder: {
    id: number;
    name: string;
    department_name?: string | null;
    owner_name?: string | null;
  };
  folders: {
    id: number;
    name: string;
    department_name?: string | null;
    owner_name?: string | null;
  }[];
  documents: {
    id: number;
    title: string | null;
    original_filename: string;
    department_name?: string | null;
    owner_name?: string | null;
  }[];
};

export default function TrashPage() {
  const { isSuperAdmin } = useOutletContext<LayoutContext>();

  const [items, setItems] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contentsModalOpen, setContentsModalOpen] = useState(false);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [contentsError, setContentsError] = useState<string | null>(null);
  const [contents, setContents] = useState<FolderContents | null>(null);

  const loadTrash = async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersRes, docsRes] = await Promise.all([
        api.get("/trash/folders"),
        api.get("/trash/documents"),
      ]);

      // Folders: API is paginated, so data may be under .data.data or .data
      const foldersData = foldersRes.data.data ?? foldersRes.data ?? [];
      const docsData = docsRes.data.data ?? docsRes.data ?? [];

      const folderRows: TrashFolderRow[] = foldersData.map((f: any) => ({
        kind: "folder",
        id: f.id,
        name: f.name,
        department_name: f.department?.name ?? f.department_name ?? null,
        owner_name: f.owner?.name ?? f.owner_name ?? null,
      }));

      const docRows: TrashDocumentRow[] = docsData.map((d: any) => ({
        kind: "document",
        id: d.id,
        name: d.title || d.original_filename,
        folder_name: d.folder?.name ?? d.folder_name ?? null,
        department_name: d.department?.name ?? d.department_name ?? null,
        owner_name: d.owner?.name ?? d.owner_name ?? null,
      }));

      // Mixed list: folders first, then documents (you can tweak this later)
      setItems([...folderRows, ...docRows]);
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to load trash.";
      setError(msg);
      notify(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestoreDocument = async (doc: {
    id: number;
    title: string | null;
    original_filename: string;
  }) => {
    if (
      !window.confirm(
        `Restore document "${doc.title || doc.original_filename}"?`
      )
    ) {
      return;
    }

    try {
      await api.post(`/documents/${doc.id}/restore`);
      notify("Document restored.", "success");
      await loadTrash();
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to restore document.";
      notify(msg, "error");
    }
  };

  const handleDeleteDocument = async (doc: {
    id: number;
    title: string | null;
    original_filename: string;
  }) => {
    if (!isSuperAdmin) return;

    if (
      !window.confirm(
        `Permanently delete document "${
          doc.title || doc.original_filename
        }"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/documents/${doc.id}`);
      notify("Document permanently deleted.", "success");
      await loadTrash();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.message || "Failed to permanently delete document.";
      notify(msg, "error");
    }
  };

  const handleRestoreFolder = async (folder: { id: number; name: string }) => {
    if (
      !window.confirm(`Restore folder "${folder.name}" and all its contents?`)
    ) {
      return;
    }

    try {
      await api.post(`/folders/${folder.id}/restore`);
      notify("Folder restored.", "success");
      await loadTrash();
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to restore folder.";
      notify(msg, "error");
    }
  };

  const handleDeleteFolder = async (folder: { id: number; name: string }) => {
    if (!isSuperAdmin) return;

    if (
      !window.confirm(
        `Permanently delete folder "${folder.name}" and ALL its contents? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/folders/${folder.id}`);
      notify("Folder permanently deleted.", "success");
      await loadTrash();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.message || "Failed to permanently delete folder.";
      notify(msg, "error");
    }
  };

  const openFolderContents = async (folderId: number) => {
    setContentsModalOpen(true);
    setContentsLoading(true);
    setContentsError(null);
    setContents(null);

    try {
      const res = await api.get(`/trash/folders/${folderId}/contents`);
      const data: FolderContents = res.data;
      setContents(data);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Failed to load folder contents.";
      setContentsError(msg);
      notify(msg, "error");
    } finally {
      setContentsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-white">Trash</h1>
      <div className="mb-3 flex items-center gap-2 text-xs">
        <Button
          size="xs"
          variant="secondary"
          onClick={loadTrash}
          disabled={loading}
        >
          {loading ? "Reloading…" : "Reload"}
        </Button>
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>

      <div className="flex flex-col gap-4 text-xs text-slate-200">
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
            Trash items
          </p>
          {items.length === 0 ? (
            <p className="text-[11px] text-slate-500">No items in trash.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Folder</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((item) => (
                    <tr
                      key={`${item.kind}-${item.id}`}
                      className={
                        item.kind === "folder"
                          ? "cursor-pointer hover:bg-slate-800/60"
                          : ""
                      }
                      onClick={() => {
                        if (item.kind === "folder") {
                          openFolderContents(item.id);
                        }
                      }}
                    >
                      {" "}
                      {/* Item name + icon */}
                      <td className="py-2 pr-3 text-slate-100">
                        {item.kind === "folder" ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-sky-300 hover:text-sky-200"
                            onClick={() => openFolderContents(item.id)}
                          >
                            <span>📁</span>
                            <span>{item.name}</span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span>📄</span>
                            <span>{item.name}</span>
                          </span>
                        )}
                      </td>
                      {/* Type */}
                      <td className="py-2 pr-3 text-slate-300 capitalize">
                        {item.kind}
                      </td>
                      {/* Folder column (only meaningful for docs) */}
                      <td className="py-2 pr-3 text-slate-300">
                        {"folder_name" in item ? item.folder_name || "—" : "—"}
                      </td>
                      {/* Department */}
                      <td className="py-2 pr-3 text-slate-300">
                        {item.department_name || "Unknown"}
                      </td>
                      {/* Owner */}
                      <td className="py-2 pr-3 text-slate-300">
                        {item.owner_name || "Unknown"}
                      </td>
                      {/* Actions */}
                      <td className="py-2 pr-3">
                        {item.kind === "folder" ? (
                          <div className="flex gap-2">
                            <Button
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreFolder({
                                  id: item.id,
                                  name: item.name,
                                });
                              }}
                            >
                              Restore
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder({
                                    id: item.id,
                                    name: item.name,
                                  });
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreDocument({
                                  id: item.id,
                                  title: item.name,
                                  original_filename: item.name,
                                });
                              }}
                            >
                              Restore
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDocument({
                                    id: item.id,
                                    title: item.name,
                                    original_filename: item.name,
                                  });
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {contentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs text-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">
                  Folder contents in trash
                </p>
                <p className="text-sm font-semibold text-white">
                  {contents?.folder.name ?? "Folder"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {contents?.folder.department_name || "Unknown"} ·{" "}
                  {contents?.folder.owner_name || "Unknown"}
                </p>
              </div>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => setContentsModalOpen(false)}
              >
                Close
              </Button>
            </div>

            {contentsLoading ? (
              <p className="text-[11px] text-slate-400">Loading…</p>
            ) : contentsError ? (
              <p className="text-[11px] text-red-400">{contentsError}</p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
                {/* Subfolders */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                    Subfolders
                  </p>
                  {contents && contents.folders.length > 0 ? (
                    <ul className="space-y-1">
                      {contents.folders.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1 text-slate-100">
                            <span>📁</span>
                            <span>{f.name}</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {f.department_name || "Unknown"} ·{" "}
                            {f.owner_name || "Unknown"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      No trashd subfolders.
                    </p>
                  )}
                </div>

                {/* Documents */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                    Documents
                  </p>
                  {contents && contents.documents.length > 0 ? (
                    <ul className="space-y-1">
                      {contents.documents.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1 text-slate-100">
                            <span>📄</span>
                            <span>{d.title || d.original_filename}</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {d.department_name || "Unknown"} ·{" "}
                            {d.owner_name || "Unknown"}
                          </span>
                          <span className="flex gap-1">
                            <Button
                              size="xs" // assuming you have this, else use xs
                              onClick={() =>
                                handleRestoreDocument({
                                  id: d.id,
                                  title: d.title,
                                  original_filename: d.original_filename,
                                })
                              }
                            >
                              Restore
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() =>
                                  handleDeleteDocument({
                                    id: d.id,
                                    title: d.title,
                                    original_filename: d.original_filename,
                                  })
                                }
                              >
                                Delete
                              </Button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      No trashd documents.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
