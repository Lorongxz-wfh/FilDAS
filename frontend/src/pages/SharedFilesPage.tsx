// src/pages/SharedFilesPage.tsx
import { useState } from "react";
import { api } from "../lib/api";
import { useOutletContext } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { DetailsPanel } from "../components/documents/DetailsPanel";
import type { Item } from "../types/documents";
import { Card } from "../components/ui/Card";
import { IconButton } from "../components/ui/IconButton";
import { DropdownMenu } from "../components/ui/DropdownMenu";

import { DocumentUploadModal } from "../components/documents/DocumentUploadModal";
import { NewFolderModal } from "../components/documents/NewFolderModal";
import { RenameModal } from "../components/documents/RenameModal";
import { SharedMoveCopyModal } from "../components/documents/SharedMoveCopyModal";

import { useDepartmentTree } from "../lib/useDepartmentTree";

// New Imports are here after refactoring
import { formatSize } from "../features/documents/lib/formatSize";
import { useSharedFiles } from "../features/documents/hooks/useSharedFiles";
import type {
  DocumentRow,
  SharedFolder,
} from "../features/documents/hooks/useSharedFiles";
import { usePolling } from "../features/documents/hooks/usePolling";
import {
  isSelectedItem,
  canModifySharedFolder,
  canModifySharedFile,
} from "../features/documents/lib/selection";
import { useSharedRenameDelete } from "../features/documents/hooks/useSharedRenameDelete";
import { notify } from "../lib/notify";
import { useDocumentPreview } from "../features/documents/hooks/useDocumentPreview";

type LayoutContext = {
  user: {
    id: number;
    name: string;
    email: string;
    department_id: number | null;
    role?: { id: number; name: string } | null;
  };
  isAdmin: boolean;
};

export default function SharedFilesPage() {
  // ---------- context / hooks ----------
  const { user, isAdmin } = useOutletContext<LayoutContext>();

  // When true, auto-polling is paused to avoid overlapping with shared mutations.
  const [isBusy, setIsBusy] = useState(false);

  const { folders: deptFolders, loading: deptLoading } = useDepartmentTree(
    user.department_id ?? null
  );

  const {
    // state
    folderPath,
    setFolderPath,
    currentFolder,
    folders,
    setFolders,
    documents,
    setDocuments,
    folderChildren,
    setFolderChildren,
    folderDocs,
    setFolderDocs,
    allSharedDocs,
    setAllSharedDocs,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    setDebouncedSearch,
    loading,
    setLoading,
    error,
    setError,
    searching,

    viewMode,
    setViewMode,
    sortMode,
    setSortMode,

    // selection + permissions
    selectedItem,
    setSelectedItem,
    detailsOpen,
    setDetailsOpen,
    canUploadHere,
    canEditAccess,

    // layout
    detailsWidth,
    setDetailsWidth,

    // modals/state
    sharedUploadOpen,
    setSharedUploadOpen,
    sharedUploadMode,
    setSharedUploadMode,
    sharedNewFolderOpen,
    setSharedNewFolderOpen,
    sharedCreatingFolder,
    setSharedCreatingFolder,
    sharedNewFolderName,
    setSharedNewFolderName,
    sharedFolderError,
    setSharedFolderError,
    sharedMoveCopyOpen,
    setSharedMoveCopyOpen,
    sharedPendingAction,
    setSharedPendingAction,
    sharedMoveCopyTargetFolderId,
    setSharedMoveCopyTargetFolderId,

    // data loaders
    loadTopLevelShared,
    loadSharedFolderContents,

    // derived lists
    visibleFolders,
    filteredSortedDocs,
  } = useSharedFiles({
    userId: user.id,
    isAdmin,
  });

  const {
    canRenameSelected,
    canDeleteSelected,
    canMoveSelected,
    sharedRenameOpen,
    setSharedRenameOpen,
    sharedRenameName,
    setSharedRenameName,
    sharedRenaming,
    sharedRenameError,
    setSharedRenameError,
    getSharedItemName,
    handleSharedRenameSubmit,
    handleSharedDeleteSelected,
  } = useSharedRenameDelete({
    // selection comes from useSharedFiles
    selectedItem,
    setSelectedItem,
    detailsOpen,
    setDetailsOpen,

    setAllSharedDocs,
    setDocuments,
    setFolderDocs,
    setFolders,
    setFolderChildren,
    currentFolder,
    loadTopLevelShared,
    loadSharedFolderContents,
    userId: user.id,
    isAdmin,
    onBusyChange: setIsBusy,
  });

  const { previewUrl, previewLoading } = useDocumentPreview({
    detailsOpen,
    selectedItem,
  });

  // ---------- helpers ----------

  const handleDetailsResizeStart = () => {
    const startX =
      window.event instanceof MouseEvent ? window.event.clientX : 0;
    const startWidth = detailsWidth;

    const onMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const next = Math.min(Math.max(startWidth + delta, 260), 520);
      setDetailsWidth(next);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleSelectDocument = (doc: DocumentRow) => {
    const item: Item = { kind: "file", data: doc as any };
    setSelectedItem(item);
    setDetailsOpen(true);
  };

  const handleSelectFolder = async (folder: SharedFolder) => {
    setSelectedItem(null);
    setDetailsOpen(false);
    setSearchQuery("");

    const chain: SharedFolder[] = [];
    let cursor: SharedFolder | null = folder;
    const all = folders.length > 0 ? folders : folderChildren;

    while (cursor) {
      chain.unshift(cursor);
      cursor =
        cursor.parent_id !== null
          ? all.find((f) => f.id === cursor!.parent_id) || null
          : null;
    }

    setFolderPath(chain);
    await loadSharedFolderContents(folder);
  };

  const handleBackToSharedList = async () => {
    setFolderPath([]);
    setFolderChildren([]);
    setFolderDocs([]);
    setSelectedItem(null);
    setSearchQuery("");
    await loadTopLevelShared();
  };

  const handleDownloadSelected = async () => {
    if (!selectedItem || selectedItem.kind !== "file") return;
    const doc = selectedItem.data as DocumentRow;
    try {
      const res = await api.get(`/documents/${doc.id}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: doc.mime_type || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename || doc.title || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      notify("Failed to download file.", "error");
    }
  };

  const handleDownloadFolder = async (folder: SharedFolder) => {
    try {
      const res = await api.get(`/folders/${folder.id}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folder.name}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      notify("Failed to download folder.", "error");
    }
  };

  // Trash selected shared item if allowed (editor/owner on original)
  const handleSharedTrashSelected = async () => {
    if (!selectedItem) return;

    if (!canDeleteSelected) {
      notify(
        "You do not have permission to trash this shared item.",
        "error"
      );
      return;
    }

    const label =
      selectedItem.kind === "file"
        ? "this file"
        : "this folder (and its contents)";

    if (
      !window.confirm(
        `Trash ${label}? It will be hidden from normal views but kept in the Trash.`
      )
    ) {
      return;
    }

    setIsBusy(true);
    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;
        await api.post(`/documents/${doc.id}/trash`);
      } else if (selectedItem.kind === "folder") {
        const folder = selectedItem.data as SharedFolder;
        await api.post(`/folders/${folder.id}/trash`);
      } else {
        return;
      }

      if (currentFolder) {
        await loadSharedFolderContents(currentFolder);
      } else {
        await loadTopLevelShared();
      }

      setSelectedItem(null);
      setDetailsOpen(false);
      notify("Item trashd.", "success");
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to trash item.";
      notify(msg, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSharedCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharedNewFolderName.trim() || !currentFolder) {
      setSharedFolderError("Enter a name.");
      return;
    }
    setSharedCreatingFolder(true);
    setSharedFolderError(null);
    setIsBusy(true);
    try {
      const res = await api.post("/folders", {
        name: sharedNewFolderName.trim(),
        department_id: currentFolder.department_id!,
        parent_id: currentFolder.id,
      });
      const created: SharedFolder = {
        id: res.data.folder?.id ?? res.data.id,
        name: res.data.folder?.name ?? res.data.name,
        parent_id: currentFolder.id,
        department_id: currentFolder.department_id!,
        department_name: currentFolder.department_name,
        owner_id: user.id,
        owner_name: user.name,
        permission: currentFolder.permission,
      };
      setFolderChildren((prev) => [...prev, created]);
      setFolders((prev) => [...prev, created]);
      setSharedNewFolderName("");
      setSharedNewFolderOpen(false);
      notify("Folder created.", "success");
    } catch (err: any) {
      console.error(err);
      setSharedFolderError(
        err.response?.data?.message || "Failed to create folder."
      );
      notify(
        err.response?.data?.message || "Failed to create folder.",
        "error"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSharedMoveCopyConfirm = async (targetFolderId: number | null) => {
    // console.log("handleSharedMoveCopyConfirm", {
    //   targetFolderId,
    //   selectedItem,
    //   sharedPendingAction,
    // });
    if (!selectedItem || !sharedPendingAction) return;

    setIsBusy(true);
    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;
        // console.log("MOVING/COPYING FILE", { docId: doc.id, targetFolderId });
        await api.post(`/documents/${doc.id}/${sharedPendingAction}`, {
          target_folder_id: targetFolderId,
        });
      } else {
        const folder = selectedItem.data as SharedFolder;
        // console.log("MOVING/COPYING FOLDER", {
        //   folderId: folder.id,
        //   targetFolderId,
        // });
        await api.post(`/folders/${folder.id}/${sharedPendingAction}`, {
          target_folder_id: targetFolderId,
        });
      }

      if (currentFolder) {
        await loadSharedFolderContents(currentFolder);
      } else {
        await loadTopLevelShared();
      }

      notify(
        `${sharedPendingAction === "move" ? "Moved" : "Copied"} successfully!`,
        "success"
      );
    } catch (error: any) {
      console.error("MOVE/COPY FAILED", {
        error,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      const status = error?.response?.status;
      const messageFromApi = error?.response?.data?.message as
        | string
        | undefined;

      if (status === 403) {
        notify(
          messageFromApi ||
            "You do not have permission to move or copy this shared item.",
          "error"
        );
      } else {
        notify(
          `Failed to ${sharedPendingAction}: ${
            messageFromApi || "Unknown error"
          }`,
          "error"
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  const toolbarLabel =
    selectedItem === null
      ? "No item selected"
      : selectedItem.kind === "folder"
      ? "Folder selected"
      : "File selected";

  const selectedIsFileOrFolder =
    selectedItem &&
    (selectedItem.kind === "file" || selectedItem.kind === "folder");

  // shared folders + currently loaded children for the move/copy modal
  const sharedFoldersForModal: SharedFolder[] = [...folders, ...folderChildren];

  usePolling(
    () => {
      if (loading || isBusy) return;

      if (currentFolder) {
        loadSharedFolderContents(currentFolder);
      } else {
        loadTopLevelShared();
      }
    },
    {
      intervalMs: 45_000,
      enabled:
        !isBusy &&
        (!searchQuery || searchQuery.trim() === "") &&
        (!!currentFolder || folderPath.length === 0),
      pauseWhenHidden: true,
    }
  );

  // ---------- UI ----------

  return (
    <div>
      <h1 className="mb-1.5 text-2xl font-semibold text-white">Shared files</h1>
      <main>
        {/* toolbar */}
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* left: uploads + new folder (editors only, inside folder) */}
          <div className="flex h-8.5 items-center">
            <div className="flex flex-wrap gap-2">
              {currentFolder && canUploadHere && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSharedUploadMode("files");
                      setSharedUploadOpen(true);
                    }}
                  >
                    Upload file
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSharedUploadMode("folder");
                      setSharedUploadOpen(true);
                    }}
                  >
                    Upload folder
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSharedNewFolderOpen(true)}
                  >
                    New folder
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* right: selection + actions */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-2 text-slate-500">{toolbarLabel}</span>
            {selectedIsFileOrFolder && (
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  size="xs"
                  onClick={() =>
                    selectedItem!.kind === "file"
                      ? handleDownloadSelected()
                      : handleDownloadFolder(selectedItem!.data as any)
                  }
                >
                  Download
                </Button>

                {selectedItem && canRenameSelected && (
                  <>
                    <Button
                      size="xs"
                      onClick={() => {
                        if (!selectedItem) return;
                        if (selectedItem.kind === "file") {
                          const doc = selectedItem.data as any;
                          setSharedRenameName(
                            doc.title || doc.original_filename || ""
                          );
                        } else {
                          const folder = selectedItem.data as any;
                          setSharedRenameName(folder.name || "");
                        }
                        setSharedRenameError(null);
                        setSharedRenameOpen(true);
                      }}
                    >
                      Rename
                    </Button>

                    {canMoveSelected && (
                      <Button
                        size="xs"
                        onClick={() => {
                          setSharedPendingAction("move");
                          setSharedMoveCopyOpen(true);
                        }}
                      >
                        Move
                      </Button>
                    )}

                    {canDeleteSelected && (
                      <>
                        <Button size="xs" onClick={handleSharedTrashSelected}>
                          Trash
                        </Button>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={handleSharedDeleteSelected}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </>
                )}

                {/* Copy is allowed even for viewers */}
                <Button
                  size="xs"
                  onClick={() => {
                    if (!selectedItem) return;
                    setSharedPendingAction("copy");
                    setSharedMoveCopyOpen(true);
                  }}
                >
                  Copy
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* view/sort/search */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
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

            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:outline-none"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
            >
              <option value="alpha">Alphabetical</option>
              <option value="recent">Recently opened</option>
              <option value="ownerDept">File owner / department</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {searching && (
                <div className="h-5 w-5 animate-spin rounded-full border border-sky-500 border-t-transparent" />
              )}
              <input
                type="text"
                placeholder="Search shared files..."
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              Details
            </Button>
          </div>
        </div>

        {/* breadcrumbs + reload */}
        <div className="mb-2 flex items-center gap-3 text-xs text-slate-300">
          {/* Reload button on the far left */}
          <Button
            size="xs"
            variant="secondary"
            onClick={async () => {
              setSelectedItem(null);
              setDetailsOpen(false);

              if (folderPath.length === 0) {
                await loadTopLevelShared();
              } else if (currentFolder) {
                await loadSharedFolderContents(currentFolder);
              }
            }}
          >
            Reload
          </Button>

          {/* Breadcrumbs label/path */}
          {folderPath.length === 0 ? (
            <span className="mt-1 h-4.5 text-slate-400">
              Top-level shared items
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="ghost"
                onClick={handleBackToSharedList}
              >
                ← Back
              </Button>
              <span className="text-slate-600">/</span>
              {folderPath.map((folder, index) => (
                <span key={folder.id} className="flex items-center gap-1">
                  {index > 0 && <span className="text-slate-600">/</span>}
                  <button
                    className="text-slate-300 hover:text-sky-400"
                    onClick={async () => {
                      const newPath = folderPath.slice(0, index + 1);
                      setFolderPath(newPath);
                      setSelectedItem(null);
                      setDetailsOpen(false);
                      setSearchQuery("");
                      await loadSharedFolderContents(folder);
                    }}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* main content */}
        <div className="flex h-[calc(100vh-260px)] gap-3">
          <section
            className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedItem(null);
              }
            }}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              </div>
            ) : error ? (
              <p className="text-xs text-red-400">{error}</p>
            ) : folderPath.length === 0 &&
              !debouncedSearch &&
              filteredSortedDocs.length === 0 &&
              visibleFolders.length === 0 ? (
              <p className="text-xs text-slate-500">No shared items.</p>
            ) : (
              <>
                {visibleFolders.length > 0 && (
                  <>
                    <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
                      {currentFolder
                        ? `Subfolders in ${currentFolder.name}`
                        : "Shared folders"}
                    </p>

                    {viewMode === "grid" ? (
                      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                        {visibleFolders.map((folder) => (
                          <Card
                            key={folder.id}
                            selectable
                            selected={isSelectedItem(
                              selectedItem,
                              "folder",
                              folder.id
                            )}
                            className="group cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedItem({
                                kind: "folder",
                                data: folder as any,
                              });
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              handleSelectFolder(folder);
                            }}
                          >
                            <div className="flex h-full flex-col justify-between">
                              <div className="mb-2 flex items-start justify-between">
                                <div className="text-[32px] leading-none">
                                  📁
                                </div>
                                <DropdownMenu
                                  trigger={
                                    <IconButton
                                      className="dropdown-root"
                                      size="xs"
                                      variant="ghost"
                                    >
                                      ⋮
                                    </IconButton>
                                  }
                                >
                                  <DropdownMenu.Item
                                    onClick={() => handleSelectFolder(folder)}
                                  >
                                    Open
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setSelectedItem({
                                        kind: "folder",
                                        data: folder as any,
                                      });
                                      setDetailsOpen(true);
                                    }}
                                  >
                                    Details
                                  </DropdownMenu.Item>

                                  <DropdownMenu.Item
                                    onClick={() => handleDownloadFolder(folder)}
                                  >
                                    Download
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setSelectedItem({
                                        kind: "folder",
                                        data: folder as any,
                                      });
                                      setSharedPendingAction("copy");
                                      setSharedMoveCopyOpen(true);
                                    }}
                                  >
                                    Copy
                                  </DropdownMenu.Item>

                                  {(() => {
                                    if (
                                      !canModifySharedFolder(
                                        folder,
                                        user.id,
                                        isAdmin
                                      )
                                    ) {
                                      return null;
                                    }

                                    return (
                                      <>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setSelectedItem({
                                              kind: "folder",
                                              data: folder as any,
                                            });
                                            setSharedRenameError(null);
                                            setSharedRenameName(folder.name);
                                            setSharedRenameOpen(true);
                                          }}
                                        >
                                          Rename
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setSelectedItem({
                                              kind: "folder",
                                              data: folder as any,
                                            });
                                            setSharedPendingAction("move");
                                            setSharedMoveCopyOpen(true);
                                          }}
                                        >
                                          Move
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          destructive
                                          onClick={() => {
                                            setSelectedItem({
                                              kind: "folder",
                                              data: folder as any,
                                            });
                                            handleSharedTrashSelected();
                                          }}
                                        >
                                          Trash
                                        </DropdownMenu.Item>
                                      </>
                                    );
                                  })()}
                                </DropdownMenu>
                              </div>
                              <div className="space-y-0.5">
                                <p className="truncate text-xs text-slate-100">
                                  {folder.name}
                                </p>
                                <p className="truncate text-[11px] text-slate-500">
                                  {folder.department_name ||
                                    "Unknown department"}
                                </p>
                              </div>
                            </div>
                          </Card>
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
                                  isSelectedItem(
                                    selectedItem,
                                    "folder",
                                    folder.id
                                  )
                                    ? "bg-slate-800/80"
                                    : ""
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedItem({
                                    kind: "folder",
                                    data: folder as any,
                                  });
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
                  </>
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
                  // rest of grid/list rendering...

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                    {filteredSortedDocs.map((doc) => {
                      const name = doc.title || doc.original_filename;
                      const icon = doc.mime_type.startsWith("image/")
                        ? "🖼️"
                        : doc.mime_type.includes("presentation")
                        ? "📽️"
                        : doc.mime_type.includes("word")
                        ? "📄"
                        : doc.mime_type === "application/pdf"
                        ? "📕"
                        : "📁";

                      return (
                        <Card
                          key={doc.id}
                          selectable
                          selected={isSelectedItem(
                            selectedItem,
                            "file",
                            doc.id
                          )}
                          className="group cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            // console.log("Selected doc (grid)", doc);
                            setSelectedItem({ kind: "file", data: doc as any });
                            setDetailsOpen(true);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            handleSelectDocument(doc);
                          }}
                        >
                          <div className="flex h-full flex-col justify-between">
                            <div className="mb-2 flex items-start justify-between">
                              <div className="text-[32px] leading-none">
                                {icon}
                              </div>
                              <DropdownMenu
                                trigger={
                                  <IconButton
                                    className="dropdown-root"
                                    size="xs"
                                    variant="ghost"
                                  >
                                    ⋮
                                  </IconButton>
                                }
                              >
                                <DropdownMenu.Item
                                  onClick={() => {
                                    setSelectedItem({
                                      kind: "file",
                                      data: doc as any,
                                    });
                                    setDetailsOpen(true);
                                  }}
                                >
                                  Details
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  onClick={() => handleDownloadSelected()}
                                >
                                  Download
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  onClick={() => {
                                    setSelectedItem({
                                      kind: "file",
                                      data: doc as any,
                                    });
                                    setSharedPendingAction("copy");
                                    setSharedMoveCopyOpen(true);
                                  }}
                                >
                                  Copy
                                </DropdownMenu.Item>
                                {(() => {
                                  if (
                                    !canModifySharedFile(doc, user.id, isAdmin)
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setSelectedItem({
                                            kind: "file",
                                            data: doc as any,
                                          });
                                          setSharedRenameError(null);
                                          setSharedRenameName(
                                            doc.title ||
                                              doc.original_filename ||
                                              ""
                                          );
                                          setSharedRenameOpen(true);
                                        }}
                                      >
                                        Rename
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setSelectedItem({
                                            kind: "file",
                                            data: doc as any,
                                          });
                                          setSharedPendingAction("move");
                                          setSharedMoveCopyOpen(true);
                                        }}
                                      >
                                        Move
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        destructive
                                        onClick={() => {
                                          setSelectedItem({
                                            kind: "file",
                                            data: doc as any,
                                          });
                                          handleSharedTrashSelected();
                                        }}
                                      >
                                        Trash
                                      </DropdownMenu.Item>
                                    </>
                                  );
                                })()}
                              </DropdownMenu>
                            </div>
                            <div className="space-y-0.5">
                              <p className="truncate text-xs text-slate-100">
                                {name}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">
                                {doc.owner_name || "Unknown owner"} ·{" "}
                                {doc.department_name || "Unknown department"}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">
                                {formatSize(doc.size_bytes)} ·{" "}
                                {new Date(doc.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">File</th>
                          <th className="py-2 pr-3">Owner</th>
                          <th className="py-2 pr-3">Department</th>
                          <th className="py-2 pr-3">Size</th>
                          <th className="py-2 pr-3">Uploaded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredSortedDocs.map((doc) => (
                          <tr
                            key={doc.id}
                            className={`cursor-pointer hover:bg-slate-800/60 ${
                              isSelectedItem(selectedItem, "file", doc.id)
                                ? "bg-slate-800/80"
                                : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              // console.log("Selected doc (list)", doc);
                              // setSelectedItem({
                              //   kind: "file",
                              //   data: doc as any,
                              // });
                              setDetailsOpen(true);
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              handleSelectDocument(doc);
                            }}
                          >
                            <td className="py-2 pr-3 text-slate-100">
                              {doc.title || doc.original_filename}
                            </td>
                            <td className="py-2 pr-3 text-slate-300">
                              {doc.owner_name || "Unknown"}
                            </td>
                            <td className="py-2 pr-3 text-slate-300">
                              {doc.department_name || "Unknown"}
                            </td>
                            <td className="py-2 pr-3 text-slate-400">
                              {formatSize(doc.size_bytes)}
                            </td>
                            <td className="py-2 pr-3 text-slate-400">
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {/* details panel */}
          <section className={`hidden w-[${detailsWidth}px] shrink-0 lg:block`}>
            <DetailsPanel
              open={detailsOpen}
              selectedItem={selectedItem}
              previewUrl={previewUrl}
              previewLoading={previewLoading}
              formatSize={formatSize}
              onClose={() => setDetailsOpen(false)}
              canEditAccess={canEditAccess}
              width={detailsWidth}
              onResizeStart={handleDetailsResizeStart}
              currentUser={{
                id: user.id,
                role: user.role ?? null,
                department: user.department_id
                  ? { id: user.department_id, is_qa: false }
                  : null,
              }}
            />
          </section>
        </div>
      </main>

      {/* Shared modals */}
      <DocumentUploadModal
        open={sharedUploadOpen}
        mode={sharedUploadMode}
        currentDepartmentId={currentFolder?.department_id ?? null}
        currentFolderId={currentFolder?.id ?? null}
        onClose={() => setSharedUploadOpen(false)}
        onSuccess={async () => {
          setIsBusy(true);
          try {
            if (currentFolder) {
              await loadSharedFolderContents(currentFolder);
            } else {
              await loadTopLevelShared();
            }
            notify("Upload completed.", "success");
          } finally {
            setSharedUploadOpen(false);
            setIsBusy(false);
          }
        }}
      />
      <NewFolderModal
        open={sharedNewFolderOpen}
        creating={sharedCreatingFolder}
        folderError={sharedFolderError}
        newFolderName={sharedNewFolderName}
        onClose={() => setSharedNewFolderOpen(false)}
        onSubmit={handleSharedCreateFolder}
        onChangeName={setSharedNewFolderName}
      />
      <RenameModal
        open={sharedRenameOpen}
        renaming={sharedRenaming}
        renameError={sharedRenameError}
        renameName={sharedRenameName}
        onClose={() => setSharedRenameOpen(false)}
        onSubmit={async (e) => {
          e.preventDefault();

          try {
            await handleSharedRenameSubmit(e);
          } catch (err: any) {
            // Fallback in case the hook is ever changed to throw on 403.
            const status = err?.response?.status;
            if (status === 403) {
              if (currentFolder) {
                await loadSharedFolderContents(currentFolder);
              } else {
                await loadTopLevelShared();
              }
            }
          }
        }}
        onChangeName={setSharedRenameName}
      />

      <SharedMoveCopyModal
        open={sharedMoveCopyOpen && !!sharedPendingAction}
        mode={sharedPendingAction as "move" | "copy"}
        userDepartmentId={user.department_id ?? null}
        departmentFolders={deptFolders}
        departmentLoading={deptLoading}
        sharedFolders={sharedFoldersForModal}
        onClose={() => {
          setSharedMoveCopyOpen(false);
          setSharedPendingAction(null);
        }}
        onConfirm={handleSharedMoveCopyConfirm}
      />
    </div>
  );
}
