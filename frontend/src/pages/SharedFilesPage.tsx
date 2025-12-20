// src/pages/SharedFilesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useOutletContext } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { DetailsPanel } from "../components/documents/DetailsPanel";
import type { Item, DocumentRow as BaseDocumentRow } from "../types/documents";

type LayoutContext = {
  user: {
    id: number;
    name: string;
    email: string;
  };
  isAdmin: boolean;
};

type SortMode = "alpha" | "recent" | "ownerDept";
type ViewMode = "grid" | "list";

type DocumentRow = BaseDocumentRow & {
  folder_name?: string | null;
  department_name?: string | null;
  owner_name?: string | null;
  share_permission?: "viewer" | "editor" | string;
};

type SharedFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  department_name?: string | null;
  owner_id: number;
  owner_name?: string | null;
  permission: "viewer" | "editor" | string;
};

export default function SharedFilesPage() {
  const { user } = useOutletContext<LayoutContext>();

  // breadcrumb stack instead of single folder
  const [folderPath, setFolderPath] = useState<SharedFolder[]>([]);
  const currentFolder = folderPath.length
    ? folderPath[folderPath.length - 1]
    : null;

  const [folderDocs, setFolderDocs] = useState<DocumentRow[]>([]);
  const [folderChildren, setFolderChildren] = useState<SharedFolder[]>([]);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [folders, setFolders] = useState<SharedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // load contents of a shared folder (children + files)
  const loadSharedFolderContents = async (folder: SharedFolder) => {
    setLoading(true);
    setError(null);
    try {
      const [subFoldersRes, docsRes] = await Promise.all([
        api.get("/folders/shared", { params: { parent_id: folder.id } }),
        api.get("/documents/shared", { params: { folder_id: folder.id } }),
      ]);

      const subFolders: SharedFolder[] =
        subFoldersRes.data.data ?? subFoldersRes.data;
      const docs: DocumentRow[] = docsRes.data.data ?? docsRes.data;

      setFolderChildren(subFolders);
      setFolderDocs(docs);
    } catch (e) {
      console.error(e);
      setError("Failed to load folder contents.");
      setFolderChildren([]);
      setFolderDocs([]);
    } finally {
      setLoading(false);
    }
  };

  // load top-level shared items
  const loadTopLevelShared = async () => {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, foldersRes] = await Promise.all([
        api.get("/documents/shared"),
        api.get("/folders/shared"),
      ]);

      const foldersData = (foldersRes.data ?? []) as SharedFolder[];
      const docsData = (docsRes.data ?? []) as DocumentRow[];

      // Top-level docs: only those not in any folder
      const topLevelDocsRaw = docsData.filter((d) => !d.folder_id);

      const mappedDocs: DocumentRow[] = topLevelDocsRaw.map((d) => ({
        id: d.id,
        title: d.title,
        original_filename: d.original_filename,
        mime_type: d.mime_type,
        size_bytes: d.size_bytes,
        uploaded_at: d.uploaded_at,
        last_opened_at: d.last_opened_at ?? null,
        folder_id: d.folder_id ?? null,
        department_id: d.department_id,
        folder_name: d.folder_name ?? null,
        department_name: d.department_name ?? null,
        owner_id: d.owner_id ?? null,
        owner_name: d.owner_name ?? null,
        share_permission: d.share_permission,
      }));

      setDocuments(mappedDocs);
      setFolders(foldersData);
    } catch (e) {
      console.error(e);
      setError("Failed to load shared files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopLevelShared();
  }, []);

  const filteredSortedDocs = useMemo(() => {
    const sourceDocs = currentFolder ? folderDocs : documents;
    let list = [...sourceDocs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => {
        const name = (d.title || d.original_filename || "").toLowerCase();
        const dept = (d.department_name || "").toLowerCase();
        const owner = (d.owner_name || "").toLowerCase();
        return (
          name.includes(q) ||
          dept.includes(q) ||
          owner.includes(q) ||
          (d.folder_name || "").toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
      if (sortMode === "alpha") {
        const na = (a.title || a.original_filename || "").toLowerCase();
        const nb = (b.title || b.original_filename || "").toLowerCase();
        return na.localeCompare(nb);
      }
      if (sortMode === "ownerDept") {
        const da = (a.department_name || "").toLowerCase();
        const db = (b.department_name || "").toLowerCase();
        if (da === db) {
          const na = (a.title || a.original_filename || "").toLowerCase();
          const nb = (b.title || b.original_filename || "").toLowerCase();
          return na.localeCompare(nb);
        }
        return da.localeCompare(db);
      }
      const ta = new Date(a.uploaded_at).getTime();
      const tb = new Date(b.uploaded_at).getTime();
      return tb - ta;
    });

    return list;
  }, [documents, folderDocs, currentFolder, searchQuery, sortMode]);

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(1)} ${units[i]}`;
  };

  // full preview on demand
  const handleSelectDocument = (doc: DocumentRow) => {
    const item: Item = { kind: "file", data: doc as any };
    setSelectedItem(item);
    setDetailsOpen(true);

    const mime = doc.mime_type;
    if (
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/msword"
    ) {
      api
        .get(`/documents/${doc.id}/preview`)
        .then((res) => {
          const url = res.data.stream_url as string;
          setPreviewUrl(url);
        })
        .catch((e) => {
          console.error("Failed to load preview URL", e);
          setPreviewUrl(null);
        });
    } else {
      setPreviewUrl(null);
    }
  };

  const isOwner = (selectedItem?.data as any)?.owner_id === user.id;

  // open folder (navigate into it) – push to path
  const handleSelectFolder = (folder: SharedFolder) => {
    const item: Item = { kind: "folder", data: folder as any };
    setSelectedItem(item);
    setDetailsOpen(true);
    setPreviewUrl(null);
    setFolderPath((prev) => [...prev, folder]);
    loadSharedFolderContents(folder);
  };

  const handleBackToSharedList = () => {
    setFolderPath([]);
    setFolderChildren([]);
    setFolderDocs([]);
    setSelectedItem(null);
    setPreviewUrl(null);
    loadTopLevelShared();
  };

  const visibleFolders = currentFolder ? folderChildren : folders;

  // visual selection helper
  const isSelected = (kind: Item["kind"], id: number) => {
    if (!selectedItem) return false;
    if (selectedItem.kind !== kind) return false;
    return (selectedItem.data as any).id === id;
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-white">
            Shared files
          </h1>
          <p className="text-xs text-slate-400">
            Files and folders other people have shared with you.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex rounded-md border border-slate-700 bg-slate-900">
          <Button
            size="xs"
            variant={viewMode === "grid" ? "primary" : "ghost"}
            className="rounded-none"
            onClick={() => setViewMode("grid")}
          >
            Grid
          </Button>

          <Button
            size="xs"
            variant={viewMode === "list" ? "primary" : "ghost"}
            className="rounded-none"
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="alpha">Alphabetical</option>
            <option value="recent">Recently opened</option>
            <option value="ownerDept">File owner department</option>
          </select>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search shared files..."
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              Details
            </Button>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-300">
        {folderPath.length === 0 ? (
          <span className="text-slate-400">Top-level shared items</span>
        ) : (
          <>
            <button
              className="text-slate-300 hover:text-sky-400"
              onClick={handleBackToSharedList}
            >
              ← Back to shared list
            </button>
            <span className="text-slate-600">/</span>
            {folderPath.map((folder, index) => (
              <span key={folder.id} className="flex items-center gap-2">
                {index > 0 && <span className="text-slate-600">/</span>}
                <button
                  className="text-slate-400 hover:text-sky-400"
                  onClick={async () => {
                    const newPath = folderPath.slice(0, index + 1);
                    setFolderPath(newPath);
                    setSelectedItem({
                      kind: "folder",
                      data: folder as any,
                    });
                    setDetailsOpen(true);
                    setPreviewUrl(null);
                    await loadSharedFolderContents(folder);
                  }}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </>
        )}
      </div>

      <div className="flex h-[calc(100vh-220px)] gap-3">
        <section className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : folderPath.length === 0 &&
            filteredSortedDocs.length === 0 &&
            visibleFolders.length === 0 ? (
            <p className="text-xs text-slate-500">No shared items.</p>
          ) : (
            <>
              {visibleFolders.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
                    {currentFolder
                      ? `Subfolders in ${currentFolder.name}`
                      : "Shared folders"}
                  </p>
                  {viewMode === "grid" ? (
                    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                      {visibleFolders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          className={`flex flex-col rounded-md border bg-slate-900/80 p-2 text-left hover:border-sky-500 ${
                            isSelected("folder", folder.id)
                              ? "border-sky-500 bg-slate-900"
                              : "border-slate-800"
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            const item: Item = {
                              kind: "folder",
                              data: folder as any,
                            };
                            setSelectedItem(item);
                            setDetailsOpen(true);
                            setPreviewUrl(null);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            handleSelectFolder(folder);
                          }}
                        >
                          <div className="mb-2 flex h-16 items-center justify-center rounded bg-slate-800/80 text-[11px] text-slate-300">
                            Folder
                          </div>
                          <p className="truncate text-xs text-slate-100">
                            {folder.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {folder.department_name || "Unknown department"}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            Owner: {folder.owner_name || "Unknown"}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-4 overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                          <tr>
                            <th className="py-2 pr-3">Folder</th>
                            <th className="py-2 pr-3">From department</th>
                            <th className="py-2 pr-3">Owner</th>
                            <th className="py-2 pr-3">Permission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {visibleFolders.map((folder) => (
                            <tr
                              key={folder.id}
                              className={`cursor-pointer hover:bg-slate-800/60 ${
                                isSelected("folder", folder.id)
                                  ? "bg-slate-800/80"
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                const item: Item = {
                                  kind: "folder",
                                  data: folder as any,
                                };
                                setSelectedItem(item);
                                setDetailsOpen(true);
                                setPreviewUrl(null);
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                handleSelectFolder(folder);
                              }}
                            >
                              <td className="py-2 pr-3 text-slate-100">
                                {folder.name}
                              </td>
                              <td className="py-2 pr-3 text-slate-300">
                                {folder.department_name || "Unknown"}
                              </td>
                              <td className="py-2 pr-3 text-slate-400">
                                {folder.owner_name || "Unknown"}
                              </td>
                              <td className="py-2 pr-3 text-slate-400">
                                {folder.permission}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
                {currentFolder
                  ? `Files in ${currentFolder.name}`
                  : "Shared files"}
              </p>
              {filteredSortedDocs.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {currentFolder
                    ? "No files in this folder."
                    : "No shared files."}
                </p>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                  {filteredSortedDocs.map((doc) => {
                    const name = doc.title || doc.original_filename;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        className={`flex flex-col rounded-md border bg-slate-900/80 p-2 text-left hover:border-sky-500 ${
                          isSelected("file", doc.id)
                            ? "border-sky-500 bg-slate-900"
                            : "border-slate-800"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          const item: Item = {
                            kind: "file",
                            data: doc as any,
                          };
                          setSelectedItem(item);
                          setDetailsOpen(true);
                          setPreviewUrl(null);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          handleSelectDocument(doc);
                        }}
                      >
                        <div className="mb-2 flex h-16 items-center justify-center rounded bg-slate-800/80 text-[10px] text-slate-500">
                          {doc.mime_type}
                        </div>
                        <p className="truncate text-xs text-slate-100">
                          {name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {doc.department_name || "Unknown department"}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          Owner: {doc.owner_name || "Unknown"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">From department</th>
                        <th className="py-2 pr-3">Owner</th>
                        <th className="py-2 pr-3">Folder</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Size</th>
                        <th className="py-2 pr-3">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredSortedDocs.map((doc) => {
                        const name = doc.title || doc.original_filename;
                        return (
                          <tr
                            key={doc.id}
                            className={`cursor-pointer hover:bg-slate-800/60 ${
                              isSelected("file", doc.id)
                                ? "bg-slate-800/80"
                                : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              const item: Item = {
                                kind: "file",
                                data: doc as any,
                              };
                              setSelectedItem(item);
                              setDetailsOpen(true);
                              setPreviewUrl(null);
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              handleSelectDocument(doc);
                            }}
                          >
                            <td className="py-2 pr-3 text-slate-100">{name}</td>
                            <td className="py-2 pr-3 text-slate-300">
                              {doc.department_name || "Unknown"}
                            </td>
                            <td className="py-2 pr-3 text-slate-400">
                              {doc.owner_name || "Unknown"}
                            </td>
                            <td className="py-2 pr-3 text-slate-400">
                              {doc.folder_name || "—"}
                            </td>
                            <td className="py-2 pr-3 text-slate-400">
                              {doc.mime_type}
                            </td>
                            <td className="py-2 pr-3 text-slate-400">
                              {formatSize(doc.size_bytes)}
                            </td>
                            <td className="py-2 pr-3 text-slate-400">
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <DetailsPanel
          open={detailsOpen && !!selectedItem}
          selectedItem={selectedItem}
          previewUrl={previewUrl}
          formatSize={formatSize}
          onClose={() => setDetailsOpen(false)}
          canEditAccess={isOwner}
          onAccessChanged={async () => {
            if (currentFolder) {
              await loadSharedFolderContents(currentFolder);
            } else {
              await loadTopLevelShared();
            }
          }}
        />
      </div>
    </div>
  );
}
